# Multi-store product comparison — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Največje podražitve" home rail with a multi-store price-comparison rail, and add `/primerjava` (list) and `/primerjava/[product_id]` (detail, multi-series chart + per-store price table) over the new `/api/v1/products` endpoints.

**Architecture:** Two new pages built from the patterns `/search` and `/product/[id]` already use — floated promises into Suspense boundaries with a `resultsKey` remount, both card layouts rendered with CSS choosing below `sm`. New card and chart components sit alongside the existing ones rather than gaining variant props, which is what keeps `/search`, `/popular` and `/top-discounts` behaviourally frozen. All price math and Slovenian copy selection lives in `lib/comparison.ts`, whose imports are type-only so it can be exercised directly under `node`.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), React 19, TypeScript 5, Tailwind 4, Recharts 3.8, shadcn/ui primitives, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-31-multi-store-comparison-design.md` — read it before starting. This plan argues from it and does not restate its rationale.

**Branch:** `feature/multi-store-comparison` (already created off `development`).

## Global Constraints

- **No backend changes.** `/Users/svenahac/Documents/Personal_Projects/digitalna-kosarica` is read-only for this work.
- **No test files.** This repo has none, no `test` script, and vitest is wired only to Storybook's scaffold stories. Verification is: `node` assertions for `lib/` pure functions, `pnpm build`, `pnpm lint`, and Chrome against `pnpm dev`. Do not add a test framework, a test script, or `*.test.ts` files.
- **`components/shared/ProductCard.tsx` and `components/shared/ProductCardList.tsx` must not be modified.** This is the mechanism enforcing the spec's non-goal: cards on `/search`, `/popular` and `/top-discounts` keep linking to `/product/{storeProductId}`. If a task seems to need an edit there, stop and re-read the spec's "Non-goals".
- **Two id spaces.** `/product/[product_id]` = `storeProductId`. `/primerjava/[product_id]` = `product.id`. Never build a `/primerjava/...` href from `item.id`; never build a `/product/...` href from `item.product.id`.
- **`lib/comparison.ts` and `lib/price-history.ts` may only use `import type`.** Both are verified by running them under bare `node`, which erases type-only imports but cannot resolve the `@/` path alias for value imports.
- **All euro amounts go through `formatEurAmount`** from `lib/format.ts`. Never `toFixed` — it emits a decimal point, and this app renders Slovenian decimal commas.
- **All counts go through the plural helpers** in `lib/utils.ts` (`productCountLabel`, `storeCountLabel`) — Slovenian has four count forms.
- **Slovenian copy is exported as named constants** from the module that owns it, never written inline at a call site. This codebase has already shipped a typo in inline copy.
- **Every parameter is clamped before the fetch.** The endpoints have no `@ControllerAdvice`: an out-of-range value returns a bare 500 with no parsed body, not a 400.
- `sort` values: `SAVINGS_PCT` | `STORE_COUNT` | `MIN_PRICE` | `NAME`. No direction param exists.
- `size` 1–100 (default 50), `page` ≥ 0, `days` 1–365 (we always request 365), `categoryIds` ≤ 64 entries.
- Commit after every task, message prefixed `feat:`, `refactor:` or `docs:`.

## File Structure

**Create:**

| Path | Responsibility |
|---|---|
| `types/comparison.types.ts` | Wire types for both endpoints + the sort union. No values except the sort constants. |
| `lib/comparison.ts` | Pure price/label logic: per-unit derivation, the stock-line ladder, query building, day clamping, chart series variants. Type-only imports. |
| `actions/comparison.actions.ts` | The two server actions. Clamping delegated to `lib/comparison.ts`. |
| `components/shared/StoreLogos.tsx` | Overlapping store-logo cluster with `+N` overflow. |
| `components/shared/MultiStoreProductCard.tsx` | Grid card. No `+` button. |
| `components/shared/MultiStoreProductCardList.tsx` | Row card. No cart button. |
| `components/shared/MultiStoreResults.tsx` | Both layouts + `Pagination`, and the single `multiStoreCardProps` mapper. |
| `components/shared/MultiStoreResultsSkeleton.tsx` | Skeleton matching both layouts' box model. |
| `components/shared/MultiStoreFilters.tsx` | Search input, category select, sort select, view toggle. |
| `components/shared/MultiStorePriceChart.tsx` | Multi-series step chart with toggleable legend. |
| `components/shared/StoreListingRow.tsx` | One detail-page price row. |
| `app/(main)/primerjava/page.tsx` | List page. |
| `app/(main)/primerjava/loading.tsx` | List route skeleton. |
| `app/(main)/primerjava/[product_id]/page.tsx` | Detail page. |
| `app/(main)/primerjava/[product_id]/loading.tsx` | Detail route skeleton. |
| `app/(main)/primerjava/[product_id]/not-found.tsx` | Detail 404. |

**Modify:**

| Path | Change |
|---|---|
| `app/globals.css` | Add 5 `--store-*` line-colour tokens. |
| `lib/store.ts` | Add `lineColor` per store. |
| `lib/price-history.ts` | Add `buildMultiStorePriceSeries` beside the untouched `buildPriceSeries`. |
| `components/shared/ProductScrollSection.tsx` | Accept `multiStoreItems` as an alternative to `items`. |
| `app/(main)/page.tsx` | Swap the third rail. |
| `app/(main)/product/[product_id]/page.tsx` | Add the cross-link. |

**Must not change:** `components/shared/ProductCard.tsx`, `components/shared/ProductCardList.tsx`, `components/shared/PriceHistoryChart.tsx`, `lib/cart.tsx`, `actions/home.actions.ts` (its `getHighestPriceIncrease` becomes unreferenced and stays), `actions/search.actions.ts`.

---

### Task 1: Wire types and store line colours

**Files:**
- Create: `types/comparison.types.ts`
- Modify: `app/globals.css:91-95` (append after `--chart-5`)
- Modify: `lib/store.ts` (whole file)

**Interfaces:**
- Consumes: `BaseUnit`, `Product`, `Store` from `types/product.types.ts`.
- Produces: `MultiStoreSort`, `VALID_MULTI_STORE_SORTS`, `DEFAULT_MULTI_STORE_SORT`, `MultiStoreProduct`, `MultiStoreProductPage`, `ComparisonPricePoint`, `ProductComparisonListing`, `ProductComparison`; `STORE_LOGOS[name].lineColor`.

- [ ] **Step 1: Create the types file**

Create `types/comparison.types.ts`:

```ts
import type { BaseUnit, Product, Store } from "@/types/product.types";

/**
 * Ranking for GET /api/v1/products/multi-store.
 *
 * Each option carries its own fixed direction — the endpoint has no
 * `direction` param — so the UI must never show an ascending/descending
 * control beside it. SAVINGS_PCT is widest spread first, STORE_COUNT most
 * stores first, MIN_PRICE cheapest first, NAME A-Z with untitled products last.
 */
export type MultiStoreSort = "SAVINGS_PCT" | "STORE_COUNT" | "MIN_PRICE" | "NAME";

/** Every accepted value, for validating a URL param before it reaches a Select. */
export const VALID_MULTI_STORE_SORTS: MultiStoreSort[] = [
  "SAVINGS_PCT",
  "STORE_COUNT",
  "MIN_PRICE",
  "NAME",
];

export const DEFAULT_MULTI_STORE_SORT: MultiStoreSort = "SAVINGS_PCT";

/**
 * One row of the multi-store list.
 *
 * Carries no pricePerUnit — the endpoint does not send one. See
 * derivePricePerUnit in lib/comparison.ts.
 */
export interface MultiStoreProduct {
  product: Product;
  /** Distinct stores. A store listing the article twice counts once. */
  storeCount: number;
  /** Ascending, bare ids. Resolve through STORE_MAP in types/search.types.ts. */
  storeIds: number[];
  minPrice: number;
  maxPrice: number;
  /** maxPrice - minPrice. */
  savings: number;
  /** savings / maxPrice * 100, two decimals. 0.00 when maxPrice is 0.00. */
  savingsPct: number;
  cheapestStoreId: number;
  baseUnit: BaseUnit | null;
  totalQuantity: number | null;
  /**
   * Whether the store holding minPrice reports it in stock. False means the
   * headline saving is unbuyable, which hides the badge entirely.
   */
  cheapestIsAvailable: boolean;
  /** Distinct stores with at least one in-stock listing. Can be 0. */
  availableStoreCount: number;
}

export interface MultiStoreProductPage {
  products: MultiStoreProduct[];
  currentPage: number;
  numberOfPages: number;
  currentItems: number;
  allItems: number;
}

/**
 * One recorded price. The log records changes only — there is no daily sample,
 * so a price that has not moved in six months has one point or none.
 */
export interface ComparisonPricePoint {
  timestamp: string;
  price: number;
  cardDiscount: boolean;
  /**
   * True on a synthetic point stamped at the start of the `days` window,
   * carrying the last price observed before it. Render it so a stable price
   * still draws a line; never count it as a price change, and never label it
   * as one. A listing with no reading before the window has no anchor.
   */
  anchor: boolean;
}

/**
 * One LISTING, not one store. About 7% of listings are within-store
 * duplicates: the same article listed 2-4 times by one store with different
 * prices and URLs. React keys must therefore be storeProductId, never store.id.
 */
export interface ProductComparisonListing {
  storeProductId: number;
  store: Store;
  /** The store's own label, which differs per store for the same article. */
  title: string | null;
  imageUrl: string | null;
  price: number;
  oldPrice: number | null;
  /** Negative when the price ROSE. Render only when > 0. */
  discountPct: number | null;
  /**
   * Scraped from the store's feed, not computed from price / totalQuantity.
   * Comparable within this group only — never across the list.
   */
  pricePerUnit: number | null;
  baseUnit: BaseUnit | null;
  totalQuantity: number | null;
  isAvailable: boolean;
  cardDiscount: boolean;
  /** Already an absolute URL. Never build a store URL by hand. */
  url: string;
  lastSeenAt: string | null;
  priceHistory: ComparisonPricePoint[];
}

/**
 * Detail response.
 *
 * Deliberately shares no base type with MultiStoreProduct: it has no
 * cheapestIsAvailable and no availableStoreCount, because per-listing
 * isAvailable is strictly more information.
 */
export interface ProductComparison {
  product: Product;
  storeCount: number;
  storeIds: number[];
  minPrice: number;
  maxPrice: number;
  savings: number;
  savingsPct: number;
  cheapestStoreId: number;
  baseUnit: BaseUnit | null;
  totalQuantity: number | null;
  /** Cheapest first. Its length can EXCEED storeCount. */
  listings: ProductComparisonListing[];
}
```

Note: `Product.brand` and `Store.imageUrl` are typed non-nullable in `product.types.ts` but arrive `null` from this endpoint. Guard with `?.` at every call site; never read a logo from `store.imageUrl`.

- [ ] **Step 2: Add store line-colour tokens**

In `app/globals.css`, immediately after the `--chart-5: #d7ccc8;` line (line 95), add:

```css
  /* Store line colours for the multi-store price chart.
     NOT drawn from --chart-1..5: those are a sequential warm ramp, and
     --chart-4 (#bcaaa4) and --chart-5 (#d7ccc8) are near-identical light
     beiges that vanish against --card. Five simultaneous store lines need a
     qualitative palette, each ≥3:1 against the cream card.
     Hofer and Tuš are deliberately OFF-brand: Lidl and Hofer are both blue
     and Mercator and Tuš both red, so brand colours would collide. The logo
     beside each legend entry does the identifying; the colour only has to
     make one line trackable against the other four. */
  --store-spar: #2f7d4f;
  --store-lidl: #1f5fa8;
  --store-mercator: #b3242c;
  --store-hofer: #6b3fa0;
  --store-tus: #c2610a;
```

- [ ] **Step 3: Add `lineColor` to the store map**

Replace `lib/store.ts` entirely:

```ts
export type StoreName = "spar" | "mercator" | "hofer" | "lidl" | "tus";

/**
 * Per-store display data.
 *
 * `lineColor` is only read by the multi-store price chart. It is a CSS var
 * reference rather than a hex literal so the palette stays in globals.css with
 * every other colour in the app.
 */
export const STORE_LOGOS: Record<
  StoreName,
  { label: string; logoUrl: string; lineColor: string }
> = {
  spar:     { label: "Spar",     logoUrl: "/images/spar.png",     lineColor: "var(--store-spar)"     },
  mercator: { label: "Mercator", logoUrl: "/images/mercator.png", lineColor: "var(--store-mercator)" },
  hofer:    { label: "Hofer",    logoUrl: "/images/hofer.png",    lineColor: "var(--store-hofer)"    },
  lidl:     { label: "Lidl",     logoUrl: "/images/lidl.png",     lineColor: "var(--store-lidl)"     },
  tus:      { label: "Tuš",      logoUrl: "/images/tus.png",      lineColor: "var(--store-tus)"      },
};
```

- [ ] **Step 4: Verify nothing broke**

Run: `pnpm lint && pnpm build`
Expected: both succeed. `STORE_LOGOS` gained a field, so existing destructuring (`const { label, logoUrl } = ...`) still compiles.

- [ ] **Step 5: Commit**

```bash
git add types/comparison.types.ts app/globals.css lib/store.ts
git commit -m "feat: multi-store wire types and store line colours"
```

---

### Task 2: Pure comparison logic in `lib/comparison.ts`

**Files:**
- Create: `lib/comparison.ts`

**Interfaces:**
- Consumes: `BaseUnit` (type-only), `MultiStoreSort`, `MultiStoreProduct` (type-only).
- Produces:
  - `derivePricePerUnit(price: number, totalQuantity: number | null, baseUnit: BaseUnit | null): number | null`
  - `stockDisplay(row: Pick<MultiStoreProduct, "storeCount" | "availableStoreCount" | "cheapestIsAvailable">): { note: string | null; showSavingsBadge: boolean }`
  - `clampDays(days: number): number`
  - `buildMultiStoreQuery(p: { page?: number; size?: number; sort?: MultiStoreSort; query?: string; categoryIds?: number[] }): URLSearchParams`
  - `seriesVariants<T extends { storeProductId: number; storeId: number }>(listings: T[]): (T & { occurrence: number; dashed: boolean })[]`
  - `STOCK_NONE`, `STOCK_CHEAPEST_OUT`, `NO_MULTI_STORE_PAGE`.
  (The three list-page empty-state strings live in the page that owns them, Task 10 — not here.)

**This file must use `import type` only** — it is verified by running it under bare `node`.

- [ ] **Step 1: Write the failing assertions**

Create a throwaway check script at `/private/tmp/claude-501/-Users-svenahac-Documents-Personal-Projects-digitalna-kosarica-frontend/ac9f2d6c-74db-4bb4-9cb1-e2952f525c24/scratchpad/check-comparison.mjs`:

```js
import assert from "node:assert/strict";
import {
  derivePricePerUnit,
  stockDisplay,
  clampDays,
  buildMultiStoreQuery,
  seriesVariants,
} from "/Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend/lib/comparison.ts";

// --- derivePricePerUnit -----------------------------------------------------
// ml and g scale to €/L and €/kg, matching PER_UNIT_LABEL in lib/format.ts.
assert.equal(derivePricePerUnit(1.79, 1500, "ml"), (1.79 / 1500) * 1000);
assert.equal(derivePricePerUnit(2.5, 500, "g"), (2.5 / 500) * 1000);
// piece is per single piece, unscaled.
assert.equal(derivePricePerUnit(4, 8, "piece"), 0.5);
// m is deliberately NOT derived: the x1000 convention is unconfirmed for it.
assert.equal(derivePricePerUnit(3, 1.5, "m"), null);
// Missing or nonsensical quantity yields null, never Infinity or NaN.
assert.equal(derivePricePerUnit(1.79, null, "ml"), null);
assert.equal(derivePricePerUnit(1.79, 0, "ml"), null);
assert.equal(derivePricePerUnit(1.79, -5, "ml"), null);
assert.equal(derivePricePerUnit(1.79, 1500, null), null);

// --- stockDisplay ----------------------------------------------------------
// Rule 4: everything in stock -> no note, badge shown.
assert.deepEqual(
  stockDisplay({ storeCount: 3, availableStoreCount: 3, cheapestIsAvailable: true }),
  { note: null, showSavingsBadge: true },
);
// Rule 3: partially stocked but the cheapest IS buyable -> badge stays.
assert.deepEqual(
  stockDisplay({ storeCount: 3, availableStoreCount: 2, cheapestIsAvailable: true }),
  { note: "na zalogi v 2 od 3 trgovin", showSavingsBadge: true },
);
// Rule 2 outranks rule 3: cheapest unbuyable -> badge hidden, and the note
// names WHICH listing is missing rather than how many.
assert.deepEqual(
  stockDisplay({ storeCount: 3, availableStoreCount: 2, cheapestIsAvailable: false }),
  { note: "najcenejša ni na zalogi", showSavingsBadge: false },
);
// Rule 1 outranks everything.
assert.deepEqual(
  stockDisplay({ storeCount: 3, availableStoreCount: 0, cheapestIsAvailable: false }),
  { note: "trenutno ni na zalogi", showSavingsBadge: false },
);

// --- clampDays -------------------------------------------------------------
assert.equal(clampDays(365), 365);
assert.equal(clampDays(0), 1);
assert.equal(clampDays(9999), 365);
assert.equal(clampDays(1.7), 1);
assert.equal(clampDays(Number.NaN), 365);

// --- buildMultiStoreQuery --------------------------------------------------
assert.equal(
  buildMultiStoreQuery({}).toString(),
  "page=0&size=50&sort=SAVINGS_PCT",
);
// Blank query omitted, never sent as an empty string.
assert.equal(
  buildMultiStoreQuery({ query: "   " }).toString(),
  "page=0&size=50&sort=SAVINGS_PCT",
);
assert.equal(
  buildMultiStoreQuery({ query: " coca cola " }).get("query"),
  "coca cola",
);
// Out-of-range clamped, not forwarded — a bad value returns a bare 500.
assert.equal(buildMultiStoreQuery({ page: -4 }).get("page"), "0");
assert.equal(buildMultiStoreQuery({ size: 0 }).get("size"), "1");
assert.equal(buildMultiStoreQuery({ size: 5000 }).get("size"), "100");
assert.equal(buildMultiStoreQuery({ size: 20.6 }).get("size"), "20");
// Unknown sort falls back rather than reaching the wire.
assert.equal(
  buildMultiStoreQuery({ sort: "NOPE" }).get("sort"),
  "SAVINGS_PCT",
);
// categoryIds repeat, are filtered to positive integers, and cap at 64.
assert.deepEqual(
  buildMultiStoreQuery({ categoryIds: [3, 20] }).getAll("categoryIds"),
  ["3", "20"],
);
assert.deepEqual(
  buildMultiStoreQuery({ categoryIds: [3, 0, -1, 2.5, Number.NaN, Infinity] })
    .getAll("categoryIds"),
  ["3"],
);
assert.equal(
  buildMultiStoreQuery({
    categoryIds: Array.from({ length: 80 }, (_, i) => i + 1),
  }).getAll("categoryIds").length,
  64,
);
// Empty array is omitted entirely: [] is not "all categories" on the wire.
assert.equal(buildMultiStoreQuery({ categoryIds: [] }).has("categoryIds"), false);

// --- seriesVariants --------------------------------------------------------
// One listing per store: nothing dashed.
assert.deepEqual(
  seriesVariants([
    { storeProductId: 11, storeId: 2 },
    { storeProductId: 22, storeId: 1 },
  ]),
  [
    { storeProductId: 11, storeId: 2, occurrence: 1, dashed: false },
    { storeProductId: 22, storeId: 1, occurrence: 1, dashed: false },
  ],
);
// A store's second and third listings are dashed and numbered, in input order.
assert.deepEqual(
  seriesVariants([
    { storeProductId: 11, storeId: 2 },
    { storeProductId: 12, storeId: 2 },
    { storeProductId: 22, storeId: 1 },
    { storeProductId: 13, storeId: 2 },
  ]),
  [
    { storeProductId: 11, storeId: 2, occurrence: 1, dashed: false },
    { storeProductId: 12, storeId: 2, occurrence: 2, dashed: true },
    { storeProductId: 22, storeId: 1, occurrence: 1, dashed: false },
    { storeProductId: 13, storeId: 2, occurrence: 3, dashed: true },
  ],
);
assert.deepEqual(seriesVariants([]), []);

console.log("lib/comparison.ts OK");
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
node /private/tmp/claude-501/-Users-svenahac-Documents-Personal-Projects-digitalna-kosarica-frontend/ac9f2d6c-74db-4bb4-9cb1-e2952f525c24/scratchpad/check-comparison.mjs
```

Expected: FAIL — `ERR_MODULE_NOT_FOUND`, because `lib/comparison.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `lib/comparison.ts`:

```ts
import type { BaseUnit } from "@/types/product.types";
import type { MultiStoreProduct, MultiStoreSort } from "@/types/comparison.types";

/**
 * Price and label logic for the multi-store comparison pages.
 *
 * Every import here is type-only, so type stripping erases them all and this
 * module can be exercised directly with `node` — the same property
 * lib/format.ts and lib/price-history.ts rely on. Do not add a value import;
 * bare node cannot resolve the `@/` alias.
 */

// Mirrors PER_UNIT_LABEL in lib/format.ts: g -> €/kg, ml -> €/L, piece -> €/kos.
// `m` is absent on purpose, see derivePricePerUnit.
const PER_UNIT_SCALE: Partial<Record<BaseUnit, number>> = {
  g: 1000,
  ml: 1000,
  piece: 1,
};

const VALID_SORTS: MultiStoreSort[] = [
  "SAVINGS_PCT",
  "STORE_COUNT",
  "MIN_PRICE",
  "NAME",
];

/**
 * Price per kg / L / piece, derived because the list endpoint sends no
 * pricePerUnit — only baseUnit and totalQuantity.
 *
 * This can disagree by a cent with the figure the DETAIL page shows for the
 * same listing, and that is accepted, not a bug: backend pricePerUnit is
 * *scraped* from each store's feed (`price_per_unit`, `pricePerSubUnit`,
 * `comparison`), never computed from price / quantity, so a store's own
 * published figure can be stale or rounded differently. Do not "fix" this by
 * making the detail rows derive too — they must keep showing what the store
 * publishes.
 *
 * `m` returns null deliberately. The x1000 scaling was confirmed only in the
 * backend's BlStaplesSelectionService, where every unit except `piece` is
 * scaled — which would render €/km while lib/format.ts labels the unit €/m.
 * A missing number beats a wrong one, and `m` products are rare.
 */
export function derivePricePerUnit(
  price: number,
  totalQuantity: number | null,
  baseUnit: BaseUnit | null,
): number | null {
  if (baseUnit == null) return null;
  const scale = PER_UNIT_SCALE[baseUnit];
  if (scale == null) return null;
  // Guards against both null and the 0 that would yield Infinity, and against
  // the negative quantities a bad parse can produce.
  if (totalQuantity == null || totalQuantity <= 0) return null;
  if (!Number.isFinite(price)) return null;
  return (price / totalQuantity) * scale;
}

/** Stock copy for a list row. Exported so the string is written once. */
export const STOCK_NONE = "trenutno ni na zalogi";
export const STOCK_CHEAPEST_OUT = "najcenejša ni na zalogi";

/**
 * The card's single stock line, plus whether the savings badge may show.
 *
 * Resolved by the first matching rule so the two independent signals — the
 * cheapest listing's stock, and how many stores have any stock — can never
 * stack into a contradictory pair of lines:
 *
 *   1. nothing in stock anywhere      -> "trenutno ni na zalogi",   no badge
 *   2. the cheapest is out of stock   -> "najcenejša ni na zalogi", no badge
 *   3. some stores are out of stock   -> "na zalogi v N od M trgovin", badge
 *   4. otherwise                      -> no line,                    badge
 *
 * Rule 2 outranks rule 3 on purpose: when the cheapest listing is unbuyable,
 * *which* listing is missing matters more than how many are. And an unbuyable
 * headline saving is worse than no headline, which is why 1 and 2 hide the
 * badge outright rather than dimming it.
 */
export function stockDisplay(
  row: Pick<
    MultiStoreProduct,
    "storeCount" | "availableStoreCount" | "cheapestIsAvailable"
  >,
): { note: string | null; showSavingsBadge: boolean } {
  if (row.availableStoreCount <= 0) {
    return { note: STOCK_NONE, showSavingsBadge: false };
  }
  if (!row.cheapestIsAvailable) {
    return { note: STOCK_CHEAPEST_OUT, showSavingsBadge: false };
  }
  if (row.availableStoreCount < row.storeCount) {
    return {
      // Genitive plural after "od": "v 2 od 3 trgovin". Not storeCountLabel,
      // which is nominative ("3 trgovine") and reads wrong in this frame.
      note: `na zalogi v ${row.availableStoreCount} od ${row.storeCount} trgovin`,
      showSavingsBadge: true,
    };
  }
  return { note: null, showSavingsBadge: true };
}

/** Clamps to the endpoint's 1..365. NaN falls back to the full window. */
export function clampDays(days: number): number {
  if (!Number.isFinite(days)) return 365;
  return Math.min(365, Math.max(1, Math.floor(days)));
}

/**
 * Query string for GET /api/v1/products/multi-store, with every value clamped
 * to the endpoint's accepted range.
 *
 * The clamping is not defensive politeness: this API has no @ControllerAdvice,
 * so a violated @Min/@Max surfaces as a bare 500 with no parsed body. A value
 * this function lets through unclamped becomes an unexplainable error page.
 */
export function buildMultiStoreQuery(p: {
  page?: number;
  size?: number;
  sort?: MultiStoreSort;
  query?: string;
  categoryIds?: number[];
}): URLSearchParams {
  const page = Number.isFinite(p.page) ? Math.max(0, Math.floor(p.page!)) : 0;
  const size = Number.isFinite(p.size)
    ? Math.min(100, Math.max(1, Math.floor(p.size!)))
    : 50;
  const sort = VALID_SORTS.includes(p.sort as MultiStoreSort)
    ? (p.sort as MultiStoreSort)
    : "SAVINGS_PCT";

  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort,
  });

  // Blank matches everything server-side, so an empty string is the same as
  // omitting it — omit, to keep the cache key stable across both spellings.
  const query = p.query?.trim();
  if (query) params.set("query", query);

  if (p.categoryIds?.length) {
    // The same membership test /search applies: rejects the NaN from ?x=abc,
    // the 0 from a hand-edited URL, non-integers, and Infinity — which matters
    // because JSON.stringify turns Infinity into a null array element.
    const ids = p.categoryIds
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 64);
    for (const id of ids) params.append("categoryIds", String(id));
  }

  return params;
}

/**
 * Marks within-store duplicate listings so the chart can draw them distinctly.
 *
 * About 7% of listings are the same article listed 2-4 times by ONE store with
 * different prices and URLs. The API surfaces them rather than picking one,
 * because collapsing would show a stale price as the store's price. So the
 * chart draws every listing: the first in a store's solid line colour, each
 * subsequent one dashed and numbered.
 *
 * Input order is preserved (the API sends cheapest first), so `occurrence` is
 * "nth cheapest listing from this store", which is also the order the price
 * table below the chart uses.
 */
export function seriesVariants<
  T extends { storeProductId: number; storeId: number },
>(listings: T[]): (T & { occurrence: number; dashed: boolean })[] {
  const seen = new Map<number, number>();
  return listings.map((listing) => {
    const occurrence = (seen.get(listing.storeId) ?? 0) + 1;
    seen.set(listing.storeId, occurrence);
    return { ...listing, occurrence, dashed: occurrence > 1 };
  });
}

/** Resolves to this when a list request fails, so a page never throws. */
export const NO_MULTI_STORE_PAGE = {
  products: [],
  currentPage: 0,
  numberOfPages: 0,
  currentItems: 0,
  allItems: 0,
};
```

- [ ] **Step 4: Run the assertions to confirm they pass**

```bash
node /private/tmp/claude-501/-Users-svenahac-Documents-Personal-Projects-digitalna-kosarica-frontend/ac9f2d6c-74db-4bb4-9cb1-e2952f525c24/scratchpad/check-comparison.mjs
```

Expected: PASS — prints `lib/comparison.ts OK`, exit 0.
(A `MODULE_TYPELESS_PACKAGE_JSON` warning on stderr is expected and harmless — `lib/format.ts` produces it too.)

- [ ] **Step 5: Confirm the module still has no value imports**

```bash
grep -n "^import" lib/comparison.ts
```
Expected: every line begins `import type`. If any does not, the `node` verification above will break for the next engineer.

- [ ] **Step 6: Commit**

```bash
git add lib/comparison.ts
git commit -m "feat: pure multi-store price and label logic"
```

Do not commit the scratchpad script.

---

### Task 3: Multi-series chart data in `lib/price-history.ts`

**Files:**
- Modify: `lib/price-history.ts` (append; leave `buildPriceSeries` and `toDailyPoints` byte-identical)

**Interfaces:**
- Consumes: `ComparisonPricePoint` (type-only); the existing `buildPriceSeries`.
- Produces:
  - `seriesKey(storeProductId: number): string` → `"s12345"`
  - `cardKey(storeProductId: number): string` → `"s12345__card"`
  - `MultiSeriesPoint` interface
  - `buildMultiStorePriceSeries(listings, months, now?): MultiSeriesPoint[]`

- [ ] **Step 1: Write the failing assertions**

Create `/private/tmp/claude-501/-Users-svenahac-Documents-Personal-Projects-digitalna-kosarica-frontend/ac9f2d6c-74db-4bb4-9cb1-e2952f525c24/scratchpad/check-series.mjs`:

```js
import assert from "node:assert/strict";
import {
  buildPriceSeries,
  buildMultiStorePriceSeries,
  seriesKey,
  cardKey,
} from "/Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend/lib/price-history.ts";

const NOW = new Date("2026-08-31T12:00:00Z");
const at = (iso, price, cardDiscount = false, anchor = false) => ({
  timestamp: iso, price, cardDiscount, anchor,
});

// --- keys ------------------------------------------------------------------
assert.equal(seriesKey(12345), "s12345");
assert.equal(cardKey(12345), "s12345__card");

// --- the existing single-series builder is untouched ----------------------
const single = buildPriceSeries(
  [at("2026-08-01T00:00:00Z", 2.29), at("2026-08-10T00:00:00Z", 1.79)],
  null,
  NOW,
);
assert.equal(single.length, 3);           // two readings + carry-forward to now
assert.equal(single[2].price, 1.79);
assert.equal(single[2].time, NOW.getTime());

// --- two listings merge onto one axis -------------------------------------
const merged = buildMultiStorePriceSeries(
  [
    { storeProductId: 11, priceHistory: [at("2026-08-01T00:00:00Z", 2.29), at("2026-08-10T00:00:00Z", 1.79)] },
    { storeProductId: 22, priceHistory: [at("2026-08-05T00:00:00Z", 2.09)] },
  ],
  null,
  NOW,
);

// Union of both axes: Aug 1, Aug 5, Aug 10, now. Ascending, deduplicated.
assert.deepEqual(
  merged.map((p) => new Date(p.time).toISOString().slice(0, 10)),
  ["2026-08-01", "2026-08-05", "2026-08-10", "2026-08-31"],
);

// Series 11 starts on Aug 1 and carries its price forward across Aug 5, where
// only the OTHER store changed. Without carry-forward the line would gap.
assert.equal(merged[0][seriesKey(11)], 2.29);
assert.equal(merged[1][seriesKey(11)], 2.29);
assert.equal(merged[2][seriesKey(11)], 1.79);
assert.equal(merged[3][seriesKey(11)], 1.79);

// Series 22 has NO reading before Aug 5, so it is null there — not 0, and not
// back-filled with a price the store had not published yet.
assert.equal(merged[0][seriesKey(22)], null);
assert.equal(merged[1][seriesKey(22)], 2.09);
assert.equal(merged[3][seriesKey(22)], 2.09);

// --- card-discount flag travels per series per point ---------------------
const carded = buildMultiStorePriceSeries(
  [{ storeProductId: 11, priceHistory: [at("2026-08-01T00:00:00Z", 1.49, true)] }],
  null,
  NOW,
);
assert.equal(carded[0][cardKey(11)], true);

// --- an anchor point is rendered like any other --------------------------
const anchored = buildMultiStorePriceSeries(
  [{
    storeProductId: 11,
    priceHistory: [
      at("2026-06-01T00:00:00Z", 2.29, false, true),   // synthetic window start
      at("2026-08-10T00:00:00Z", 1.79),
    ],
  }],
  null,
  NOW,
);
assert.equal(anchored[0][seriesKey(11)], 2.29);
assert.equal(anchored.length, 3);

// --- a listing with an empty history contributes no series ---------------
const withEmpty = buildMultiStorePriceSeries(
  [
    { storeProductId: 11, priceHistory: [at("2026-08-01T00:00:00Z", 2.29)] },
    { storeProductId: 22, priceHistory: [] },
  ],
  null,
  NOW,
);
assert.equal(seriesKey(22) in withEmpty[0], false);

// --- every listing empty yields no points at all -------------------------
assert.deepEqual(
  buildMultiStorePriceSeries([{ storeProductId: 11, priceHistory: [] }], null, NOW),
  [],
);
assert.deepEqual(buildMultiStorePriceSeries([], null, NOW), []);

// --- the months window applies per listing -------------------------------
const windowed = buildMultiStorePriceSeries(
  [{
    storeProductId: 11,
    priceHistory: [at("2026-01-01T00:00:00Z", 3.49), at("2026-08-20T00:00:00Z", 1.79)],
  }],
  1,
  NOW,
);
// The January reading is outside a 1-month window, but its price is carried in
// as the window-start anchor, so the line spans the whole window.
assert.equal(new Date(windowed[0].time).toISOString().slice(0, 10), "2026-07-31");
assert.equal(windowed[0][seriesKey(11)], 3.49);

console.log("buildMultiStorePriceSeries OK");
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
node /private/tmp/claude-501/-Users-svenahac-Documents-Personal-Projects-digitalna-kosarica-frontend/ac9f2d6c-74db-4bb4-9cb1-e2952f525c24/scratchpad/check-series.mjs
```

Expected: FAIL — `SyntaxError: The requested module ... does not provide an export named 'buildMultiStorePriceSeries'`.

- [ ] **Step 3: Append the implementation**

At the top of `lib/price-history.ts`, add to the existing import line so it reads:

```ts
import type { PriceHistoryEntry } from "@/types/product.types";
import type { ComparisonPricePoint } from "@/types/comparison.types";
```

Then append at the end of the file:

```ts
/**
 * Recharts dataKey for one listing's line. Prefixed because a bare numeric key
 * is ambiguous against the `time` field.
 */
export function seriesKey(storeProductId: number): string {
  return `s${storeProductId}`;
}

/** Companion key carrying that listing's cardDiscount flag at the same point. */
export function cardKey(storeProductId: number): string {
  return `s${storeProductId}__card`;
}

/**
 * One row of the multi-series chart: a timestamp plus, for every listing, its
 * price at that moment (or null before its first reading) and its
 * card-discount flag.
 */
export interface MultiSeriesPoint {
  time: number;
  [key: string]: number | boolean | null;
}

/**
 * Merges every listing's price history onto one shared time axis.
 *
 * Each listing goes through buildPriceSeries first, so it inherits the
 * daily-collapse, the window anchor and the carry-forward-to-now that the
 * single-store chart already relies on — including the reason the oldest
 * reading is always kept. Only the merge is new.
 *
 * Between its own readings a series carries its last price forward, because
 * the price WAS that value: a point exists at every timestamp where any
 * listing changed, and leaving the others null there would break their lines
 * wherever a competitor happened to move. Before a series' first reading it
 * stays null — the store had published no price yet, and 0 would draw a line
 * to the floor.
 *
 * A listing with an empty priceHistory contributes no key at all, so the chart
 * simply draws no line for it rather than a flat zero.
 *
 * `now` is a parameter so the output is a function of its inputs alone.
 */
export function buildMultiStorePriceSeries(
  listings: {
    storeProductId: number;
    priceHistory: ComparisonPricePoint[];
  }[],
  months: number | null,
  now: Date = new Date(),
): MultiSeriesPoint[] {
  // ComparisonPricePoint is structurally a PriceHistoryEntry plus `anchor`, so
  // it feeds buildPriceSeries directly. The anchor flag is not consulted here:
  // a synthetic point draws exactly like a real one, and it is the CALLER's
  // job never to count it as a price change.
  const series = listings
    .map((listing) => ({
      key: seriesKey(listing.storeProductId),
      card: cardKey(listing.storeProductId),
      points: buildPriceSeries(listing.priceHistory, months, now),
    }))
    .filter((s) => s.points.length > 0);

  if (series.length === 0) return [];

  const times = [...new Set(series.flatMap((s) => s.points.map((p) => p.time)))].sort(
    (a, b) => a - b,
  );

  return times.map((time) => {
    const row: MultiSeriesPoint = { time };
    for (const s of series) {
      // The last point at or before `time` — the price that stood then. Linear
      // scan per series per timestamp is fine: at most ~5 series x a few dozen
      // price changes over a year.
      let current: (typeof s.points)[number] | undefined;
      for (const point of s.points) {
        if (point.time > time) break;
        current = point;
      }
      row[s.key] = current ? current.price : null;
      row[s.card] = current ? current.cardDiscount : null;
    }
    return row;
  });
}
```

- [ ] **Step 4: Run the assertions to confirm they pass**

```bash
node /private/tmp/claude-501/-Users-svenahac-Documents-Personal-Projects-digitalna-kosarica-frontend/ac9f2d6c-74db-4bb4-9cb1-e2952f525c24/scratchpad/check-series.mjs
```

Expected: PASS — prints `buildMultiStorePriceSeries OK`.

- [ ] **Step 5: Confirm the single-store chart is untouched**

```bash
git diff lib/price-history.ts | grep -E "^-" | grep -v "^---"
```
Expected: exactly one removed line — the old single import line. If `buildPriceSeries` or `toDailyPoints` shows any removal, revert and re-apply as a pure append.

- [ ] **Step 6: Commit**

```bash
git add lib/price-history.ts
git commit -m "feat: merge multiple listings' price histories onto one axis"
```

---

### Task 4: Server actions

**Files:**
- Create: `actions/comparison.actions.ts`

**Interfaces:**
- Consumes: `buildMultiStoreQuery`, `clampDays`, `NO_MULTI_STORE_PAGE` from `lib/comparison.ts`; the types from Task 1.
- Produces:
  - `getMultiStoreProducts(params): Promise<MultiStoreProductPage>` — never throws
  - `getProductComparison(id: string, days?: number): Promise<ProductComparison>` — throws on failure

- [ ] **Step 1: Write the file**

Create `actions/comparison.actions.ts`:

```ts
"use server";

import {
  buildMultiStoreQuery,
  clampDays,
  NO_MULTI_STORE_PAGE,
} from "@/lib/comparison";
import type {
  MultiStoreProductPage,
  MultiStoreSort,
  ProductComparison,
} from "@/types/comparison.types";

/**
 * The product-level endpoints: one article and what every store charges for it.
 *
 * `{id}` here is product.id, NOT storeProductId. The two are separate identity
 * spaces and both are bare integers, so a mix-up shows a plausible page about
 * the wrong article. product.actions.ts owns the storeProductId side.
 *
 * These endpoints send no CORS headers by design — every call must stay
 * server-side, which is what "use server" guarantees.
 */

/**
 * A list response is documented as always 200, but every other list endpoint
 * in this app answers 204 with an empty body when it has nothing, and res.ok
 * is true for 204 — which makes res.json() throw. Read text first, as
 * home.actions.ts does.
 */
async function parsePage(res: Response): Promise<MultiStoreProductPage | null> {
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text) as MultiStoreProductPage;
}

export async function getMultiStoreProducts(params: {
  page?: number;
  size?: number;
  sort?: MultiStoreSort;
  query?: string;
  categoryIds?: number[];
}): Promise<MultiStoreProductPage> {
  // Clamped in buildMultiStoreQuery, before anything reaches the wire: this
  // API has no error envelope, so an out-of-range size or a 65th categoryId
  // comes back as a bare 500 with no parsed body.
  const search = buildMultiStoreQuery(params);

  try {
    const res = await fetch(
      `${process.env.API_URL}/products/multi-store?${search}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      console.error(
        `Multi-store API error: ${res.status} ${res.statusText} (${search})`,
      );
      return NO_MULTI_STORE_PAGE;
    }

    // Awaited so a malformed body rejects inside the catch, not after returning.
    return (await parsePage(res)) ?? NO_MULTI_STORE_PAGE;
  } catch (error) {
    console.error("Multi-store request failed:", error);
    return NO_MULTI_STORE_PAGE;
  }
}

/**
 * One product with every store's listing and each listing's price history.
 *
 * Throws on failure rather than returning a fallback, so the page can turn it
 * into notFound() — the same contract getProduct has. A 404 means either no
 * such product or every listing behind it has been delisted; both are "gone".
 *
 * Unlike getProduct this does NOT forward the client IP: fetching a store
 * product records a view for the most-popular list, and this endpoint has no
 * such side effect. Forwarding it would imply one.
 */
export async function getProductComparison(
  id: string,
  days: number = 365,
): Promise<ProductComparison> {
  const res = await fetch(
    `${process.env.API_URL}/products/${id}?days=${clampDays(days)}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch product comparison: ${res.status} ${res.statusText}`,
    );
  }

  return res.json() as Promise<ProductComparison>;
}
```

- [ ] **Step 2: Confirm the API base path is right**

```bash
grep -rn "API_URL" .env* next.config.ts 2>/dev/null | head
grep -rn "API_URL}/" actions/ | head
```

Every existing action builds `${process.env.API_URL}/store/products/...` and `${process.env.API_URL}/categories`, so `API_URL` already ends at `/api/v1`. The paths above (`/products/multi-store`, `/products/{id}`) therefore resolve to `/api/v1/products/...`. **If `API_URL` does not end in `/api/v1`, stop and report it** rather than guessing a prefix.

- [ ] **Step 3: Verify it compiles**

Run: `pnpm lint && pnpm build`
Expected: both succeed. A `"use server"` file may only export async functions — if the build complains about a non-async export, a helper leaked out of the module; move it to `lib/comparison.ts`.

- [ ] **Step 4: Smoke-test both endpoints against the real API**

With the backend running, and reading `API_URL` from the env file the app uses:

```bash
API=$(grep -h '^API_URL=' .env .env.local 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"')
echo "base: $API"
curl -s "$API/products/multi-store?page=0&size=3&sort=SAVINGS_PCT" | head -c 1200; echo
```
Expected: JSON with `products`, `allItems`, `numberOfPages`. Note one `product.id` from the output, then:

```bash
curl -s "$API/products/<that-id>?days=365" | head -c 1200; echo
```
Expected: JSON with `listings`, each carrying `storeProductId`, `store`, `priceHistory`.

Record `allItems` — later tasks' empty-state checks need to know the corpus is non-empty. If the API is unreachable, note it and continue; every page degrades to an empty state by design.

- [ ] **Step 5: Commit**

```bash
git add actions/comparison.actions.ts
git commit -m "feat: multi-store and product-comparison server actions"
```

---

### Task 5: `StoreLogos` — the shared logo cluster

**Files:**
- Create: `components/shared/StoreLogos.tsx`

**Interfaces:**
- Consumes: `STORE_LOGOS`, `StoreName` from `lib/store.ts`; `cn` from `lib/utils.ts`.
- Produces: `<StoreLogos stores={StoreName[]} max?={number} size?={"sm" | "md" | "lg"} overlap?={boolean} className?={string} />`

- [ ] **Step 1: Write the component**

Create `components/shared/StoreLogos.tsx`:

```tsx
import Image from "next/image";
import { STORE_LOGOS, type StoreName } from "@/lib/store";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "w-6 h-6", px: 16 },
  md: { box: "w-7 h-7", px: 20 },
  lg: { box: "w-9 h-9", px: 24 },
} as const;

interface StoreLogosProps {
  /** Resolved store names. An unknown id must be filtered out before this. */
  stores: StoreName[];
  /**
   * Logos to draw before collapsing the rest into a "+N" chip. A 256px card
   * cannot show five logos beside a price, and five overlapping circles read
   * as a smudge rather than as five stores.
   */
  max?: number;
  size?: keyof typeof SIZES;
  /** Overlapping stack (rows, detail hero) vs. a spaced row (grid cards). */
  overlap?: boolean;
  className?: string;
}

/**
 * The store-logo cluster shown wherever one article belongs to several stores.
 *
 * Deliberately not retrofitted into ProductCard/ProductCardList, which have
 * their own inline single-logo markup: those two files are frozen for this
 * feature, because leaving them untouched is what guarantees /search and
 * /popular keep linking to the single-listing page.
 */
export function StoreLogos({
  stores,
  max = 4,
  size = "md",
  overlap = false,
  className,
}: StoreLogosProps) {
  if (stores.length === 0) return null;

  const { box, px } = SIZES[size];
  const shown = stores.slice(0, max);
  const hidden = stores.length - shown.length;

  return (
    <div
      className={cn("flex items-center", overlap ? "-space-x-2" : "gap-1", className)}
      // One label for the whole cluster: five nested title attributes are
      // unreadable, and each logo already carries its store name as alt text.
      aria-label={`Na voljo v: ${stores.map((s) => STORE_LOGOS[s].label).join(", ")}`}
    >
      {shown.map((store) => {
        const { label, logoUrl } = STORE_LOGOS[store];
        return (
          <div
            key={store}
            className={cn(
              box,
              "rounded-full bg-card border border-border/20 flex items-center justify-center overflow-hidden shadow-sm shrink-0",
              overlap && "border-2 border-card",
            )}
            title={label}
          >
            <Image
              src={logoUrl}
              alt={label}
              width={px}
              height={px}
              className="w-full h-full object-contain p-0.5"
            />
          </div>
        );
      })}

      {hidden > 0 && (
        <div
          className={cn(
            box,
            "rounded-full bg-secondary border border-border/20 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0",
            overlap && "border-2 border-card",
          )}
          aria-hidden
        >
          +{hidden}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm lint && pnpm build`
Expected: both succeed. It is unreferenced so far; Next tree-shakes it out of the bundle.

- [ ] **Step 3: Commit**

```bash
git add components/shared/StoreLogos.tsx
git commit -m "feat: shared store-logo cluster with overflow chip"
```

---

### Task 6: `MultiStoreProductCard` — the grid card

**Files:**
- Create: `components/shared/MultiStoreProductCard.tsx`

**Interfaces:**
- Consumes: `StoreLogos` (Task 5), `ProductImage`, `formatEurAmount`, `StoreName`.
- Produces: the `MultiStoreCardProps` interface, exported, and the default-exported component. Task 8's `multiStoreCardProps` mapper produces exactly this shape, and Task 7's row card consumes the same interface.

```ts
export interface MultiStoreCardProps {
  /** product.id — the /primerjava href. NEVER a storeProductId. */
  productId: number;
  imageUrl: string;
  brandName: string;
  productName: string;
  /** Pre-formatted, e.g. "1,5 L". Absent when the group has no agreed size. */
  size?: string;
  /** Pre-formatted and DERIVED, e.g. "1,19 €/L". */
  pricePerUnit?: string;
  pricePerUnitAria?: string;
  /** Raw euro amount; the card formats it. */
  minPrice: number;
  /** Absent when the stock rules say the badge must not show. */
  savingsPct?: number;
  storeCount: number;
  stores: StoreName[];
  /** e.g. "Lidl". Absent when cheapestStoreId is not in STORE_MAP. */
  cheapestStoreLabel?: string;
  /** The single stock line, already resolved. */
  stockNote?: string;
}
```

- [ ] **Step 1: Write the component**

Create `components/shared/MultiStoreProductCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ProductImage } from "@/components/shared/ProductImage";
import { StoreLogos } from "@/components/shared/StoreLogos";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatEurAmount } from "@/lib/format";
import type { StoreName } from "@/lib/store";

export interface MultiStoreCardProps {
  /** product.id — the /primerjava href. NEVER a storeProductId. */
  productId: number;
  imageUrl: string;
  brandName: string;
  productName: string;
  /** Pre-formatted, e.g. "1,5 L". Absent when the group has no agreed size. */
  size?: string;
  /**
   * Pre-formatted, e.g. "1,19 €/L", and DERIVED from minPrice rather than read
   * off a listing — the list endpoint sends no pricePerUnit. It can differ by
   * a cent from the detail page's scraped figure; see derivePricePerUnit.
   */
  pricePerUnit?: string;
  pricePerUnitAria?: string;
  /** Raw euro amount. The card formats it; callers must not pre-format. */
  minPrice: number;
  /** Absent when the stock rules say the badge must not show. */
  savingsPct?: number;
  storeCount: number;
  stores: StoreName[];
  /** e.g. "Lidl". Absent when cheapestStoreId is not in STORE_MAP. */
  cheapestStoreLabel?: string;
  /** The single stock line, already resolved by stockDisplay. */
  stockNote?: string;
}

/**
 * Grid card for an article several stores carry.
 *
 * Two deliberate differences from ProductCard:
 *
 *  - It links to /primerjava/{product.id}, a different id space from
 *    /product/{storeProductId}. Both are bare integers, so this must never be
 *    handed an `item.id`.
 *  - There is no "+" button. A group has no single price to add, and picking a
 *    store silently is the one thing this feature exists to stop. The choice
 *    happens on the comparison page, so the whole card is one link and the
 *    price block takes the full width.
 *
 * Same 256x380 frame as ProductCard so the two never disagree in a mixed
 * layout.
 */
export default function MultiStoreProductCard({
  productId,
  imageUrl,
  brandName,
  productName,
  size,
  pricePerUnit,
  pricePerUnitAria,
  minPrice,
  savingsPct,
  storeCount,
  stores,
  cheapestStoreLabel,
  stockNote,
}: MultiStoreCardProps) {
  return (
    <Link
      href={`/primerjava/${productId}`}
      className="group w-64 h-[380px] bg-card rounded-xl p-5 transition-all duration-300 hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.06)] flex flex-col"
    >
      <div className="relative aspect-square mb-4 bg-card rounded-lg flex items-center justify-center overflow-hidden border border-border/10">
        <ProductImage
          src={imageUrl}
          alt={productName}
          sizes="(max-width: 640px) 50vw, 240px"
          className="w-4/5 h-4/5 object-contain transition-transform duration-500 group-hover:scale-110"
          iconClassName="size-12"
        />

        {/* Absent, not dimmed, when the cheapest listing is unbuyable: an
            unbuyable headline saving is worse than no headline. The caller has
            already applied that rule by omitting savingsPct. */}
        {savingsPct != null && savingsPct > 0 && (
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold tracking-tight bg-primary text-primary-foreground">
            prihrani {Math.round(savingsPct)}%
          </div>
        )}

        <StoreLogos
          stores={stores}
          max={4}
          size="md"
          className="absolute top-3 right-3"
        />
      </div>

      <div className="grow">
        {/* Brand left, size right — brand truncates so the size stays pinned to
            the edge instead of pushing out of the card. */}
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold truncate min-w-0">
            {brandName}
          </p>
          {size && (
            <p className="text-[10px] text-muted-foreground font-semibold shrink-0">
              {size}
            </p>
          )}
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <h3 className="text-lg font-semibold text-foreground leading-snug mb-4 group-hover:text-primary transition-colors truncate cursor-default">
                {productName}
              </h3>
            </TooltipTrigger>
            <TooltipContent>{productName}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* No button, so this block spans the card rather than sharing a row. */}
      <div className="mt-auto">
        <p className="text-2xl font-bold text-foreground">
          <span className="text-sm font-semibold text-muted-foreground mr-1">
            od
          </span>
          {formatEurAmount(minPrice)} &euro;
        </p>

        <p className="text-[11px] text-muted-foreground font-semibold mt-0.5 truncate">
          {cheapestStoreLabel && <>najceneje v {cheapestStoreLabel}</>}
          {cheapestStoreLabel && pricePerUnit && " · "}
          {pricePerUnit && (
            <span aria-label={pricePerUnitAria}>{pricePerUnit}</span>
          )}
          {!cheapestStoreLabel && !pricePerUnit && (
            <>v {storeCount === 1 ? "1 trgovini" : `${storeCount} trgovinah`}</>
          )}
        </p>

        {stockNote && (
          <p className="text-[11px] text-accent-foreground font-semibold mt-0.5 truncate">
            {stockNote}
          </p>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm lint && pnpm build`
Expected: both succeed.

- [ ] **Step 3: Confirm the frozen files are still frozen**

```bash
git status --porcelain components/shared/ProductCard.tsx components/shared/ProductCardList.tsx
```
Expected: no output. Any output means the non-goal has been violated — revert those files.

- [ ] **Step 4: Commit**

```bash
git add components/shared/MultiStoreProductCard.tsx
git commit -m "feat: multi-store grid card"
```

---

### Task 7: `MultiStoreProductCardList` — the row card

**Files:**
- Create: `components/shared/MultiStoreProductCardList.tsx`

**Interfaces:**
- Consumes: `MultiStoreCardProps` from Task 6 (re-exported type import), `StoreLogos`, `ProductImage`, `formatEurAmount`.
- Produces: default-exported component taking the identical `MultiStoreCardProps`.

- [ ] **Step 1: Write the component**

Create `components/shared/MultiStoreProductCardList.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ProductImage } from "@/components/shared/ProductImage";
import { StoreLogos } from "@/components/shared/StoreLogos";
import { formatEurAmount } from "@/lib/format";
import type { MultiStoreCardProps } from "@/components/shared/MultiStoreProductCard";

/**
 * Row layout for an article several stores carry — ProductCardList's frame
 * minus the cart button, for the same reason MultiStoreProductCard has no "+".
 *
 * Takes the exact same props as the grid card so MultiStoreResults can feed
 * both from one mapper and they cannot drift apart.
 */
export default function MultiStoreProductCardList({
  productId,
  imageUrl,
  brandName,
  productName,
  size,
  pricePerUnit,
  pricePerUnitAria,
  minPrice,
  savingsPct,
  storeCount,
  stores,
  cheapestStoreLabel,
  stockNote,
}: MultiStoreCardProps) {
  return (
    <Link
      href={`/primerjava/${productId}`}
      className="group block bg-card rounded-xl p-4 shadow-[0_4px_20px_rgba(62,39,35,0.08)] hover:ring-1 hover:ring-primary/40 transition-all"
    >
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="relative w-20 h-20 sm:w-28 sm:h-28 shrink-0 bg-card rounded-lg flex items-center justify-center overflow-visible">
          <ProductImage
            src={imageUrl}
            alt={productName}
            sizes="112px"
            className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
            iconClassName="size-10"
          />

          {savingsPct != null && savingsPct > 0 && (
            <div className="absolute -top-1 -left-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-tight bg-primary text-primary-foreground">
              -{Math.round(savingsPct)}%
            </div>
          )}

          {/* Logos ride under the thumbnail on phones, where the right-hand
              column is hidden — the same place ProductCardList puts its one. */}
          <StoreLogos
            stores={stores}
            max={3}
            size="sm"
            overlap
            className="absolute -bottom-1 -right-1 sm:hidden"
          />
        </div>

        <div className="grow min-w-0 flex flex-col gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate min-w-0">
                {brandName}
              </span>
              {size && (
                <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                  {size}
                </span>
              )}
            </div>
            <h4 className="text-base sm:text-xl font-extrabold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
              {productName}
            </h4>
          </div>

          {/* Mobile price block. The sm+ column below carries the same numbers. */}
          <div className="flex flex-col items-start gap-1 sm:hidden">
            <span className="text-lg font-bold text-foreground">
              <span className="text-xs font-semibold text-muted-foreground mr-1">
                od
              </span>
              {formatEurAmount(minPrice)} &euro;
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground truncate max-w-full">
              {cheapestStoreLabel && <>najceneje v {cheapestStoreLabel}</>}
              {cheapestStoreLabel && pricePerUnit && " · "}
              {pricePerUnit && (
                <span aria-label={pricePerUnitAria}>{pricePerUnit}</span>
              )}
            </span>
            {stockNote && (
              <span className="text-[11px] font-semibold text-accent-foreground">
                {stockNote}
              </span>
            )}
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-2 shrink-0 min-w-[200px]">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-2xl font-bold text-foreground">
              <span className="text-sm font-semibold text-muted-foreground mr-1">
                od
              </span>
              {formatEurAmount(minPrice)} &euro;
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {cheapestStoreLabel && <>najceneje v {cheapestStoreLabel}</>}
              {cheapestStoreLabel && pricePerUnit && " · "}
              {pricePerUnit && (
                <span aria-label={pricePerUnitAria}>{pricePerUnit}</span>
              )}
            </span>
            {stockNote && (
              <span className="text-[11px] font-semibold text-accent-foreground">
                {stockNote}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {storeCount === 1 ? "1 trgovina" : `${storeCount} trgovin`}
            </span>
            <StoreLogos stores={stores} max={5} size="lg" overlap />
          </div>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm lint && pnpm build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add components/shared/MultiStoreProductCardList.tsx
git commit -m "feat: multi-store row card"
```

---

### Task 8: `MultiStoreResults` + skeleton, and the one card-props mapper

**Files:**
- Create: `components/shared/MultiStoreResults.tsx`
- Create: `components/shared/MultiStoreResultsSkeleton.tsx`

**Interfaces:**
- Consumes: both card components, `Pagination`, `stockDisplay` and `derivePricePerUnit` from `lib/comparison.ts`, `STORE_MAP` from `types/search.types.ts`, `formatSize`/`formatPricePerUnit`/`pricePerUnitAriaLabel` from `lib/format.ts`.
- Produces:
  - `multiStoreCardProps(row: MultiStoreProduct): MultiStoreCardProps` — **exported**, and imported by the home rail in Task 11. This is the single place a wire row becomes card props.
  - `<MultiStoreResults items={MultiStoreProduct[]} currentPage={number} totalPages={number} viewParam={"grid" | "list" | null} />`
  - `<MultiStoreResultsSkeleton view? cardCount? rowCount? />`

- [ ] **Step 1: Write the results component and mapper**

Create `components/shared/MultiStoreResults.tsx`:

```tsx
import MultiStoreProductCard, {
  type MultiStoreCardProps,
} from "@/components/shared/MultiStoreProductCard";
import MultiStoreProductCardList from "@/components/shared/MultiStoreProductCardList";
import { Pagination } from "@/components/shared/Pagination";
import { derivePricePerUnit, stockDisplay } from "@/lib/comparison";
import {
  formatPricePerUnit,
  formatSize,
  pricePerUnitAriaLabel,
} from "@/lib/format";
import { STORE_LOGOS } from "@/lib/store";
import { cn } from "@/lib/utils";
import { STORE_MAP } from "@/types/search.types";
import type { MultiStoreProduct } from "@/types/comparison.types";

/**
 * The single wire-row-to-card-props mapper for multi-store rows.
 *
 * Exported because the home rail renders the same cards from the same endpoint
 * and must not grow a second copy of this logic — /search, /popular and
 * /product each already carry their own `cardProps`, and keeping those three in
 * agreement has been a recurring cost.
 */
export function multiStoreCardProps(row: MultiStoreProduct): MultiStoreCardProps {
  // Bare ids on the list endpoint (only the detail response embeds a store
  // object). An id absent from STORE_MAP renders no logo rather than throwing:
  // ids come from a database identity column, so a new retailer can appear
  // before this build knows its name.
  const stores = row.storeIds
    .map((id) => STORE_MAP[id])
    .filter((name): name is NonNullable<typeof name> => Boolean(name));

  const cheapestStore = STORE_MAP[row.cheapestStoreId];

  // Derived, not read: the list endpoint sends no pricePerUnit. Can differ by a
  // cent from the detail page's scraped value — see derivePricePerUnit.
  const derived = derivePricePerUnit(
    row.minPrice,
    row.totalQuantity,
    row.baseUnit,
  );

  const { note, showSavingsBadge } = stockDisplay(row);

  return {
    // product.id, NOT a storeProductId. This is the /primerjava href.
    productId: row.product.id,
    imageUrl: row.product?.imageUrl ?? "",
    brandName: row.product?.brand?.name ?? "",
    productName: row.product?.title ?? row.product?.name ?? "",
    size: formatSize(row.totalQuantity, row.baseUnit) ?? undefined,
    pricePerUnit: formatPricePerUnit(derived, row.baseUnit) ?? undefined,
    pricePerUnitAria: pricePerUnitAriaLabel(derived, row.baseUnit) ?? undefined,
    minPrice: row.minPrice,
    savingsPct: showSavingsBadge ? row.savingsPct : undefined,
    storeCount: row.storeCount,
    stores,
    cheapestStoreLabel: cheapestStore
      ? STORE_LOGOS[cheapestStore].label
      : undefined,
    stockNote: note ?? undefined,
  };
}

interface MultiStoreResultsProps {
  items: MultiStoreProduct[];
  currentPage: number;
  totalPages: number;
  /**
   * The `view` param, or null when the visitor has not chosen — which the
   * server cannot resolve, because it does not know the viewport. With null,
   * both layouts render and CSS picks at `sm`, exactly as /search does, so
   * results never flash as rows before becoming cards.
   */
  viewParam: "grid" | "list" | null;
}

export function MultiStoreResults({
  items,
  currentPage,
  totalPages,
  viewParam,
}: MultiStoreResultsProps) {
  return (
    <>
      {viewParam !== "list" && (
        <div
          className={cn(
            "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 justify-items-center",
            viewParam === null && "hidden sm:grid",
          )}
        >
          {items.map((row) => (
            <MultiStoreProductCard
              key={row.product.id}
              {...multiStoreCardProps(row)}
            />
          ))}
        </div>
      )}

      {viewParam !== "grid" && (
        <div className={cn("space-y-4", viewParam === null && "sm:hidden")}>
          {items.map((row) => (
            <MultiStoreProductCardList
              key={row.product.id}
              {...multiStoreCardProps(row)}
            />
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} />
    </>
  );
}
```

- [ ] **Step 2: Write the skeleton**

Create `components/shared/MultiStoreResultsSkeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MultiStoreResultsSkeletonProps {
  /** Mirrors the real results: null renders both and lets CSS pick at `sm`. */
  view?: "grid" | "list" | null;
  cardCount?: number;
  rowCount?: number;
}

/**
 * Matches MultiStoreProductCard's box model, not ProductCard's: there is no
 * round button in the bottom-right, and the price block spans the card, so
 * reusing SearchResultsSkeleton would settle into a different layout than the
 * one that lands.
 */
function CardShell() {
  return (
    <div className="w-64 h-[380px] bg-card rounded-xl p-5 flex flex-col">
      <Skeleton className="aspect-square w-full rounded-lg mb-4" />
      <Skeleton className="h-3 w-20 rounded mb-2" />
      <Skeleton className="h-5 w-full rounded mb-4" />
      <div className="mt-auto space-y-1.5">
        <Skeleton className="h-7 w-28 rounded" />
        <Skeleton className="h-3 w-36 rounded" />
      </div>
    </div>
  );
}

function RowShell() {
  return (
    <div className="bg-card rounded-xl p-4 flex items-center gap-4">
      <Skeleton className="w-20 h-20 sm:w-28 sm:h-28 rounded-lg shrink-0" />
      <div className="grow min-w-0 flex flex-col gap-2">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="h-3 w-32 rounded sm:hidden" />
      </div>
      <div className="hidden sm:flex flex-col items-end gap-2 shrink-0 min-w-[200px]">
        <Skeleton className="h-8 w-28 rounded" />
        <Skeleton className="h-3 w-36 rounded" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
    </div>
  );
}

export function MultiStoreResultsSkeleton({
  view = null,
  cardCount = 12,
  rowCount = 6,
}: MultiStoreResultsSkeletonProps) {
  return (
    <>
      {view !== "list" && (
        <div
          className={cn(
            "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 justify-items-center",
            view === null && "hidden sm:grid",
          )}
        >
          {Array.from({ length: cardCount }, (_, i) => (
            <CardShell key={i} />
          ))}
        </div>
      )}

      {view !== "grid" && (
        <div className={cn("space-y-4", view === null && "sm:hidden")}>
          {Array.from({ length: rowCount }, (_, i) => (
            <RowShell key={i} />
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm lint && pnpm build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add components/shared/MultiStoreResults.tsx components/shared/MultiStoreResultsSkeleton.tsx
git commit -m "feat: multi-store results layouts and skeleton"
```

---

### Task 9: `MultiStoreFilters`

**Files:**
- Create: `components/shared/MultiStoreFilters.tsx`

**Interfaces:**
- Consumes: `CategoryMultiSelect`, the shadcn `Select` primitives, `VALID_MULTI_STORE_SORTS`/`DEFAULT_MULTI_STORE_SORT`, `Category` from `types/search.types.ts`.
- Produces: `<MultiStoreFilters categories={Category[]} />`; `SORT_LABELS` exported for reuse by the page header.

- [ ] **Step 1: Write the component**

Create `components/shared/MultiStoreFilters.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryMultiSelect } from "@/components/shared/CategoryMultiSelect";
import { cn } from "@/lib/utils";
import {
  DEFAULT_MULTI_STORE_SORT,
  VALID_MULTI_STORE_SORTS,
  type MultiStoreSort,
} from "@/types/comparison.types";
import type { Category } from "@/types/search.types";

// Same classes SearchFilters uses; border-transparent in the base keeps the
// button from shifting 1px when the active state adds its border.
const TOGGLE_BASE =
  "p-2 rounded-lg border border-transparent transition-colors cursor-pointer";
const TOGGLE_ON = "bg-card text-primary border-primary/30";
const TOGGLE_OFF = "text-muted-foreground/40 hover:text-primary";

/**
 * Benefit-led labels, not field names: each sort has ONE baked-in direction, so
 * "Cena" alone would quietly mean "cheapest first" with no way to say so.
 */
export const SORT_LABELS: Record<MultiStoreSort, string> = {
  SAVINGS_PCT: "Največji prihranek",
  STORE_COUNT: "V največ trgovinah",
  MIN_PRICE: "Najcenejši",
  NAME: "Po abecedi",
};

export const SEARCH_PLACEHOLDER = "Išči med izdelki v več trgovinah…";

interface MultiStoreFiltersProps {
  /** Flat list from GET /categories. Empty when the endpoint fails or 204s. */
  categories: Category[];
}

/**
 * Exactly the controls GET /products/multi-store accepts, and no others.
 *
 * There is deliberately no store filter, availability toggle or card-discount
 * toggle: the endpoint accepts none of them, and applying them client-side
 * would filter only the 50 rows on screen while the header count and the
 * pagination kept describing the whole result — a filter that lies.
 */
export function MultiStoreFilters({ categories }: MultiStoreFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sortParam = searchParams.get("sort");
  const sort: MultiStoreSort = VALID_MULTI_STORE_SORTS.includes(
    sortParam as MultiStoreSort,
  )
    ? (sortParam as MultiStoreSort)
    : DEFAULT_MULTI_STORE_SORT;

  const categoriesParam = searchParams.get("categories");
  const selectedCategories = categoriesParam
    ? categoriesParam
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
    : [];

  const viewParamRaw = searchParams.get("view");
  const view = viewParamRaw === "grid" || viewParamRaw === "list" ? viewParamRaw : null;

  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  // Keeps the field honest when the URL changes from outside this component —
  // a back/forward navigation, or the empty state's clear-filters link.
  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  /**
   * `resetPage` is false only for `view`, which re-renders from data already on
   * the page. Every other control changes which rows exist, so the offset is
   * stale and must go — otherwise narrowing a 15-page result while on page 12
   * lands on an empty page.
   */
  function commit(
    changes: Record<string, string | null>,
    resetPage: boolean = true,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    if (resetPage) params.delete("page");
    const qs = params.toString();
    // replace, not push: filter changes should not each become a back-button stop.
    router.replace(qs ? `/primerjava?${qs}` : "/primerjava");
  }

  return (
    <div className="space-y-4">
      {/* Its own input rather than the header SearchBar, which hardcodes
          /search and clears itself off that route — it cannot serve this page. */}
      <div className="relative max-w-xl">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit({ q: query.trim() || null });
          }}
          onBlur={() => {
            const current = searchParams.get("q") ?? "";
            if (query.trim() !== current) commit({ q: query.trim() || null });
          }}
          placeholder={SEARCH_PLACEHOLDER}
          aria-label={SEARCH_PLACEHOLDER}
          className="pl-9"
        />
      </div>

      <div className="bg-secondary p-4 rounded-xl border border-border/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <CategoryMultiSelect
              categories={categories}
              selected={selectedCategories}
              onCommit={(ids) =>
                commit({ categories: ids.length ? ids.join(",") : null })
              }
            />

            {/* No direction control beside it: each option has exactly one
                useful direction, and the endpoint has no `direction` param. */}
            <Select
              value={sort}
              onValueChange={(value) => commit({ sort: value })}
            >
              <SelectTrigger className="w-[190px]" aria-label="Razvrsti">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VALID_MULTI_STORE_SORTS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {SORT_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => commit({ view: "grid" }, false)}
              aria-label="Mrežni prikaz"
              aria-pressed={view === "grid"}
              className={cn(TOGGLE_BASE, view === "grid" ? TOGGLE_ON : TOGGLE_OFF)}
            >
              <LayoutGrid className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => commit({ view: "list" }, false)}
              aria-label="Seznamski prikaz"
              aria-pressed={view === "list"}
              className={cn(TOGGLE_BASE, view === "list" ? TOGGLE_ON : TOGGLE_OFF)}
            >
              <List className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm lint && pnpm build`
Expected: both succeed. If `CategoryMultiSelect`'s prop names differ from `categories` / `selected` / `onCommit`, read `components/shared/CategoryMultiSelect.tsx` and match it exactly — do not modify that file.

- [ ] **Step 3: Commit**

```bash
git add components/shared/MultiStoreFilters.tsx
git commit -m "feat: multi-store filter bar"
```

---

### Task 10: The `/primerjava` list page — first browser milestone

**Files:**
- Create: `app/(main)/primerjava/page.tsx`
- Create: `app/(main)/primerjava/loading.tsx`

**Interfaces:**
- Consumes: `getMultiStoreProducts` (Task 4), `getCategories` from `actions/category.actions.ts`, `MultiStoreResults` + `MultiStoreResultsSkeleton` (Task 8), `MultiStoreFilters` (Task 9), `productCountLabel` from `lib/utils.ts`.
- Produces: the route. Nothing imports from it.

- [ ] **Step 1: Write the page**

Create `app/(main)/primerjava/page.tsx`:

```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { getMultiStoreProducts } from "@/actions/comparison.actions";
import { getCategories } from "@/actions/category.actions";
import { MultiStoreFilters } from "@/components/shared/MultiStoreFilters";
import { MultiStoreResults } from "@/components/shared/MultiStoreResults";
import { MultiStoreResultsSkeleton } from "@/components/shared/MultiStoreResultsSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { productCountLabel } from "@/lib/utils";
import {
  DEFAULT_MULTI_STORE_SORT,
  VALID_MULTI_STORE_SORTS,
  type MultiStoreProductPage,
  type MultiStoreSort,
} from "@/types/comparison.types";

const PAGE_SIZE = 50;

// Module-local, not exported: Next validates a page module's export surface,
// and an unrecognised named export can fail the build. Nothing outside this
// file needs them — the home rail writes its own copy in app/(main)/page.tsx.
const PAGE_TITLE = "Isti izdelek, več cen";

/**
 * Three empty states, not one.
 *
 * This corpus is ~727 articles against ~36k in the catalogue — most articles
 * are carried by a single store and never appear here — so a category filter
 * empties the page routinely. A generic "ni rezultatov" would read as a bug.
 */
const EMPTY_QUERY = (query: string) =>
  `Ni rezultatov za „${query}" med izdelki, ki jih prodaja več trgovin.`;
const EMPTY_CATEGORY =
  "V izbranih kategorijah ni izdelkov, ki bi jih prodajalo več trgovin.";
const EMPTY_NONE =
  "Trenutno ni izdelkov, ki bi jih prodajalo več trgovin.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description:
    "Izdelki, ki jih prodaja več trgovin — primerjajte ceno pri vsaki od njih.",
};

/**
 * The count, split out so it can sit behind its own Suspense boundary: it lives
 * in the header, above the filters, which must stay mounted.
 */
async function ResultsCount({
  promise,
}: {
  promise: Promise<MultiStoreProductPage>;
}) {
  const { allItems } = await promise;

  if (allItems === 0) {
    return (
      <p className="text-muted-foreground font-medium">{productCountLabel(0)}</p>
    );
  }

  return (
    <p className="text-muted-foreground font-medium">
      {productCountLabel(allItems)} v več trgovinah
    </p>
  );
}

async function Results({
  promise,
  query,
  hasCategoryFilter,
  viewParam,
}: {
  promise: Promise<MultiStoreProductPage>;
  query: string;
  hasCategoryFilter: boolean;
  viewParam: "grid" | "list" | null;
}) {
  const response = await promise;

  if (response.products.length === 0) {
    const message = query
      ? EMPTY_QUERY(query)
      : hasCategoryFilter
        ? EMPTY_CATEGORY
        : EMPTY_NONE;

    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 text-center px-4">
        <PackageSearch size={48} strokeWidth={1.5} />
        <p className="text-lg max-w-md">{message}</p>
        {(query || hasCategoryFilter) && (
          <Link
            href="/primerjava"
            className="mt-2 text-sm font-semibold text-primary hover:underline"
          >
            Počisti filtre
          </Link>
        )}
      </div>
    );
  }

  return (
    <MultiStoreResults
      items={response.products}
      currentPage={response.currentPage}
      totalPages={response.numberOfPages}
      viewParam={viewParam}
    />
  );
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PrimerjavaPage({ searchParams }: Props) {
  const params = await searchParams;

  const query = typeof params.q === "string" ? params.q.trim() : "";

  // Validated, not just defaulted: ?sort=xyz reaching the Select renders a
  // blank trigger, which is how the same bug shipped on /search once.
  const sort: MultiStoreSort = VALID_MULTI_STORE_SORTS.includes(
    params.sort as MultiStoreSort,
  )
    ? (params.sort as MultiStoreSort)
    : DEFAULT_MULTI_STORE_SORT;

  // The positive-integer test rejects the NaN from ?categories=abc, the 0 from
  // a hand-edited URL, and non-integers/Infinity.
  const categoryIds =
    typeof params.categories === "string"
      ? params.categories
          .split(",")
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
      : [];

  const currentPage = Math.max(
    0,
    parseInt(typeof params.page === "string" ? params.page : "0", 10) || 0,
  );

  const viewParam =
    params.view === "grid" || params.view === "list" ? params.view : null;

  // Deliberately not awaited: the two boundaries below await it, so the header
  // and filters stream immediately. getMultiStoreProducts swallows its own
  // errors and resolves to an empty page, so this floating promise can never
  // become an unhandled rejection.
  const responsePromise = getMultiStoreProducts({
    page: currentPage,
    size: PAGE_SIZE,
    sort,
    query,
    // undefined, not [] — omitted means "every category" server-side, while an
    // empty array on the wire would mean the opposite of a filter.
    categoryIds: categoryIds.length ? categoryIds : undefined,
  });

  const categories = await getCategories();

  // Changing this key remounts both boundaries, which is what makes the
  // skeletons reappear on a filter change: router.replace() is a same-route
  // navigation, so loading.tsx does not re-run and an already-mounted boundary
  // would keep showing stale rows for the whole request. `view` is excluded on
  // purpose — it re-renders from data already on the page and must not flash.
  const resultsKey = JSON.stringify([query, sort, categoryIds, currentPage]);

  return (
    <div className="px-4 sm:px-6 lg:px-20 py-6 space-y-6">
      <header className="mb-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1 break-words">
          {PAGE_TITLE}
        </h1>
        {/* h-6 wrapper, not a bare h-5 bar: the real <p> line box is 24px, and a
            shorter placeholder pulls the filter row up 4px when the count lands. */}
        <Suspense
          key={resultsKey}
          fallback={
            <div className="h-6 flex items-center">
              <Skeleton className="h-4 w-48 rounded" />
            </div>
          }
        >
          <ResultsCount promise={responsePromise} />
        </Suspense>
      </header>

      <MultiStoreFilters categories={categories} />

      <Suspense
        key={resultsKey}
        fallback={<MultiStoreResultsSkeleton view={viewParam} />}
      >
        <Results
          promise={responsePromise}
          query={query}
          hasCategoryFilter={categoryIds.length > 0}
          viewParam={viewParam}
        />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 2: Write the route skeleton**

Create `app/(main)/primerjava/loading.tsx`:

```tsx
import { MultiStoreResultsSkeleton } from "@/components/shared/MultiStoreResultsSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function PrimerjavaLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-20 py-6 space-y-6">
      <header className="mb-2">
        {/* Mirrors the real header's boxes — h1 line box 36px + mb-1, then a
            24px line — so handing over to the page does not shift the layout. */}
        <Skeleton className="h-9 w-72 rounded-lg mb-1" />
        <div className="h-6 flex items-center">
          <Skeleton className="h-4 w-48 rounded" />
        </div>
      </header>

      <div className="space-y-4">
        <Skeleton className="h-9 w-full max-w-xl rounded-md" />
        <div className="bg-secondary p-4 rounded-xl border border-border/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <Skeleton className="h-9 w-[170px] rounded-md" />
              <Skeleton className="h-9 w-[190px] rounded-md" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* No view param is readable here, so this mirrors the page's null case. */}
      <MultiStoreResultsSkeleton view={null} />
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `pnpm lint && pnpm build`
Expected: both succeed, and the build output lists `/primerjava` as a route.

- [ ] **Step 4: Verify in Chrome**

Start the dev server (`pnpm dev`) and open `http://localhost:3000/primerjava`. Check, in order:

1. Header reads **Isti izdelek, več cen**, then "N izdelkov v več trgovinah" with N > 0.
2. Cards show `od X €`, a cheapest-store line, 2+ store logos, and **no round `+` button anywhere**.
3. Clicking a card lands on `/primerjava/<id>` — a 404 for now, which is expected until Task 14. **Note the id**: it must match a `product.id` from the list payload, not a `storeProductId`.
4. Change the sort to each of the four options — the order visibly changes each time, and a skeleton appears while it reloads.
5. Pick a category — rows narrow, skeleton flashes, `?categories=` appears in the URL, and `page` is dropped if it was set.
6. Type a term and press Enter — `?q=` appears, results narrow.
7. Search for `zzzznotathing` — the query empty state and a working "Počisti filtre" link.
8. Toggle grid/list — layout switches with **no skeleton flash**, and the URL gains `?view=`.
9. Resize below 640px with no `view` param — rows, not cards; above it, cards.
10. Page to the last page via the pagination, then to page 1.
11. Read the console: no React key warnings, no hydration errors.

If the API is unreachable, expect the `EMPTY_NONE` state rather than an error page — that is correct behaviour, but note it and revisit the visual checks once the backend is up.

- [ ] **Step 5: Commit**

```bash
git add "app/(main)/primerjava/page.tsx" "app/(main)/primerjava/loading.tsx"
git commit -m "feat: /primerjava multi-store list page"
```

---

### Task 11: The home rail

**Files:**
- Modify: `components/shared/ProductScrollSection.tsx`
- Modify: `app/(main)/page.tsx`

**Interfaces:**
- Consumes: `multiStoreCardProps` from `components/shared/MultiStoreResults.tsx` (Task 8), `MultiStoreProductCard` (Task 6), `getMultiStoreProducts` (Task 4).
- Produces: `ProductScrollSection` gains an optional `multiStoreItems?: MultiStoreProduct[]` prop, mutually exclusive with `items`.

- [ ] **Step 1: Teach `ProductScrollSection` the second item shape**

In `components/shared/ProductScrollSection.tsx`:

1. Add to the imports:

```tsx
import MultiStoreProductCard from "@/components/shared/MultiStoreProductCard";
import { multiStoreCardProps } from "@/components/shared/MultiStoreResults";
import type { MultiStoreProduct } from "@/types/comparison.types";
```

2. Replace the props interface with:

```tsx
interface ProductScrollSectionProps {
  title: string;
  subtitle: string;
  /**
   * Store listings — the original shape. Mutually exclusive with
   * multiStoreItems: a rail shows one kind of card, because the two link into
   * different id spaces and a mixed rail would be unreadable.
   */
  items?: DiscountItem[];
  /** Multi-store groups. Rendered as MultiStoreProductCard, which has no "+". */
  multiStoreItems?: MultiStoreProduct[];
  badgeVariant?: "discount" | "increase";
  /**
   * Full listing page for this section. Optional because not every section has
   * one — "Sorodni izdelki" has no destination.
   */
  moreHref?: string;
}
```

3. Change the destructuring to `items = [], multiStoreItems = [], ...` and replace the `hasItems` line with:

```tsx
  // Nothing to show (e.g. a transient API outage) — hide the whole section
  // rather than leave a stray header. This guard is why a failed multi-store
  // fetch degrades to no rail instead of an empty one.
  const count = items.length + multiStoreItems.length;
  if (count === 0) return null;
```

4. Change the `useEffect` dependency from `items.length` to `count`.

5. Inside the scroll track, keep the existing `items.map(...)` block exactly as it is and add this immediately after it, before the trailing spacer `<div className="shrink-0 w-4" />`:

```tsx
        {multiStoreItems.map((row) => (
          // product.id, not storeProductId — see the id-space note in the spec.
          <div key={row.product.id} className="shrink-0">
            <MultiStoreProductCard {...multiStoreCardProps(row)} />
          </div>
        ))}
```

- [ ] **Step 2: Swap the home rail**

In `app/(main)/page.tsx`:

1. Change the imports:

```tsx
import { getDiscounts, getMostPopular } from "@/actions/home.actions";
import { getMultiStoreProducts } from "@/actions/comparison.actions";
```

2. Replace the `Promise.all` with:

```tsx
  const [discounts, popular, multiStore] = await Promise.all([
    getDiscounts(),
    getMostPopular(),
    // Default sort: widest price spread first, which is the interesting slice.
    getMultiStoreProducts({ size: 20, sort: "SAVINGS_PCT" }),
  ]);
```

3. Replace the third `<ProductScrollSection>` (the `"Največje podražitve"` one) with:

```tsx
      <ProductScrollSection
        title="Isti izdelek, več cen"
        subtitle="Primerjajte cene med trgovinami"
        multiStoreItems={multiStore.products}
        moreHref="/primerjava"
      />
```

`getHighestPriceIncrease` in `actions/home.actions.ts` is now unreferenced. **Leave it.** The endpoint still exists and the rail may return elsewhere.

- [ ] **Step 3: Update the stale comment in `ProductScrollSection`**

The `moreHref` doc comment names "Največje podražitve" as a section with no destination. That section is gone; the comment now misleads. It is corrected by the interface replacement in Step 1 — confirm the phrase is absent:

```bash
grep -n "podražitve" components/shared/ProductScrollSection.tsx
```
Expected: no output.

- [ ] **Step 4: Build and verify in Chrome**

Run: `pnpm lint && pnpm build`, then open `http://localhost:3000/`.

1. The third rail reads **Isti izdelek, več cen** / **PRIMERJAJTE CENE MED TRGOVINAMI**.
2. There is no "Največje podražitve" rail anywhere on the page.
3. The rail has a `Več izdelkov →` link that goes to `/primerjava`.
4. Its cards have no `+` button; the first two rails' cards still do.
5. Left/right arrows scroll the rail and disable correctly at each end.
6. A card in the new rail links to `/primerjava/<id>`; a card in the first rail still links to `/product/<id>`.
7. Console: no key warnings.

- [ ] **Step 5: Commit**

```bash
git add components/shared/ProductScrollSection.tsx "app/(main)/page.tsx"
git commit -m "feat: replace the price-increase home rail with multi-store comparison"
```

---

### Task 12: `MultiStorePriceChart`

**Files:**
- Create: `components/shared/MultiStorePriceChart.tsx`

**Interfaces:**
- Consumes: `buildMultiStorePriceSeries`, `seriesKey`, `cardKey` (Task 3); `seriesVariants` (Task 2); `ChartConfig`/`ChartContainer`/`ChartTooltip` from `components/ui/chart.tsx` (`ChartTooltip` is Recharts' `Tooltip`, so it accepts any `content` element); `STORE_LOGOS`, `normalizeStoreName`, `CARD_DISCOUNT_CHART_NOTE`.
- Produces: `<MultiStorePriceChart listings={ProductComparisonListing[]} />`

- [ ] **Step 1: Write the component**

Create `components/shared/MultiStorePriceChart.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { CARD_DISCOUNT_CHART_NOTE } from "@/components/shared/CardDiscountMark";
import { formatEurAmount } from "@/lib/format";
import {
  buildMultiStorePriceSeries,
  cardKey,
  seriesKey,
} from "@/lib/price-history";
import { seriesVariants } from "@/lib/comparison";
import { STORE_LOGOS } from "@/lib/store";
import { cn, normalizeStoreName } from "@/lib/utils";
import type { ProductComparisonListing } from "@/types/comparison.types";

/**
 * No "Vse" option, unlike the single-store chart.
 *
 * `days` on GET /api/v1/products/{id} caps at 365 and the page requests the
 * maximum, so "1 leto" IS everything the API will give. A button promising
 * more than the data holds would be a lie, and there is no wider window to
 * fetch. `months: null` means "do not filter" — the whole fetched window.
 */
const PERIODS = [
  { label: "1 mes", months: 1 },
  { label: "3 mes", months: 3 },
  { label: "6 mes", months: 6 },
  { label: "1 leto", months: null },
] as const;

const DASH = "6 4";

function formatDate(time: number) {
  return new Date(time).toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "short",
  });
}

interface Series {
  key: string;
  cardFlagKey: string;
  storeProductId: number;
  /** "Lidl", or "Lidl (2)" for a store's second listing. */
  label: string;
  color: string;
  dashed: boolean;
  logoUrl: string | null;
}

interface MultiStorePriceChartProps {
  listings: ProductComparisonListing[];
}

/**
 * One step line per LISTING, coloured by store.
 *
 * A separate component from PriceHistoryChart rather than a mode on it:
 * that one takes a single PriceHistoryEntry[] and ships on /product/[id],
 * whose behaviour must not change.
 *
 * Three decisions worth not undoing:
 *
 *  - `stepAfter`, never a smoothed line. The price was flat between two
 *    readings, not sliding — the log records changes only.
 *  - One line per listing, not per store. ~7% of listings are within-store
 *    duplicates with different prices; collapsing them would hide a published
 *    price, which is exactly what the API refuses to do. A store's second
 *    listing shares its colour and is dashed.
 *  - The key is storeProductId. `store.id` is NOT unique across listings.
 */
export function MultiStorePriceChart({ listings }: MultiStorePriceChartProps) {
  const [months, setMonths] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const series: Series[] = useMemo(
    () =>
      seriesVariants(
        listings.map((listing) => ({
          storeProductId: listing.storeProductId,
          storeId: listing.store.id,
          storeName: listing.store.name,
        })),
      ).map((entry) => {
        const name = normalizeStoreName(entry.storeName);
        const info = name ? STORE_LOGOS[name] : undefined;
        return {
          key: seriesKey(entry.storeProductId),
          cardFlagKey: cardKey(entry.storeProductId),
          storeProductId: entry.storeProductId,
          // A store the app does not know still gets a line, labelled with
          // whatever the API called it — better than an unlabelled line.
          label:
            (info?.label ?? entry.storeName) +
            (entry.occurrence > 1 ? ` (${entry.occurrence})` : ""),
          color: info?.lineColor ?? "var(--muted-foreground)",
          dashed: entry.dashed,
          logoUrl: info?.logoUrl ?? null,
        };
      }),
    [listings],
  );

  const data = useMemo(
    () => buildMultiStorePriceSeries(listings, months),
    [listings, months],
  );

  // ChartContainer generates the CSS vars its children reference from this.
  const config: ChartConfig = useMemo(
    () =>
      Object.fromEntries(
        series.map((s) => [s.key, { label: s.label, color: s.color }]),
      ),
    [series],
  );

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Every listing had an empty priceHistory. Not a zero line — no chart.
  if (data.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-8 sm:p-12 border border-border/10 flex items-center justify-center">
        <p className="text-muted-foreground text-center">
          Za ta izdelek še ni podatkov o zgodovini cen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setMonths(p.months)}
            className={cn(
              "px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer",
              months === p.months
                ? "bg-primary text-primary-foreground hover:bg-primary/85"
                : "bg-secondary text-foreground hover:bg-primary/15 hover:text-primary",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Our own legend rather than Recharts' <Legend>: it carries store logos,
          shows the dash style that distinguishes a duplicate listing, and
          toggles a line off — with 5 step lines the chart needs that. */}
      <div className="flex flex-wrap gap-2">
        {series.map((s) => {
          const isHidden = hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              aria-pressed={!isHidden}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer",
                isHidden
                  ? "border-border/40 text-muted-foreground/60 bg-transparent"
                  : "border-border/40 text-foreground bg-card",
              )}
            >
              {s.logoUrl && (
                <Image
                  src={s.logoUrl}
                  alt=""
                  width={16}
                  height={16}
                  className={cn("size-4 object-contain", isHidden && "opacity-40")}
                />
              )}
              {/* The swatch shows the dash style too, so a duplicate listing is
                  identifiable in the legend and not only on the chart. */}
              <span
                aria-hidden
                className="w-4 h-0.5 shrink-0"
                style={{
                  backgroundColor: isHidden ? "var(--border)" : s.color,
                  backgroundImage: s.dashed
                    ? `repeating-linear-gradient(to right, ${
                        isHidden ? "var(--border)" : s.color
                      } 0 4px, transparent 4px 7px)`
                    : undefined,
                }}
              />
              <span className={cn(isHidden && "line-through")}>{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-card rounded-2xl p-6 md:p-8 border border-border/10">
        <ChartContainer config={config} className="h-[300px] w-full">
          <LineChart data={data} accessibilityLayer>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              opacity={0.4}
            />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value: number) => formatDate(value)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              stroke="var(--muted-foreground)"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              stroke="var(--muted-foreground)"
              tickFormatter={(value: number) => `${formatEurAmount(value)} €`}
              domain={["dataMin - 0.5", "dataMax + 0.5"]}
            />
            <ChartTooltip content={<MultiStoreTooltip series={series} />} />
            {series
              .filter((s) => !hidden.has(s.key))
              .map((s) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  type="stepAfter"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? DASH : undefined}
                  dot={false}
                  activeDot={{ r: 4 }}
                  // A series is null before its first reading and at timestamps
                  // where only OTHER stores moved; without this a line would
                  // break every time a competitor changed price.
                  connectNulls
                />
              ))}
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  label?: number;
  payload?: { dataKey?: string | number; value?: number }[];
  series: Series[];
}

/**
 * Custom tooltip rather than ChartTooltipContent: it sorts the stores by price
 * at the hovered date, so the cheapest reads first — the whole point of the
 * page — which the shared component does not do.
 */
function MultiStoreTooltip({ active, label, payload, series }: TooltipProps) {
  if (!active || !payload?.length || label == null) return null;

  const rows = payload
    .map((entry) => {
      const match = series.find((s) => s.key === entry.dataKey);
      if (!match || typeof entry.value !== "number") return null;
      return { label: match.label, color: match.color, value: entry.value };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.value - b.value);

  if (rows.length === 0) return null;

  // Card-discount flags ride the same row as the prices, keyed per listing.
  const point = payload[0] as unknown as { payload?: Record<string, unknown> };
  const flags = point.payload ?? {};

  return (
    <div className="rounded-lg border border-border/40 bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-foreground">{formatDate(label)}</p>
      <div className="space-y-1">
        {rows.map((row) => {
          const match = series.find((s) => s.label === row.label);
          const carded = match ? flags[match.cardFlagKey] === true : false;
          return (
            <div key={row.label} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: row.color }}
              />
              <span className="text-muted-foreground">{row.label}</span>
              <span className="ml-auto font-medium text-foreground">
                {formatEurAmount(row.value)} €
              </span>
              {carded && (
                <span className="text-primary">{CARD_DISCOUNT_CHART_NOTE}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm lint && pnpm build`
Expected: both succeed. If Recharts' `Tooltip` rejects the `content` element's prop types, widen `TooltipProps` rather than casting the whole component to `any` — and do not switch to `ChartTooltipContent`, which cannot sort rows by price.

- [ ] **Step 3: Commit**

```bash
git add components/shared/MultiStorePriceChart.tsx
git commit -m "feat: multi-series step chart for per-store price history"
```

---

### Task 13: `StoreListingRow`

**Files:**
- Create: `components/shared/StoreListingRow.tsx`

**Interfaces:**
- Consumes: `AddToCartButton`, `CardDiscountMark`, `formatEurAmount`/`formatPricePerUnit`/`pricePerUnitAriaLabel`, `STORE_LOGOS`, `normalizeStoreName`.
- Produces: `<StoreListingRow listing={ProductComparisonListing} isCheapest={boolean} productName={string} brandName={string} size?={string} />`

- [ ] **Step 1: Write the component**

Create `components/shared/StoreListingRow.tsx`:

```tsx
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { AddToCartButton } from "@/components/shared/AddToCartButton";
import { CardDiscountMark } from "@/components/shared/CardDiscountMark";
import {
  formatEurAmount,
  formatPricePerUnit,
  pricePerUnitAriaLabel,
} from "@/lib/format";
import { STORE_LOGOS } from "@/lib/store";
import { cn, normalizeStoreName } from "@/lib/utils";
import type { ProductComparisonListing } from "@/types/comparison.types";

/** A listing unseen this long gets a note; scrapes land daily. */
const STALE_DAYS = 7;

export const OUT_OF_STOCK_CART_LABEL =
  "Ni na zalogi — dodajanje v košarico ni mogoče";

function staleNote(lastSeenAt: string | null): string | null {
  if (!lastSeenAt) return null;
  const seen = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(seen)) return null;
  const days = Math.floor((Date.now() - seen) / 86_400_000);
  if (days < STALE_DAYS) return null;
  return `nazadnje videno pred ${days} dnevi`;
}

interface StoreListingRowProps {
  listing: ProductComparisonListing;
  /** True for listings[0] only — one winner, even when a later row ties. */
  isCheapest: boolean;
  productName: string;
  brandName: string;
  /** Pre-formatted group size, e.g. "1,5 L". */
  size?: string;
}

/**
 * One store's price for the article, with its own actions.
 *
 * One row per LISTING, not per store: a store that lists the article twice gets
 * two rows, at its two different prices. The caller keys on storeProductId.
 *
 * Out-of-stock rows are muted but never removed — an out-of-stock price is
 * still a published price, and dropping it would make the comparison churn
 * daily as stock moved.
 */
export function StoreListingRow({
  listing,
  isCheapest,
  productName,
  brandName,
  size,
}: StoreListingRowProps) {
  const storeName = normalizeStoreName(listing.store.name);
  const info = storeName ? STORE_LOGOS[storeName] : undefined;

  const perUnit = formatPricePerUnit(listing.pricePerUnit, listing.baseUnit);
  const perUnitAria = pricePerUnitAriaLabel(
    listing.pricePerUnit,
    listing.baseUnit,
  );

  // discountPct is NEGATIVE when the price rose, so this is a > 0 test, not a
  // != null one — the same rule /search applies.
  const onSale =
    listing.discountPct != null &&
    listing.discountPct > 0 &&
    listing.oldPrice != null &&
    listing.oldPrice !== listing.price;

  // The store's own label differs per store for the same article. Showing it
  // when it differs lets a shopper confirm the store really sells this thing.
  const storeTitle =
    listing.title && listing.title !== productName ? listing.title : null;

  const stale = staleNote(listing.lastSeenAt);

  return (
    <div
      className={cn(
        "relative bg-card rounded-2xl border p-4 sm:p-5",
        isCheapest ? "border-primary/40 ring-1 ring-primary/30" : "border-border/10",
        !listing.isAvailable && "opacity-60",
      )}
    >
      {isCheapest && (
        <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest">
          Najceneje
        </span>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 min-w-0 sm:w-44 shrink-0">
          {info ? (
            <div className="w-10 h-10 rounded-full bg-card border border-border/20 flex items-center justify-center overflow-hidden shrink-0">
              <Image
                src={info.logoUrl}
                alt={info.label}
                width={28}
                height={28}
                className="w-full h-full object-contain p-1"
              />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate">
              {info?.label ?? listing.store.name}
            </p>
            <p
              className={cn(
                "text-[11px] font-semibold",
                listing.isAvailable ? "text-primary" : "text-muted-foreground",
              )}
            >
              {listing.isAvailable ? "Na zalogi" : "Ni na zalogi"}
            </p>
          </div>
        </div>

        <div className="grow min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            {onSale && (
              <span className="text-sm font-semibold text-accent-foreground line-through">
                {formatEurAmount(listing.oldPrice!)} &euro;
              </span>
            )}
            <span className="text-xl sm:text-2xl font-bold text-foreground">
              {formatEurAmount(listing.price)} &euro;
            </span>
            {onSale && (
              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                -{Math.round(listing.discountPct!)}%
              </span>
            )}
            {listing.cardDiscount && <CardDiscountMark className="self-center" />}
          </div>

          {perUnit && (
            <p
              className="text-[11px] font-semibold text-muted-foreground mt-0.5"
              aria-label={perUnitAria ?? undefined}
            >
              {perUnit}
            </p>
          )}
          {storeTitle && (
            <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">
              {storeTitle}
            </p>
          )}
          {stale && (
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">{stale}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {listing.isAvailable && storeName ? (
            <AddToCartButton
              item={{
                // storeProductId: the cart is per-listing, so the same article
                // from two stores is two lines at two prices. That is correct —
                // they are two different purchases.
                id: listing.storeProductId,
                productName,
                brandName,
                imageUrl: listing.imageUrl ?? "",
                price: listing.price,
                oldPrice: onSale ? listing.oldPrice! : undefined,
                discountPct: onSale ? listing.discountPct! : undefined,
                storeName,
                size,
                cardDiscount: listing.cardDiscount,
              }}
            />
          ) : (
            <button
              type="button"
              disabled
              aria-label={OUT_OF_STOCK_CART_LABEL}
              title={OUT_OF_STOCK_CART_LABEL}
              className="inline-flex items-center justify-center gap-1.5 bg-border/40 text-muted-foreground px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-xs sm:text-sm whitespace-nowrap cursor-not-allowed"
            >
              V Košarico
            </button>
          )}

          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Poglej v trgovini ${info?.label ?? listing.store.name}`}
            className="inline-flex items-center justify-center gap-1.5 bg-secondary text-foreground px-3 sm:px-4 py-2.5 sm:py-3 rounded-full font-bold text-xs sm:text-sm hover:bg-secondary/70 transition-all active:scale-95"
          >
            <span className="hidden lg:inline">V trgovino</span>
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
```

Note: `AddToCartButton` is rendered only when the store name resolves, because `CartItem.storeName` is typed `StoreName`. An unknown store shows the disabled button — the basket cannot render a store it has no logo for.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm lint && pnpm build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add components/shared/StoreListingRow.tsx
git commit -m "feat: per-store price row with its own cart and store actions"
```

---

### Task 14: The `/primerjava/[product_id]` detail page

**Files:**
- Create: `app/(main)/primerjava/[product_id]/page.tsx`
- Create: `app/(main)/primerjava/[product_id]/loading.tsx`
- Create: `app/(main)/primerjava/[product_id]/not-found.tsx`

**Interfaces:**
- Consumes: `getProductComparison` (Task 4), `MultiStorePriceChart` (Task 12), `StoreListingRow` (Task 13), `StoreLogos` (Task 5), `derivePricePerUnit` (Task 2), `BackButton`, `ProductImage`, `storeCountLabel`.
- Produces: the route.

- [ ] **Step 1: Write the page**

Create `app/(main)/primerjava/[product_id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { getProductComparison } from "@/actions/comparison.actions";
import { BackButton } from "@/components/shared/BackButton";
import { MultiStorePriceChart } from "@/components/shared/MultiStorePriceChart";
import { ProductImage } from "@/components/shared/ProductImage";
import { StoreListingRow } from "@/components/shared/StoreListingRow";
import { StoreLogos } from "@/components/shared/StoreLogos";
import { derivePricePerUnit } from "@/lib/comparison";
import {
  formatEurAmount,
  formatPricePerUnit,
  formatSize,
  pricePerUnitAriaLabel,
} from "@/lib/format";
import { STORE_LOGOS } from "@/lib/store";
import { storeCountLabel } from "@/lib/utils";
import { STORE_MAP } from "@/types/search.types";

/** Requested at the maximum: the chart filters shorter windows client-side. */
const HISTORY_DAYS = 365;

// Module-local for the same reason as PAGE_TITLE on the list page: a page
// module's export surface is validated by Next.
const SINGLE_STORE_NOTE = "Ta izdelek trenutno prodaja samo ena trgovina.";

interface Props {
  params: Promise<{ product_id: string }>;
}

/**
 * One article and what every store charges for it.
 *
 * `product_id` here is a product.id, NOT a storeProductId — a different
 * identity space from /product/[product_id]. Both are bare integers, so a
 * mix-up renders a plausible page about the wrong article.
 */
export default async function ProductComparisonPage({ params }: Props) {
  const { product_id } = await params;

  let data;
  try {
    data = await getProductComparison(product_id, HISTORY_DAYS);
  } catch {
    // 404 means no such product, or every listing behind it has been dropped
    // from its store's feed. Both are "gone" as far as the UI is concerned.
    notFound();
  }

  const {
    product,
    storeCount,
    storeIds,
    minPrice,
    maxPrice,
    savings,
    baseUnit,
    totalQuantity,
    listings,
  } = data;

  const stores = storeIds
    .map((id) => STORE_MAP[id])
    .filter((name): name is NonNullable<typeof name> => Boolean(name));

  const size = formatSize(totalQuantity, baseUnit);

  // Derived from minPrice, and prefixed "od" for that reason. The per-row
  // figures below are each store's own scraped value, which is why these two
  // numbers can differ by a cent — see derivePricePerUnit.
  const derived = derivePricePerUnit(minPrice, totalQuantity, baseUnit);
  const perUnit = formatPricePerUnit(derived, baseUnit);
  const perUnitAria = pricePerUnitAriaLabel(derived, baseUnit);

  // STORE_MAP gives the internal key ("lidl"); STORE_LOGOS gives the display
  // label ("Lidl"). Rendering the key would put lowercase store names on screen.
  const cheapestStoreName = STORE_MAP[data.cheapestStoreId];
  const cheapestLabel = cheapestStoreName
    ? STORE_LOGOS[cheapestStoreName].label
    : undefined;

  // Suppressed when every store charges the same: "prihranite do 0,00 €" is
  // noise, and a spread of zero is a real and common case in this corpus.
  const hasSpread = savings > 0;

  const productName = product.title || product.name;

  return (
    <div className="py-6 sm:py-8 space-y-6 sm:space-y-10">
      <div className="px-4 sm:px-6 lg:px-20 space-y-6 sm:space-y-10">
        <BackButton />

        <section className="flex flex-col md:flex-row gap-6 md:gap-12">
          <div className="relative w-full max-h-[240px] sm:max-h-none md:w-[420px] aspect-square shrink-0 bg-card rounded-2xl flex items-center justify-center border border-border/10 mx-auto md:mx-0">
            <ProductImage
              src={product.imageUrl}
              alt={productName}
              sizes="(max-width: 768px) 240px, 420px"
              className="object-contain p-6 sm:p-8"
              iconClassName="size-14 sm:size-20"
              priority
            />

            {/* The cluster replaces the single logo /product's hero shows —
                that is the whole point of this page. */}
            <StoreLogos
              stores={stores}
              max={5}
              size="lg"
              overlap
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10"
            />
          </div>

          {/* No add-to-cart and no open-in-store here: a page-level button would
              have to silently pick a store. Both live per-row below. */}
          <div className="flex flex-col justify-center gap-3 sm:gap-4">
            <div>
              {product.brand?.name && (
                <p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 sm:mb-2">
                  {product.brand.name}
                </p>
              )}
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground leading-tight break-words">
                {productName}
              </h1>
              {size && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                  Pakiranje:{" "}
                  <span className="font-semibold text-foreground">{size}</span>
                </p>
              )}
            </div>

            <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
              <span className="text-2xl sm:text-3xl font-extrabold text-primary">
                <span className="text-base font-semibold text-muted-foreground mr-1.5">
                  od
                </span>
                {formatEurAmount(minPrice)} &euro;
              </span>
              {cheapestLabel && (
                <span className="text-sm text-muted-foreground">
                  najceneje v{" "}
                  <span className="font-semibold text-foreground">
                    {cheapestLabel}
                  </span>
                </span>
              )}
            </div>

            {hasSpread && (
              <p className="text-xs sm:text-sm text-muted-foreground">
                {storeCountLabel(storeCount)} · {formatEurAmount(minPrice)}–
                {formatEurAmount(maxPrice)} &euro; · prihranite do{" "}
                <span className="font-semibold text-foreground">
                  {formatEurAmount(savings)} &euro;
                </span>
              </p>
            )}

            {perUnit && (
              <p
                className="text-xs sm:text-sm text-muted-foreground"
                aria-label={perUnitAria ?? undefined}
              >
                Cena na enoto:{" "}
                <span className="font-semibold text-foreground">od {perUnit}</span>
              </p>
            )}

            {/* Reachable via the cross-link on /product/[id], so it has to look
                deliberate rather than like a broken comparison. */}
            {storeCount === 1 && (
              <p className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground bg-secondary rounded-xl px-3 py-2">
                <Info className="size-4 shrink-0 mt-0.5" aria-hidden />
                {SINGLE_STORE_NOTE}
              </p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Zgodovina cen</h2>
          <MultiStorePriceChart listings={listings} />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Cene po trgovinah</h2>
          {/* API order — cheapest first — and one row per LISTING, so a store
              that lists the article twice appears twice, at both prices.
              storeProductId is the key: store.id is NOT unique here. */}
          <div className="space-y-4">
            {listings.map((listing, index) => (
              <StoreListingRow
                key={listing.storeProductId}
                listing={listing}
                // listings[0] only: one winner, even when a later row ties.
                isCheapest={index === 0 && listings.length > 1}
                productName={productName}
                brandName={product.brand?.name ?? ""}
                size={size ?? undefined}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
```

`ProductScrollSection` "Sorodni izdelki" is deliberately absent: the similar endpoint keys on `storeProductId` and returns store listings, so rendering it here would put both id spaces on one page. That is a follow-up, not an omission.

- [ ] **Step 2: Write the route skeleton**

Create `app/(main)/primerjava/[product_id]/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function ComparisonLoading() {
  return (
    <div className="py-6 sm:py-8 space-y-6 sm:space-y-10">
      <div className="px-4 sm:px-6 lg:px-20 space-y-6 sm:space-y-10">
        <Skeleton className="h-9 w-24 rounded-full" />

        <div className="flex flex-col md:flex-row gap-6 md:gap-12">
          <Skeleton className="w-full md:w-[420px] aspect-square max-h-[240px] sm:max-h-none rounded-2xl shrink-0 mx-auto md:mx-0" />
          <div className="flex flex-col justify-center gap-4 grow">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-10 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-9 w-48 rounded" />
            <Skeleton className="h-4 w-64 rounded" />
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-[380px] w-full rounded-2xl" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-8 w-56 rounded-lg" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the 404**

Create `app/(main)/primerjava/[product_id]/not-found.tsx`:

```tsx
import Link from "next/link";
import { SearchX } from "lucide-react";

export default function ComparisonNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 px-4 gap-4 text-center">
      <SearchX className="size-16 text-muted-foreground" strokeWidth={1.5} />
      <h1 className="text-2xl font-bold text-foreground">
        Primerjava ni na voljo
      </h1>
      <p className="text-muted-foreground max-w-sm">
        Tega izdelka ni več v ponudbi nobene trgovine, ali pa povezava ni
        pravilna.
      </p>
      <Link
        href="/primerjava"
        className="mt-4 bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold text-sm hover:bg-primary/90 transition-all active:scale-95"
      >
        Poglej druge primerjave
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Build**

Run: `pnpm lint && pnpm build`
Expected: both succeed, and `/primerjava/[product_id]` appears in the route list.

- [ ] **Step 5: Verify in Chrome**

From `/primerjava`, click a card with 3+ store logos:

1. Hero shows brand, title, `Pakiranje`, `od X €`, `najceneje v <store>`, the spread line, and `Cena na enoto: od …`.
2. There is **no** page-level "V košarico" and **no** page-level "Poglej v trgovini".
3. The logo cluster sits on the image, showing every store.
4. The chart draws one line per store, in colours matching the logos in the legend.
5. Click a legend entry — that line disappears, the entry greys and strikes through; click again to restore.
6. Each of the four period buttons changes the x-axis range with no spinner and no refetch (watch the Network tab: no request).
7. Hover the chart — the tooltip lists stores **cheapest first** with a date heading.
8. Under **Cene po trgovinah**: rows cheapest-first, the first ringed with a `NAJCENEJE` badge, each with a store logo, stock chip, per-unit price, `V Košarico` and a store link.
9. Click a store link — opens the retailer's page in a new tab at the right product.
10. Console: no key warnings, no hydration mismatch.
11. Visit `/primerjava/999999999` — the not-found page, not a crash.

- [ ] **Step 6: Commit**

```bash
git add "app/(main)/primerjava/[product_id]"
git commit -m "feat: /primerjava/[id] comparison detail page"
```

---

### Task 15: The cross-link from `/product/[product_id]`

**Files:**
- Modify: `app/(main)/product/[product_id]/page.tsx`

**Interfaces:**
- Consumes: `data.product.id` — already in the existing payload, so this costs no extra request.
- Produces: nothing.

- [ ] **Step 1: Add the link**

In `app/(main)/product/[product_id]/page.tsx`:

1. Add to the imports:

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
```

(`ExternalLink` is already imported from `lucide-react`; add `ArrowRight` to that same import rather than a second statement.)

2. Immediately **after** the closing `</div>` of the existing button row (the `<div className="flex gap-3 mt-2 sm:mt-4">` block), inside the same info column, add:

```tsx
            {/* product.id, NOT the storeProductId this route is keyed on — a
                different identity space, and both are bare integers.
                It is already in this payload, so the link costs no request.
                A link, never a redirect: a shopper who opened one store's
                listing asked for that listing. The comparison endpoint also
                serves single-store articles, so this never 404s on a live
                product — it lands on the storeCount === 1 state. */}
            {product?.id != null && (
              <Link
                href={`/primerjava/${product.id}`}
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all self-start"
              >
                Primerjaj ceno v drugih trgovinah
                <ArrowRight className="size-4" />
              </Link>
            )}
```

- [ ] **Step 2: Build**

Run: `pnpm lint && pnpm build`
Expected: both succeed.

- [ ] **Step 3: Verify in Chrome — including the non-goal**

1. Open `/search`, find a product you know several stores carry (search a national brand such as `coca cola`).
2. **Click the card.** It must land on `/product/<storeProductId>` — the single-listing page, with its own store logo, its `V košarico` and `Poglej v trgovini` buttons. **It must NOT redirect to `/primerjava`.** If it does, the non-goal is violated; revert and re-read the spec.
3. On that page, the new link **Primerjaj ceno v drugih trgovinah →** appears under the buttons and goes to `/primerjava/<product.id>` — a **different number** from the URL you are on.
4. Repeat from `/popular` and `/top-discounts`: cards still go to `/product/<id>`.
5. Open a product only one store carries and follow the link — the `storeCount === 1` page with the info note, one row and one chart line.

- [ ] **Step 4: Commit**

```bash
git add "app/(main)/product/[product_id]/page.tsx"
git commit -m "feat: link from a store listing to its cross-store comparison"
```

---

### Task 16: Full verification sweep and edge cases

**Files:** none — verification only. Fix anything found in the task that owns it, then re-run this sweep.

- [ ] **Step 1: Re-run the pure-logic checks**

```bash
node /private/tmp/claude-501/-Users-svenahac-Documents-Personal-Projects-digitalna-kosarica-frontend/ac9f2d6c-74db-4bb4-9cb1-e2952f525c24/scratchpad/check-comparison.mjs
node /private/tmp/claude-501/-Users-svenahac-Documents-Personal-Projects-digitalna-kosarica-frontend/ac9f2d6c-74db-4bb4-9cb1-e2952f525c24/scratchpad/check-series.mjs
```
Expected: both print `OK`.

- [ ] **Step 2: Confirm the frozen files are untouched across the whole branch**

```bash
git diff --name-only development...HEAD
```
Expected: the list must NOT contain `components/shared/ProductCard.tsx`, `components/shared/ProductCardList.tsx`, `components/shared/PriceHistoryChart.tsx`, `lib/cart.tsx`, `actions/home.actions.ts`, or `actions/search.actions.ts`.

- [ ] **Step 3: Build and lint clean**

```bash
pnpm lint && pnpm build
```
Expected: no errors, no new warnings.

- [ ] **Step 4: Find the edge-case products**

With the backend running, pick concrete ids from the API rather than hoping to stumble on them:

```bash
API=$(grep -h '^API_URL=' .env .env.local 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"')

# A row whose cheapest listing is OUT OF STOCK -> the savings badge must be absent
curl -s "$API/products/multi-store?size=100&sort=SAVINGS_PCT" \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print([(p["product"]["id"],p["savingsPct"]) for p in d["products"] if not p["cheapestIsAvailable"]][:5])'

# A row PARTIALLY stocked -> the "na zalogi v N od M trgovin" line
curl -s "$API/products/multi-store?size=100" \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print([(p["product"]["id"],p["availableStoreCount"],p["storeCount"]) for p in d["products"] if p["cheapestIsAvailable"] and p["availableStoreCount"]<p["storeCount"]][:5])'

# A row with NO agreed unit -> no size and no per-unit line anywhere
curl -s "$API/products/multi-store?size=100" \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print([p["product"]["id"] for p in d["products"] if p["baseUnit"] is None][:5])'

# A product with a WITHIN-STORE DUPLICATE -> listings longer than storeCount
for id in $(curl -s "$API/products/multi-store?size=60&sort=STORE_COUNT" \
  | python3 -c 'import json,sys;[print(p["product"]["id"]) for p in json.load(sys.stdin)["products"]]'); do
  curl -s "$API/products/$id?days=365" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if len(d['listings'])>d['storeCount']: print('DUPLICATE:', $id, len(d['listings']), 'listings /', d['storeCount'], 'stores')
"
done | head -3
```

Record the ids each query returns. If a query returns nothing, note "no such row in the current data" — that is a valid outcome, not a skipped check.

- [ ] **Step 5: Verify each edge case in Chrome**

For every id found above:

1. **Cheapest out of stock** — on `/primerjava` (find it via `?q=` on its name): **no savings badge at all**, and the line `najcenejša ni na zalogi`. On its detail page, the corresponding row is muted with a disabled `V Košarico` whose tooltip explains why.
2. **Partially stocked** — the card shows `na zalogi v N od M trgovin` **and keeps its badge** (rule 3, since the cheapest is buyable).
3. **`baseUnit: null`** — no size in the card's top-right, no `€/L` line on the card, no `Pakiranje:` and no `Cena na enoto:` in the detail hero. No `0,00`, no dash, nothing.
4. **Within-store duplicate** — the detail page shows two rows for one store at two prices; the chart shows two lines in that store's colour, the second dashed and labelled `<Store> (2)`; the legend shows both. **Console has no duplicate-key warning.**
5. **`m` base unit**, if any exists — size renders (e.g. `15 cm`) but no per-unit line on the card, since `m` is deliberately not derived.

- [ ] **Step 6: Verify the cart end to end**

1. On a detail page with 3 stores, click `V Košarico` on the cheapest row, then on a dearer row.
2. Open `/basket`: **two separate lines**, each naming its own store with its own price.
3. Reload: both lines persist (they are in localStorage).
4. Increment one line's quantity — only that line changes.
5. The basket total equals the sum of the two prices.

- [ ] **Step 7: Confirm nothing regressed**

Walk each existing page and confirm it behaves as before:

1. `/` — first two rails unchanged, their cards still have `+` buttons and still link to `/product/<id>`.
2. `/search` — filters, both views, pagination, `+` on cards, links to `/product/<id>`.
3. `/popular` and `/top-discounts` — unchanged.
4. `/product/<id>` — the price-history chart still has its **`Vse`** period button (only the new chart drops it), plus the new comparison link.
5. `/basket` — renders items added from both the old `+` buttons and the new rows.
6. `/about` — unaffected.

- [ ] **Step 8: Commit any fixes and clean up**

Remove the scratchpad check scripts if you created them outside the scratchpad directory. Anything under the scratchpad path is already outside the repo — confirm with:

```bash
git status --porcelain
```
Expected: clean, or only intended changes.

---

## Notes for the executor

**If a step's reality differs from this plan, stop and report rather than improvising.** Three places that are most likely to differ:

1. `CategoryMultiSelect`'s prop names (Task 9) — read the file, match it, do not edit it.
2. Recharts 3.8's tooltip `content` prop typing (Task 12) — widen the local `TooltipProps`, do not fall back to `ChartTooltipContent`, which cannot sort rows by price.
3. `API_URL`'s base path (Task 4) — every existing action assumes it ends at `/api/v1`. If it does not, report before guessing a prefix.

**The two things this plan most wants not broken:**

- `ProductCard.tsx` / `ProductCardList.tsx` stay byte-identical. That is what guarantees `/search` keeps linking to `/product/{storeProductId}`.
- `buildPriceSeries` in `lib/price-history.ts` stays byte-identical. That is what guarantees `/product/[id]`'s chart, including its `Vse` button, behaves exactly as before.
