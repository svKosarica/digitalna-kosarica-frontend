# Unit Display and Price-Per-Unit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every listing's structured size, and its price-per-unit with the unit label, on every screen that shows a product.

**Architecture:** One dependency-free formatter module (`lib/format.ts`) turns the listing's `totalQuantity`/`baseUnit`/`pricePerUnit` into Slovenian display strings. Server components format; the two card components stay presentational and receive pre-formatted strings, exactly as they already do for `price` and `oldPrice`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, `Intl.NumberFormat`/`Intl.PluralRules` with locale `sl-SI`/`sl`.

**Spec:** `docs/superpowers/specs/2026-07-30-unit-display-design.md`

## Global Constraints

- **This is a frontend-only change.** No backend change is requested or made.
- **Size and price-per-unit are read off the listing** (`DiscountItem`), never off `item.product`. Nothing may cache a size against a product id — the same product in two stores can carry different pack sizes.
- **`null` means render nothing.** No dash, no `0`, no "unknown". `baseUnit` and `totalQuantity` are null together on roughly 0.4% of listings, and that is normal data, not an error.
- **Never compare `pricePerUnit` across different `baseUnit` values** — not in a badge, a sort, or a saving calculation.
- **New strings use `sl-SI`** (decimal comma). Existing prices keep their `toFixed(2)` decimal point; the resulting mixed separators on a card are a deliberate, recorded decision — do not "fix" surrounding prices.
- **No test files.** Verification is `npx tsc --noEmit`, `pnpm lint`, a throwaway `node` probe for the formatters, and Chrome against the dev server.
- **Lint baseline is 4 errors, 2 warnings** — `SearchBar.tsx:17`, `lib/cart.tsx:66`, `stories/Page.tsx:39` (×2), `eslint.config.mjs:2`, `proxy.ts:4`. Tasks must not add to this count and must not fix these, including the one in `lib/cart.tsx`, a file this plan modifies.
- **Slovenian copy is fixed by the spec.** `kos`/`kosa`/`kosi`/`kosov` come from `Intl.PluralRules("sl")` and are never hand-rolled. Litre is uppercase `L` in both `1,98 L` and `€/L`. Detail-page labels are exactly `Pakiranje` and `Cena na enoto`.

## File Structure

| file | responsibility |
|---|---|
| `lib/format.ts` *(new)* | Owns all size and price-per-unit copy. Dependency-free at runtime so it can be exercised with `node` directly. |
| `types/product.types.ts` | Declares `BaseUnit` and the API shape. Loses `Product.unit`. |
| `components/shared/ProductCard.tsx` | Grid card. Receives pre-formatted strings. |
| `components/shared/ProductCardList.tsx` | Dense row. Receives pre-formatted strings. |
| `components/shared/ProductResults.tsx` | Formats for /popular and /top-discounts. |
| `components/shared/ProductScrollSection.tsx` | Formats for the 3 home sections and "Sorodni izdelki". |
| `app/(main)/search/page.tsx` | Formats for the /search grid and list. |
| `app/(main)/product/[product_id]/page.tsx` | Renders labelled size and price-per-unit. |
| `lib/cart.tsx` | `CartItem` carries an optional pre-formatted size. |
| `components/shared/BasketItemCard.tsx` | Renders the cart item's size. |

---

### Task 1: Formatter module and API types

Adds the new types and the formatters. `Product.unit` is deliberately left in place so this task typechecks green on its own and is independently committable.

**Files:**
- Create: `lib/format.ts`
- Modify: `types/product.types.ts:6-19` (add `BaseUnit`), `types/product.types.ts:29-42` (`DiscountItem`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export type BaseUnit = "g" | "ml" | "piece" | "m"` — from `@/types/product.types`
  - `formatSize(totalQuantity: number | null, baseUnit: BaseUnit | null): string | null`
  - `formatPricePerUnit(pricePerUnit: number | null, baseUnit: BaseUnit | null): string | null`
  - `pricePerUnitAriaLabel(pricePerUnit: number | null, baseUnit: BaseUnit | null): string | null`
  - all three from `@/lib/format`

- [ ] **Step 1: Add `BaseUnit` and the new listing fields to the API types**

In `types/product.types.ts`, add above `interface Product`:

```ts
/**
 * Canonical base the backend expresses a quantity in. Mirrors the four
 * UnitSpec constants in the product-comparison service; there is no fifth
 * value today. Null on a listing whose store label could not be parsed.
 */
export type BaseUnit = "g" | "ml" | "piece" | "m";
```

In `interface DiscountItem`, replace the `pricePerUnit: number;` line with:

```ts
  /**
   * Per kilogram for `g`, per litre for `ml`, per piece for `piece`, per metre
   * for `m` — computed by the backend so it is comparable across stores within
   * one baseUnit. Four decimals on the wire; round to 2 for display.
   *
   * Meaningless without its baseUnit label: 3.53 could be €/L or €/kos. Never
   * render the number on its own, and never compare it across baseUnits.
   */
  pricePerUnit: number | null;
  /** Null together with totalQuantity when the store's label could not be parsed. */
  baseUnit: BaseUnit | null;
  /**
   * Quantity in baseUnit terms, multipacks already multiplied out — a 6 x 0,33 L
   * pack arrives as 1980 ml. The pack shape is not recoverable from the API.
   */
  totalQuantity: number | null;
```

Leave `Product.unit` alone for now; Task 2 removes it.

- [ ] **Step 2: Create the formatter module**

Create `lib/format.ts`:

```ts
import type { BaseUnit } from "@/types/product.types";

/**
 * Slovenian rendering of a listing's size and its price per unit.
 *
 * Both values come off the listing, never off the product. Both are null
 * together when the store's label could not be parsed, and null here means
 * "render nothing" — no dash, no "0".
 *
 * The only import is type-only, so type stripping erases it and this module can
 * be exercised directly with `node`.
 */

// Slovenian has a dual, so a count has four forms. Intl implements the rule;
// hand-rolling it off the last two digits is how it goes wrong.
const PIECE_FORMS = {
  one: "kos",
  two: "kosa",
  few: "kosi",
  other: "kosov",
  zero: "kosov",
  many: "kosov",
} as const;

const PER_UNIT_LABEL: Record<BaseUnit, string> = {
  g: "€/kg",
  ml: "€/L",
  piece: "€/kos",
  m: "€/m",
};

// "1,16 €/L" does not read aloud usefully.
const PER_UNIT_SPOKEN: Record<BaseUnit, string> = {
  g: "cena na kilogram",
  ml: "cena na liter",
  piece: "cena na kos",
  m: "cena na meter",
};

// Constructed once: these run per card in an auto-fill grid.
const pieceRules = new Intl.PluralRules("sl");
const decimal0 = new Intl.NumberFormat("sl-SI", { maximumFractionDigits: 0 });
const decimal1 = new Intl.NumberFormat("sl-SI", { maximumFractionDigits: 1 });
const decimal2 = new Intl.NumberFormat("sl-SI", { maximumFractionDigits: 2 });
// A price reads as "3,50 €/L", not "3,5 €/L".
const price2 = new Intl.NumberFormat("sl-SI", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1,98 L", "500 g", "5 kosov", "15 cm" — or null when the listing has no parsed size. */
export function formatSize(
  totalQuantity: number | null,
  baseUnit: BaseUnit | null,
): string | null {
  if (totalQuantity == null || baseUnit == null) return null;

  switch (baseUnit) {
    case "piece":
      return `${decimal0.format(totalQuantity)} ${PIECE_FORMS[pieceRules.select(totalQuantity)]}`;

    // Promote to the larger unit once the number gets big, the way a shelf label would.
    case "g":
      return totalQuantity >= 1000
        ? `${decimal2.format(totalQuantity / 1000)} kg`
        : `${decimal0.format(totalQuantity)} g`;

    case "ml":
      return totalQuantity >= 1000
        ? `${decimal2.format(totalQuantity / 1000)} L`
        : `${decimal0.format(totalQuantity)} ml`;

    // Lengths arrive folded to metres, so a 15 cm label is 0.15 and 5 mm is
    // 0.005. Demote rather than render "0,01 m". A cm label divided by 100 at
    // three decimals can carry one decimal (15,5 cm -> 0.155); an mm label
    // divided by 1000 at three decimals is always a whole number of mm.
    case "m":
      if (totalQuantity >= 1) return `${decimal2.format(totalQuantity)} m`;
      if (totalQuantity >= 0.01) return `${decimal1.format(totalQuantity * 100)} cm`;
      return `${decimal0.format(totalQuantity * 1000)} mm`;

    // A unit the backend added and this build does not know. baseUnit arrives as
    // a bare string, so this is reachable: showing no size is honest, while
    // falling through to metres would mislabel every such listing.
    default:
      return null;
  }
}

/** "3,53 €/L" — or null when the listing has no parsed size. */
export function formatPricePerUnit(
  pricePerUnit: number | null,
  baseUnit: BaseUnit | null,
): string | null {
  if (pricePerUnit == null || baseUnit == null) return null;
  const label = PER_UNIT_LABEL[baseUnit];
  if (!label) return null;
  return `${price2.format(pricePerUnit)} ${label}`;
}

/** "cena na liter: 3,53 €" — the spoken form of formatPricePerUnit's output. */
export function pricePerUnitAriaLabel(
  pricePerUnit: number | null,
  baseUnit: BaseUnit | null,
): string | null {
  if (pricePerUnit == null || baseUnit == null) return null;
  const spoken = PER_UNIT_SPOKEN[baseUnit];
  if (!spoken) return null;
  return `${spoken}: ${price2.format(pricePerUnit)} €`;
}
```

- [ ] **Step 3: Verify the formatters against the spec's table**

Write the probe to the scratchpad, not the repo — it must not be committed:

```bash
cat > /private/tmp/claude-501/-Users-svenahac-Documents-Personal-Projects-digitalna-kosarica-frontend/9e1048bd-37ce-4be3-8540-f78b2d9d5076/scratchpad/probe-format.ts <<'EOF'
import { formatSize, formatPricePerUnit, pricePerUnitAriaLabel } from "/Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend/lib/format.ts";

const SIZE_CASES: [number | null, string | null, string | null][] = [
  [500, "g", "500 g"],
  [999, "g", "999 g"],
  [1000, "g", "1 kg"],
  [1500, "g", "1,5 kg"],
  [330, "ml", "330 ml"],
  [999, "ml", "999 ml"],
  [1000, "ml", "1 L"],
  [1980, "ml", "1,98 L"],
  [150, "m", "150 m"],
  [1.5, "m", "1,5 m"],
  [0.15, "m", "15 cm"],
  [0.005, "m", "5 mm"],
  [1, "piece", "1 kos"],
  [2, "piece", "2 kosa"],
  [3, "piece", "3 kosi"],
  [4, "piece", "4 kosi"],
  [5, "piece", "5 kosov"],
  [null, null, null],
  [1980, null, null],
  [1980, "furlong", null],
];

let failed = 0;
for (const [qty, unit, want] of SIZE_CASES) {
  const got = formatSize(qty, unit as never);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} formatSize(${qty}, ${unit}) = ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

const PER_UNIT_CASES: [number | null, string | null, string | null][] = [
  [3.5312, "ml", "3,53 €/L"],
  [3.5, "ml", "3,50 €/L"],
  [12.4567, "g", "12,46 €/kg"],
  [0.99, "piece", "0,99 €/kos"],
  [2, "m", "2,00 €/m"],
  [null, "ml", null],
  [3.53, null, null],
  [3.53, "furlong", null],
];

for (const [value, unit, want] of PER_UNIT_CASES) {
  const got = formatPricePerUnit(value, unit as never);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} formatPricePerUnit(${value}, ${unit}) = ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

const ariaGot = pricePerUnitAriaLabel(3.5312, "ml");
const ariaOk = ariaGot === "cena na liter: 3,53 €";
if (!ariaOk) failed++;
console.log(`${ariaOk ? "ok  " : "FAIL"} aria = ${JSON.stringify(ariaGot)}`);

console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
EOF
node /private/tmp/claude-501/-Users-svenahac-Documents-Personal-Projects-digitalna-kosarica-frontend/9e1048bd-37ce-4be3-8540-f78b2d9d5076/scratchpad/probe-format.ts
```

Expected: every line `ok`, final line `ALL PASS`.

The four `kos` forms and both promotion boundaries are the cases that matter most — live data will not reliably contain a listing of each piece count, which is why they are pinned here rather than in the browser.

If a case fails, fix `lib/format.ts` and re-run. Do not adjust the expected values: they are the spec's table.

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit
pnpm lint 2>&1 | tail -3
```

Expected: `tsc` exits 0 with no output. `pnpm lint` still reports exactly `✖ 6 problems (4 errors, 2 warnings)` — the baseline, unchanged.

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts types/product.types.ts
git commit -m "feat: format listing sizes and price-per-unit in Slovenian"
```

---

### Task 2: Drop `Product.unit` and wire size and price-per-unit into the cards

The card components and their four list call sites move together: deleting `Product.unit` breaks all of them at once, so splitting this would leave `tsc` red at a task boundary.

**Files:**
- Modify: `types/product.types.ts:11` (delete `unit`)
- Modify: `components/shared/ProductCard.tsx:22`, `:37`, `:137-149`, `:165-179`
- Modify: `components/shared/ProductCardList.tsx:16`, `:31`, `:120-133`, `:139-160`, `:180-196`
- Modify: `components/shared/ProductResults.tsx:1-38`
- Modify: `components/shared/ProductScrollSection.tsx:113-125`
- Modify: `app/(main)/search/page.tsx:108-170`

**Interfaces:**
- Consumes: `formatSize`, `formatPricePerUnit`, `pricePerUnitAriaLabel` from `@/lib/format`; `BaseUnit` from `@/types/product.types`.
- Produces: `ProductCard` and `ProductCardList` both accept `size?: string`, `pricePerUnit?: string`, `pricePerUnitAria?: string` and no longer accept `unit`.

- [ ] **Step 1: Delete `Product.unit` and confirm the compiler names every call site**

Delete line 11 (`unit: string;`) from `interface Product` in `types/product.types.ts`, then:

```bash
npx tsc --noEmit
```

Expected: FAIL. Errors on `item.product.unit` / `item.product?.unit` in exactly five places — `app/(main)/search/page.tsx` (two), `components/shared/ProductResults.tsx`, `components/shared/ProductScrollSection.tsx`. This error list is the checklist for the rest of the task; if a file appears that is not in the Files list above, stop and report it.

- [ ] **Step 2: Swap the `unit` prop for the three new props in `ProductCard`**

In the `ProductCardProps` interface, replace `unit?: string;` with:

```ts
  /** Pre-formatted, e.g. "1,98 L". Absent when the listing has no parsed size. */
  size?: string;
  /** Pre-formatted with its unit label, e.g. "1,16 €/L". Never render a bare number. */
  pricePerUnit?: string;
  /** Spoken form of pricePerUnit, e.g. "cena na liter: 1,16 €". */
  pricePerUnitAria?: string;
```

In the destructuring parameter list, replace `unit,` with:

```ts
  size,
  pricePerUnit,
  pricePerUnitAria,
```

- [ ] **Step 3: Render the size and the price-per-unit line in `ProductCard`**

In the brand row, update the comment and the conditional to the new prop name:

```tsx
        {/* Brand left, size right — brand truncates so the size stays pinned
            to the edge on narrow cards instead of pushing out of the card. */}
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
```

In the price block, add the per-unit line directly beneath the price row — inside the same `<div>` that wraps `oldPrice` and the price, after the `flex items-center gap-1` div that holds the price and the arrows:

```tsx
          {pricePerUnit && (
            <p
              className="text-[11px] text-muted-foreground font-semibold mt-0.5"
              aria-label={pricePerUnitAria}
            >
              {pricePerUnit}
            </p>
          )}
```

The card is a fixed `h-[380px]` column whose middle block has `grow`, so the middle absorbs the extra line.

- [ ] **Step 4: Do the same in `ProductCardList`, in both layouts**

Apply the identical interface and destructuring changes as Steps 2 and 3 (repeat them here — the same three props, the same doc comments).

Update the brand row comment and conditional exactly as in Step 3, but with `<span>` in place of `<p>`, matching the surrounding markup:

```tsx
          {/* Brand left, size right — brand truncates so the size stays pinned
              to the edge on narrow rows instead of pushing out of the card. */}
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
```

This row has two price blocks and both need the per-unit line.

In the mobile block (`flex flex-col items-start gap-2 sm:hidden`), insert between the `flex flex-wrap items-baseline gap-1.5` price row and the "V Košarico" button:

```tsx
          {pricePerUnit && (
            <span
              className="text-[11px] font-semibold text-muted-foreground"
              aria-label={pricePerUnitAria}
            >
              {pricePerUnit}
            </span>
          )}
```

In the `hidden sm:flex flex-col items-end gap-3` column, the parent's `gap-3` would push the per-unit line too far from its price, so wrap the price row and the new line together. Replace the opening of that column's price row so the existing `<div className="flex items-baseline gap-1.5">…</div>` is nested inside a new tight column:

```tsx
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-baseline gap-1.5">
            {/* existing price, arrows and oldPrice, unchanged */}
          </div>
          {pricePerUnit && (
            <span
              className="text-[11px] font-semibold text-muted-foreground"
              aria-label={pricePerUnitAria}
            >
              {pricePerUnit}
            </span>
          )}
        </div>
```

- [ ] **Step 5: Feed the props in `ProductResults`**

This covers /popular and /top-discounts. Add to the imports:

```tsx
import { formatPricePerUnit, formatSize, pricePerUnitAriaLabel } from "@/lib/format";
```

In `cardProps`, replace the `unit:` line with:

```tsx
    size: formatSize(item.totalQuantity, item.baseUnit) ?? undefined,
    pricePerUnit: formatPricePerUnit(item.pricePerUnit, item.baseUnit) ?? undefined,
    pricePerUnitAria:
      pricePerUnitAriaLabel(item.pricePerUnit, item.baseUnit) ?? undefined,
```

Read them off `item`, not `item.product` — size is store-published data like price and photo.

- [ ] **Step 6: Feed the props in `ProductScrollSection`**

This covers the three home sections and "Sorodni izdelki" on the detail page. Add the same import as Step 5, then replace the `unit={...}` line in the `<ProductCard>` call with:

```tsx
              size={formatSize(item.totalQuantity, item.baseUnit) ?? undefined}
              pricePerUnit={
                formatPricePerUnit(item.pricePerUnit, item.baseUnit) ?? undefined
              }
              pricePerUnitAria={
                pricePerUnitAriaLabel(item.pricePerUnit, item.baseUnit) ?? undefined
              }
```

- [ ] **Step 7: Extract a `cardProps` helper in the search page and feed the props once**

`app/(main)/search/page.tsx` currently duplicates nine identical props across its grid and list branches; adding three more to each would double the duplication in a file this task must edit anyway. Add the same import as Step 5, then add above the component:

```tsx
/**
 * Shared card props for both layouts. Unlike ProductResults this hides a
 * negative discountPct rather than flipping the badge — search results are not
 * a most-popular list and never show a price increase as a badge.
 */
function cardProps(item: DiscountItem) {
  const storeName = item.store?.name ? normalizeStoreName(item.store.name) : undefined;

  return {
    id: item.id,
    imageUrl: item.product?.imageUrl ?? "",
    brandName: item.product?.brand?.name ?? "",
    productName: item.product?.title ?? item.product?.name ?? "",
    size: formatSize(item.totalQuantity, item.baseUnit) ?? undefined,
    pricePerUnit: formatPricePerUnit(item.pricePerUnit, item.baseUnit) ?? undefined,
    pricePerUnitAria:
      pricePerUnitAriaLabel(item.pricePerUnit, item.baseUnit) ?? undefined,
    price: item.price?.toFixed(2) ?? "0.00",
    oldPrice:
      item.oldPrice != null && item.oldPrice !== item.price
        ? item.oldPrice.toFixed(2)
        : undefined,
    discountPct:
      item.discountPct != null && item.discountPct > 0 ? item.discountPct : undefined,
    stores: storeName ? [storeName] : [],
  };
}
```

`DiscountItem` must be imported as a type if it is not already. Then collapse both branches to:

```tsx
            <ProductCard key={item.id} {...cardProps(item)} />
```

and

```tsx
            <ProductCardList key={item.id} {...cardProps(item)} />
```

The extracted values must match the originals exactly — `price` keeps `toFixed(2)`, `oldPrice` is omitted when equal to `price`, `discountPct` is omitted unless positive.

- [ ] **Step 8: Typecheck and lint**

```bash
npx tsc --noEmit
pnpm lint 2>&1 | tail -3
```

Expected: `tsc` exits 0 with no output — the five errors from Step 1 are all resolved. `pnpm lint` still reports exactly `✖ 6 problems (4 errors, 2 warnings)`.

- [ ] **Step 9: Confirm no `unit` references survive**

```bash
grep -rn "\.unit\b\|unit=\|unit?:" app components lib types --include="*.ts" --include="*.tsx"
```

Expected: no output. Any hit other than a `baseUnit` match is a leftover.

- [ ] **Step 10: Verify in Chrome**

```bash
pnpm dev
```

`.env` supplies `API_URL`, so the dev server reads live production data. Check:

- `/` — all three scroll sections show a size top-right and a `€/unit` line under the price.
- `/search?query=coca` — grid and list layouts both.
- `/popular` and `/top-discounts` — phone width for the row layout, desktop for the grid.
- `/search?query=mleko&filter=PRICE_PER_UNIT&sortOption=ASCENDING` — the backend orders by `base_unit` first, so the page contains several groups. Confirm the unit label on every row makes each group boundary visible, and that the list is never readable as one continuous cheapest-to-priciest ranking.
- A listing with no parsed size renders title and price with no gap, no dash and no `0`. Sort by `PRICE_PER_UNIT` descending and page to the end — nulls sort last.

Confirm decimal commas in the new strings (`1,98 L`, `1,16 €/L`) sitting next to the existing decimal-point prices (`2.29 €`). That mismatch is expected and recorded in the spec.

- [ ] **Step 11: Commit**

```bash
git add types/product.types.ts components/shared/ProductCard.tsx components/shared/ProductCardList.tsx components/shared/ProductResults.tsx components/shared/ProductScrollSection.tsx "app/(main)/search/page.tsx"
git commit -m "feat: show listing size and price per unit on every card"
```

---

### Task 3: Detail page

The product detail page shows neither size nor price-per-unit today. It is the one surface that gets visible Slovenian labels, because it has the room.

**Files:**
- Modify: `app/(main)/product/[product_id]/page.tsx:1-11` (imports), `:30-40` (destructuring), `:86-104` (title and price blocks)

**Interfaces:**
- Consumes: `formatSize`, `formatPricePerUnit`, `pricePerUnitAriaLabel` from `@/lib/format`.
- Produces: a `size` string used by Task 4 when the detail page adds to the cart.

- [ ] **Step 1: Import the formatters and derive the display strings**

Add to the imports:

```tsx
import { formatPricePerUnit, formatSize, pricePerUnitAriaLabel } from "@/lib/format";
```

Add `baseUnit`, `totalQuantity` and `pricePerUnit` to the existing destructuring of `data`, then below it:

```tsx
  const size = formatSize(totalQuantity, baseUnit);
  const perUnit = formatPricePerUnit(pricePerUnit, baseUnit);
  const perUnitAria = pricePerUnitAriaLabel(pricePerUnit, baseUnit);
```

- [ ] **Step 2: Render the labelled size under the title**

Directly after the `<h1>` holding `product.title || product.name`:

```tsx
            {size && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                Pakiranje:{" "}
                <span className="font-semibold text-foreground">{size}</span>
              </p>
            )}
```

- [ ] **Step 3: Render the labelled price-per-unit under the price**

Directly after the `flex items-baseline gap-2 sm:gap-3` div that holds `price` and `oldPrice`:

```tsx
          {perUnit && (
            <p
              className="text-xs sm:text-sm text-muted-foreground"
              aria-label={perUnitAria ?? undefined}
            >
              Cena na enoto:{" "}
              <span className="font-semibold text-foreground">{perUnit}</span>
            </p>
          )}
```

`Cena na enoto` is the exact string already at `SearchFilters.tsx:227`, so the sort option and this label read identically. When both values are null neither label renders — never a label against an empty value.

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit
pnpm lint 2>&1 | tail -3
```

Expected: `tsc` exits 0. Lint still at `✖ 6 problems (4 errors, 2 warnings)`.

- [ ] **Step 5: Verify in Chrome**

With `pnpm dev` running, open a product from `/search` and confirm:

- `Pakiranje: 1,98 L` under the title and `Cena na enoto: 1,16 €/L` under the price.
- A `piece` product shows `€/kos`, and its size uses the right plural form.
- A listing with no parsed size shows neither label — no `Pakiranje:` with nothing after it.

- [ ] **Step 6: Commit**

```bash
git add "app/(main)/product/[product_id]/page.tsx"
git commit -m "feat: show packaging and price per unit on the product page"
```

---

### Task 4: Basket

The basket stores the formatted size string rather than the raw numbers, so it needs no formatter and no `baseUnit`.

**Files:**
- Modify: `lib/cart.tsx:16-26` (`CartItem`)
- Modify: `components/shared/ProductCard.tsx` (`handleAddToCart`)
- Modify: `components/shared/ProductCardList.tsx` (`handleAddToCart`)
- Modify: `app/(main)/product/[product_id]/page.tsx` (the `AddToCartButton` item literal)
- Modify: `components/shared/BasketItemCard.tsx:63-72`, `:81-85`

**Interfaces:**
- Consumes: `size` — the `ProductCard`/`ProductCardList` prop from Task 2, and the `size` local from Task 3.
- Produces: `CartItem.size?: string`.

`AddToCartButton` takes `item: Omit<CartItem, "quantity">` and needs no change of its own.

- [ ] **Step 1: Add the field to `CartItem`**

In `lib/cart.tsx`, add to `interface CartItem`:

```ts
  /**
   * Pre-formatted size, e.g. "1,98 L". Absent on entries persisted before
   * sizes shipped, and on listings with no parsed size — both render nothing.
   */
  size?: string;
```

Do not touch the pre-existing lint error at `lib/cart.tsx:66`.

- [ ] **Step 2: Pass the size from both cards**

In `ProductCard.handleAddToCart` and `ProductCardList.handleAddToCart`, add to the `addItem({...})` object literal:

```ts
      size,
```

The `size` prop is already in scope from Task 2.

- [ ] **Step 3: Pass the size from the detail page**

In the `AddToCartButton` `item` literal in `app/(main)/product/[product_id]/page.tsx`, add:

```tsx
                  size: size ?? undefined,
```

`size` is the local from Task 3, which is `string | null`; `CartItem.size` is `string | undefined`, so the coalesce is required.

- [ ] **Step 4: Render the size in `BasketItemCard`**

In the title block, directly after the `<Link>` wrapping the `<h4>`:

```tsx
            {item.size && (
              <span className="block text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                {item.size}
              </span>
            )}
```

- [ ] **Step 5: Disambiguate the per-item price label**

`BasketItemCard` renders `{item.price.toFixed(2)} € / kos` when quantity exceeds one, where `/ kos` means *per item in the cart* — not the API's price-per-piece. With a size now on the same row that reads as if it were `€/kos`. Change that one string to what it has always meant:

```tsx
                  {item.price.toFixed(2)} &euro; / izdelek
```

Leave `toFixed(2)` alone — existing prices keep the decimal point.

- [ ] **Step 6: Typecheck and lint**

```bash
npx tsc --noEmit
pnpm lint 2>&1 | tail -3
```

Expected: `tsc` exits 0. Lint still at `✖ 6 problems (4 errors, 2 warnings)`.

- [ ] **Step 7: Verify in Chrome, including an old cart**

With `pnpm dev` running:

1. Open `/basket` and note whether items are already saved. If not, add one from `/search`, then in DevTools run `JSON.parse(localStorage.getItem("dk-cart"))` and confirm the entry carries `size`.
2. Simulate a pre-upgrade cart: in the console, strip the field and reload.

```js
const items = JSON.parse(localStorage.getItem("dk-cart"));
localStorage.setItem("dk-cart", JSON.stringify(items.map(({ size, ...rest }) => rest)));
location.reload();
```

Expected: the basket renders normally with no size line, no gap and no `undefined`. Re-adding the same product from `/search` restores the size.

3. Set an item's quantity above 1 and confirm the per-item line reads `2.29 € / izdelek`.

- [ ] **Step 8: Commit**

```bash
git add lib/cart.tsx components/shared/ProductCard.tsx components/shared/ProductCardList.tsx components/shared/BasketItemCard.tsx "app/(main)/product/[product_id]/page.tsx"
git commit -m "feat: carry the listing size into the basket"
```

---

### Task 5: Full-surface sweep

No new feature work. Confirms the spec's verification list end to end, since Tasks 2 to 4 each checked only their own screens.

**Files:** none expected. Any fix found here is committed as a `fix:` on top.

- [ ] **Step 1: Re-run the formatter probe against the final module**

```bash
node /private/tmp/claude-501/-Users-svenahac-Documents-Personal-Projects-digitalna-kosarica-frontend/9e1048bd-37ce-4be3-8540-f78b2d9d5076/scratchpad/probe-format.ts
```

Expected: `ALL PASS`. Re-create it from Task 1 Step 3 if the scratchpad was cleared.

- [ ] **Step 2: Confirm a clean build**

```bash
npx tsc --noEmit && pnpm build 2>&1 | tail -20
```

Expected: `tsc` silent, build exits 0 and prints the route table. The build is the gate `tsc` alone misses — a server component importing something client-only fails here, not in `tsc`.

The build already emits three `DYNAMIC_SERVER_USAGE` digests during static generation at baseline, verified before this plan was written. They are not caused by this change and are not a regression — only a non-zero exit or a new error is.

- [ ] **Step 3: Walk every surface at both widths**

With `pnpm dev` running, at phone width and desktop width:

| screen | expect |
|---|---|
| `/` | size and `€/unit` in all three scroll sections |
| `/search?query=coca` | grid and list |
| `/search?query=mleko&filter=PRICE_PER_UNIT&sortOption=ASCENDING` | group boundaries legible from per-row labels alone |
| `/popular` | rows on phone, grid on desktop |
| `/top-discounts` | rows on phone, grid on desktop |
| `/product/<id>` | `Pakiranje` and `Cena na enoto`, plus "Sorodni izdelki" cards |
| `/basket` | size under the name |

Check the four Slovenian piece forms wherever live data offers them, and confirm no screen shows a bare price-per-unit number without its unit label.

- [ ] **Step 4: Confirm nothing regressed on the null path**

Find a listing with no parsed size — sort by `PRICE_PER_UNIT` descending and page to the last page, where `NULLS LAST` puts them. Confirm it appears in the results (not hidden), with no size, no `€/unit`, no dash and no `0`.

- [ ] **Step 5: Report the three backend notes**

Not blocking and not a code change. Pass to the backend team:

- Their handoff diff leaves `pricePerUnit` non-nullable while their own DTO Javadoc and reference formatter treat it as nullable.
- `@Schema` on `pricePerUnit` is missing `nullable = true` in both `StoreProductModel` and `StoreProductDetailModel`.
- We demote sub-metre lengths to `cm`/`mm` rather than rendering `0,01 m`; their display table does not cover values below 1 m.

---

## Self-Review

**Spec coverage.** Section 1 types → Task 1 Steps 1 and Task 2 Step 1. Section 2 formatters, all four deviations → Task 1 Step 2, pinned in Step 3. Section 3 Slovenian strings → Task 1 Step 2 (`PIECE_FORMS`, `PER_UNIT_LABEL`, `PER_UNIT_SPOKEN`), Task 3 Steps 2 and 3 (`Pakiranje`, `Cena na enoto`), Task 4 Step 5 (`€ / izdelek`); the recorded price-separator inconsistency is a Global Constraint and re-confirmed in Task 2 Step 10. Section 4 cards → Task 2 Steps 2 to 4. Section 5 call sites, all five → Task 2 Steps 5 to 7 and Task 3. Section 6 detail page → Task 3. Section 7 basket → Task 4. Section 8 grouped sort → Task 2 Step 10 and Task 5 Step 3; the no-cross-baseUnit-comparison rule is a Global Constraint. Section 9 verification → the browser step in each task plus Task 5. Section 10 backend notes → Task 5 Step 5. No gaps.

**Type consistency.** `formatSize`, `formatPricePerUnit` and `pricePerUnitAriaLabel` keep the same names and `(value, baseUnit)` argument order everywhere. Card props are `size`, `pricePerUnit`, `pricePerUnitAria` in Task 2 and unchanged in Task 4. `CartItem.size` is `string | undefined`, so every call site coalesces the formatters' `string | null`.

**Known constraint, deliberately accepted.** Task 2 is larger than its neighbours because deleting `Product.unit` breaks the cards and all four list call sites simultaneously; splitting it would leave `tsc` red at a task boundary.
