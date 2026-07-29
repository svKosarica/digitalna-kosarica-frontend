# Category filter in search — design

**Date:** 2026-07-29
**Branch:** `feature/search-category-filter` (off `main`)
**Backend:** API live in production, verified 2026-07-27. PRs #27 (API), #28 (map expansion).

## Goal

Let a user narrow `/search` results to a product category from the existing filter bar.
Selecting a **parent** category also returns everything under its subcategories — the rollup
happens server-side, so the client sends one id, never a list of descendants.

Single-select for v1. The server-side rollup already covers the common multi-select case
(picking "Meso" yields meat, cured meats *and* fish), and a single `Select` matches the store
filter's existing shape. The wire format (`categoryIds: number[]`, `categories=2,6`) supports
multi-select later without a migration.

## Files

| File | Change |
| --- | --- |
| `types/search.types.ts` | Add `categoryIds?: number[]` to `SearchRequest`. Add `Category`. Add `ALL_CATEGORIES_LABEL`. |
| `types/product.types.ts` | Add `categoryIds: number[]` to `Product`. |
| `lib/utils.ts` | Add `buildCategoryTree`. |
| `actions/category.actions.ts` | **New.** Server action wrapping `GET /categories`. |
| `app/(main)/search/page.tsx` | Parse `categories` param, fetch category list, pass both down, render coverage hint. |
| `components/shared/SearchFilters.tsx` | Accept `categories` prop, add the category `Select`, fix page reset. |

## Commit order on the branch

Two commits, deliberately separate:

1. **`fix: reset pagination when a search filter changes`** — the `updateParam` change alone.
   This repairs a pre-existing bug affecting the store, sort, order and switch filters and has
   nothing to do with categories. Separate so it is reviewable and revertable on its own.
2. **`feat: filter search results by category`** — everything else.

## 1. Types

`types/search.types.ts`:

```ts
export interface SearchRequest {
  // …existing fields unchanged
  categoryIds?: number[];   // omitted / [] → all categories
}

/** Flat node; the tree is expressed by parentCategoryId, max two levels. */
export interface Category {
  id: number;
  parentCategoryId: number | null;
  name: string;
}

/**
 * Shared by the trigger placeholder and the "all" item label. These MUST stay
 * identical — the stale-id recovery in SearchFilters depends on an unknown id
 * rendering the placeholder and being visually indistinguishable from "all".
 */
export const ALL_CATEGORIES_LABEL = "Vse kategorije";
```

`types/product.types.ts` — add `categoryIds: number[]` to `Product`. Ascending, and it may
contain a parent **and** its child (`[3, 20]`), so it is not a breadcrumb and not one-id-per-
product. Empty array when no store files the product under any category. Nothing renders it in
v1; it exists so the rollup can be verified (see Verification) and is what a future category
chip on a product card would use.

## 2. Server action — `actions/category.actions.ts`

```ts
"use server";

import type { Category } from "@/types/search.types";

export async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${process.env.API_URL}/categories`, {
      // Liquibase-seeded reference data — ids and names are stable, so cache hard.
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.error(`Categories API error: ${res.status} ${res.statusText}`);
      return [];
    }
    const text = await res.text();
    if (!text) return []; // 204
    return JSON.parse(text) as Category[];
  } catch (error) {
    console.error("Categories request failed:", error);
    return [];
  }
}
```

**Why a server action:** the backend has no CORS configuration by design. Every call goes
through a server action with `process.env.API_URL`. Do not fetch this from the browser.

**Why cached:** unlike `searchProducts` (`cache: "no-store"`), this is reference data seeded by
Liquibase migrations — a new category only appears with a deploy.

Error shape mirrors `search.actions.ts` exactly: every failure path returns `[]`, so a
categories outage degrades to a working search with only "Vse kategorije" in the dropdown.

## 3. Tree builder — `lib/utils.ts`

A pure exported function alongside the existing `productCountLabel` / `normalizeStoreName`
domain helpers:

```ts
buildCategoryTree(categories: Category[]): Array<{ parent: Category; children: Category[] }>
```

- Groups by `parentCategoryId`; `null` means top level.
- **Preserves API array order** at both levels. No alphabetical sort, no hardcoded id table —
  the category set will drift and a hardcoded list would rot.
- A child whose `parentCategoryId` matches no returned parent is **dropped**, not rendered as
  an orphan.
- A parent with no children yields `children: []`. 12 of the 19 top-level categories currently
  have none.
- Pure function, no React import, so it is unit-testable independently of the component.

## 4. `app/(main)/search/page.tsx`

Parse defensively, exactly like `stores`:

```ts
const categoryIds = typeof params.categories === "string"
  ? params.categories.split(",").map(Number).filter(Boolean)
  : [];
```

Parsed as an array even though v1 is single-select, so the format is multi-select-ready and
`?categories=abc`, `?categories=`, `?categories=0` are all dropped by `filter(Boolean)`.

Sent as:

```ts
categoryIds: categoryIds.length ? categoryIds : undefined
```

**Never** defaulting to all 36 ids — unlike `storeIds`, which does default to `ALL_STORE_IDS`.
Omitted / `null` / `[]` already means "every category" server-side, and sending every id would
be wrong. `JSON.stringify` drops the `undefined` key.

`getCategories()` runs in parallel with `searchProducts()` via `Promise.all`, then:

```tsx
<SearchFilters categories={categories} />
```

Latency is `max(search, categories)`, not the sum. With a 24h cache the categories call is
almost always warm, but note the new coupling: a pathologically slow `/categories` would now
slow the search page. Acceptable given the cache; `app/(main)/search/loading.tsx` already
covers the render gap.

### Coverage hint

One muted line under the result count in `<header>`, rendered whenever
`categoryIds.length > 0` — empty results or not:

> *Nekateri izdelki še niso razvrščeni v kategorije.*

**Why unconditional, not empty-state-only.** The empty state is the case where the user already
knows something is off. The dangerous case is the plausible one: a Lidl shopper filters to
"Mlečni izdelki", sees 14 results and concludes that is all the yoghurt Lidl carries. At 56.3%
coverage nearly half is missing and nothing else on screen says so. A warning that fires only at
zero results is silent exactly when it matters most.

Rendering it in the header means one render site covering both cases — the empty state sits
below it and needs no copy of its own.

## 5. `components/shared/SearchFilters.tsx`

Signature becomes `SearchFilters({ categories }: { categories: Category[] })`. Still
`"use client"`, still driven entirely by URL search params via `router.replace` — no new state
management.

### Page reset (commit 1)

`updateParam` deletes `page` whenever the changed key is neither `page` nor `view`:

```ts
// Any filter change invalidates the current page offset.
// `view` is presentation-only, so it keeps your place.
if (key !== "page" && key !== "view") params.delete("page");
```

This fixes a **pre-existing bug** affecting the store, sort, order and switch filters too — a
user on page 4 who changes a filter currently lands on page 4 of a shorter result set and sees
an empty list. The category filter makes it far more visible because it shrinks the result set
most, but the fix belongs in `updateParam` for all filters rather than special-cased.

The mount `useEffect` that seeds `view` builds its own `URLSearchParams` and does not go through
`updateParam`, so it is unaffected.

`updateParam` keeps Next's default scroll-to-top, unlike `FilterPills`, which passes
`scroll: false`. Knowingly left alone: a filter change now resets to page 0, so returning to the
top of the results is the correct behaviour here even though the two components differ.

### Dropdown structure (commit 2)

Placed after the store select and before the switches.

```
┌─────────────────────────────┐
│ Vse kategorije              │  SelectItem "all"      ← default
├─────────────────────────────┤
│ Sadje in Zelenjava          │  SelectItem 1          ← childless: plain row
│ Mlečni izdelki              │  SelectItem 2
│ MESO                        │  SelectLabel           ← group heading
│    Meso — vse               │  SelectItem 3   pl-6   ← the rollup
│    Meso & mesni izdelki     │  SelectItem 20  pl-6
│    Ribe                     │  SelectItem 21  pl-6
│ PIJAČE                      │  SelectLabel
│    Pijače — vse             │  SelectItem 4   pl-6
│    Alkoholne pijače         │  SelectItem 22  pl-6
│    Brezalkoholne pijače     │  SelectItem 23  pl-6
│ …                           │
└─────────────────────────────┘
```

- A parent **with** children renders as a `SelectGroup`: a `SelectLabel` carrying the parent
  name, then the parent itself as a selectable `SelectItem` labelled `` `${name} — vse` ``, then
  its children. All items inside a group get `pl-6`; the label keeps `SelectLabel`'s default
  `px-2`.
- A parent **without** children renders as a plain `SelectItem` at default padding, outside any
  group. Groups and plain rows interleave in API order.
- Every category stays selectable, parents included. Using `SelectLabel` *instead of* a
  selectable parent row would kill the rollup and strand the 12 childless top-level categories
  as dead rows.

**Why the label + `— vse` rename rather than bare indentation.** Two problems with indentation
alone: nothing tells a sighted user that picking "Meso" also returns fish, and a `SelectGroup`
with no `SelectLabel` is a group with no accessible name — a screen reader hears 36 flat items
with no parent/child relationship, because `pl-6` is pure decoration. The heading supplies the
group's accessible name and the `— vse` suffix makes the rollup self-evident.

**Slovenian declension.** `"Vse v Meso"` is ungrammatical — the locative would be `"v Mesu"` —
and correctly declining 19 category names does not belong in a template. The
`` `${name} — vse` `` suffix pattern sidesteps grammatical case entirely and reads correctly for
all 19.

- `"Vse kategorije"` is the first item, `value="all"`, and the default. Both it and the trigger
  placeholder use `ALL_CATEGORIES_LABEL`.
- Items reuse the existing item classes:
  `font-semibold text-foreground focus:bg-secondary focus:text-foreground`.
- All labels in Slovenian, matching the rest of the bar.
- If `categories` is empty (API failure or 204), only the "Vse kategorije" row renders and
  search still works.

### Selected value and stale ids

The `Select` value is the **raw** `categories` param when present, else `"all"`.

Deliberate: a stale `?categories=999` matches no item, so the trigger falls back to the
placeholder — identical text to the "all" label via `ALL_CATEGORIES_LABEL`, so visually
indistinguishable — and picking "Vse kategorije" *is* a value change, so `onValueChange` fires
and clears the param. Coercing an unknown id to `"all"` first would render the same but leave
the user unable to clear it, because Radix does not fire `onValueChange` when re-selecting the
current value.

### Handler

```ts
function handleCategoryChange(val: string) {
  updateParam("categories", val === "all" ? null : val);
}
```

Selecting "Vse kategorije" **deletes** the param rather than setting it to an empty string.

## 6. Responsive behaviour

The bar must work down to 320px.

### Trigger layout

Both selects are full width and stacked below `sm`, side by side from `sm` — the store select's
existing pattern, extended to a second control:

- store trigger: `w-full sm:w-[160px]` (unchanged)
- category trigger: `w-full sm:w-[180px]`

No wrapper element and no intermediate breakpoint. An earlier draft put the two selects
side-by-side from 480px via `sm:contents`; dropped as arbitrary complexity for a marginal gain
in bar height. At 320px there is only ~264px inside the card, so side-by-side would truncate
"Vse kategorije" anyway.

### Dropdown sizing

- `position="popper" sideOffset={4}`.
- `max-h-[min(320px,var(--radix-select-content-available-height))]` — **not** a bare
  `max-h-[320px]`. `SelectContent` already ships
  `max-h-(--radix-select-content-available-height)`; two `max-h` utilities have equal
  specificity, so which wins depends on their order in the generated stylesheet, not on the
  order in the class string. The `min()` form composes both intents and is order-independent.
  The list scrolls rather than covering the results, and on a short viewport (phone in
  landscape) it still cannot exceed the space Radix measured.
- `max-w-[calc(100vw-2rem)]` so a long name can never push the popper past the viewport edge.
  Radix's popper viewport carries `min-w-[var(--radix-select-trigger-width)]`, so content can
  grow wider than the trigger; the content also has `overflow-x-hidden`.
- Item text keeps default wrapping. On a narrow phone "Sezonsko / Posebni izdelki — vse" may
  wrap to two lines inside the dropdown — accepted, still readable, and preferable to truncating
  a name the user is choosing between.

### Selected-value truncation

No extra work: `SelectTrigger` already carries `*:data-[slot=select-value]:line-clamp-1`, which
truncates with an ellipsis. Inside the full-width mobile trigger and the fixed `sm:w-[180px]`
desktop trigger it works as-is.

### Coverage hint

`text-sm` muted, in the header's normal flow, so it wraps cleanly on a phone.

### Desktop row wrapping

The parent row is already `sm:flex-wrap`. The extra 180px trigger may push the switches onto a
second line on ~768px tablets. Handled by the existing wrap; acceptable.

## 7. Gotchas carried forward

**Category filtering hides uncategorized products.** The filter is an `EXISTS` on the category
link table, so a product with no category link matches nothing. Coverage as of 2026-07-27:
spar 95.9%, merkator 87.2%, hofer 77.8%, lidl 56.3%. Selecting "Mlečni izdelki" can legitimately
hide a Lidl yoghurt that has no category link yet. PR #28 improves coverage but it will never be
100%. Consequences: the result count **will** drop when a category is selected, sometimes a lot,
and that is expected rather than a bug to chase. Never default to a selected category. The
coverage hint exists so an incomplete result set does not read as authoritative.

**`Alkoholne pijače` (22) includes 79 alcohol-free products** — Heineken 0.0%, alcohol-free
sparkling wine, radlers, mocktails. This is Spar's own shelving, faithfully recorded, documented
in the backend's `docs/category-data-quality.md`, and not being changed without a product
decision. Do not present the category as "contains alcohol" — no age gate, no warning.

**`Slo izdelki` (34) has more products than its parent `Sezonsko / Posebni izdelki` (19).** Not
a bug; the rollup means selecting 19 returns both.

**Zero-product categories stay visible.** `Ostalo` (5) has 0 products and `Brez laktoze` (35)
has 2. The endpoint does not return counts, so hiding them would require a hardcoded list that
would rot. They simply return few or no results. Asking the backend to return counts is a
possible future change.

**Two levels only,** asserted by the backend. A third level would surface as a
`parentCategoryId` pointing at a non-root category and would need another indent level plus a
recursive backend expansion.

## 8. Out of scope

- No `STORE_MAP` change. `{1: spar, 2: lidl, 3: mercator, 4: hofer}` matches the production
  `store` table; the backend's OpenAPI text claiming "1=SPAR, 2=MERKATOR, 3=LIDL" is stale and
  already reported. Do not "fix" the frontend to match Swagger.
- No `mercator` / `merkator` spelling cleanup (`normalizeStoreName` in `lib/utils.ts`).
- No category chips on product cards.
- No `usePathname()` refactor of `SearchFilters` — it hardcodes `/search`, as `FilterPills`'
  header comment notes, but that is unrelated to this change.

### Documented upgrade path

Not commitments, just the two things to reach for if v1 disappoints:

- **Combobox instead of `Select`.** With group headings the list runs ~43 rows. A `Popover` +
  `Command` with type-to-filter beats scrolling outright — typing "mle" jumps to Mlečni izdelki
  instead of scrolling past 19 headings. `Select` is right for v1 (no new component, matches the
  store filter, 19 top-level rows scroll tolerably), but this is the first upgrade if the
  dropdown feels bad in the hand.
- **Multi-select.** Needs a `Popover` with a checkbox list, an "N izbranih" trigger label and a
  clear-all affordance — shadcn's `Select` is not built for multi-value. The wire format already
  supports it (max 64 ids). The rollup covers the common sibling case, so this only matters for
  genuinely unrelated pairs like "Mlečni izdelki OR Pekovski izdelki".

## 9. Verification

Manual against production, since the repo has vitest configured but zero test files. No suite is
being introduced here; `buildCategoryTree` is a pure function specifically so it can be
unit-tested later.

- Dropdown renders "Vse kategorije" first and selected by default; parents with children appear
  as a heading plus a `— vse` row plus indented children; childless parents appear as plain rows;
  order matches the API's.
- Selecting a category sets `?categories=<id>` and refetches; selecting "Vse kategorije" removes
  the param entirely rather than setting it empty.
- **Parent rollup:** `q=meso` with `categories=3` returns products whose `product.categoryIds`
  include `20` or `21` but not `3` itself.
- Combines with store, availability, card-discount and sorting (AND semantics).
- Coverage hint appears whenever a category is active — with results and with zero results — and
  is absent when no category is active.
- `?categories=999` renders the empty state plus the hint, not an error, and is recoverable by
  picking "Vse kategorije".
- `?categories=abc` and `?categories=` are parsed away safely.
- Page resets to 0 when the category changes — and also when store, sort, order or either
  switch changes. Changing `view` does **not** reset the page.
- `GET /categories` failing or returning 204 leaves only "Vse kategorije" and search still works.
- Responsive at 320px, 375px, 640px and 768px: selects stack below `sm` and sit side by side
  from `sm`; the dropdown scrolls rather than covering results, never exceeds the viewport
  horizontally, and a long selected name truncates in the trigger rather than overflowing.
- Screen reader announces each subcategory within its named parent group.
