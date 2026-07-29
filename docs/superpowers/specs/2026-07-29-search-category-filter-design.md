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
| `types/search.types.ts` | Add `categoryIds?: number[]` to `SearchRequest`. Add `Category`. |
| `types/product.types.ts` | Add `categoryIds: number[]` to `Product`. |
| `lib/utils.ts` | Add `buildCategoryTree`. |
| `actions/category.actions.ts` | **New.** Server action wrapping `GET /categories`. |
| `app/(main)/search/page.tsx` | Parse `categories` param, fetch category list, pass both down. |
| `components/shared/SearchFilters.tsx` | Accept `categories` prop, add the category `Select`, fix page reset. |

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
```

`types/product.types.ts` — add `categoryIds: number[]` to `Product`. Ascending, and it may
contain a parent **and** its child (`[3, 20]`), so it is not a breadcrumb and not one-id-per-
product. Empty array when no store files the product under any category. Type-only change for
now; nothing renders it. It is what a future category-chip on a product card would use.

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
- A parent with no children yields `children: []` and renders as a plain row. 12 of the 19
  top-level categories currently have no children.
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

Empty state gains one muted line, rendered **only** when `categoryIds.length > 0`:

> *Nekateri izdelki še niso razvrščeni v kategorije.*

## 5. `components/shared/SearchFilters.tsx`

Signature becomes `SearchFilters({ categories }: { categories: Category[] })`. Still
`"use client"`, still driven entirely by URL search params via `router.replace` — no new state
management.

### Page reset

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

### The category Select

Placed after the store select and before the switches.

- Each parent-plus-children cluster wrapped in `SelectGroup`, **no `SelectLabel`**. Every
  category — parent and child — is a selectable `SelectItem`; children indented `pl-6`. Using
  `SelectLabel` for parents would make them non-selectable, killing the rollup feature and
  turning the 12 childless top-level categories into dead rows.
- `"Vse kategorije"` is the first item, `value="all"`, and the default.
- Items reuse the existing item classes:
  `font-semibold text-foreground focus:bg-secondary focus:text-foreground`.
- All labels in Slovenian, matching the rest of the bar.
- If `categories` is empty (API failure or 204), only the "Vse kategorije" row renders and
  search still works.

### Selected value and stale ids

The `Select` value is the **raw** `categories` param when present, else `"all"`.

Deliberate: a stale `?categories=999` matches no item, so the trigger falls back to the
placeholder — whose text is identical to the "all" label, so it is visually indistinguishable —
and picking "Vse kategorije" *is* a value change, so `onValueChange` fires and clears the param.
Coercing an unknown id to `"all"` first would render the same but leave the user unable to clear
it, because Radix does not fire `onValueChange` when re-selecting the current value.

### Handler

```ts
function handleCategoryChange(val: string) {
  updateParam("categories", val === "all" ? null : val);
}
```

Selecting "Vse kategorije" **deletes** the param rather than setting it to an empty string.

## 6. Responsive behaviour

The bar must work down to 320px. Three concerns, each addressed explicitly.

### Trigger layout

Adding a second full-width select would give mobile a fourth stacked block and make the bar
noticeably taller. Instead, wrap both selects in a wrapper that collapses at `sm`, sitting where
the store select sits today:

```tsx
<div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:gap-2 sm:contents">
  {/* store select trigger:    w-full min-[480px]:flex-1 min-[480px]:min-w-0 sm:w-[160px] sm:flex-none */}
  {/* category select trigger: w-full min-[480px]:flex-1 min-[480px]:min-w-0 sm:w-[180px] sm:flex-none */}
</div>
```

- **< 480px:** both selects full width, stacked. At 320px the available width inside the card
  is ~264px; side-by-side would put "Vse kategorije" in ~128px and truncate it, so stacked is
  correct here.
- **480px–639px:** side by side, each `flex-1 min-w-0`. `min-w-0` is required for the trigger's
  built-in `line-clamp-1` on the value to actually truncate inside a flex row.
- **≥ 640px (`sm`):** `sm:contents` removes the wrapper from the layout entirely, so both
  triggers participate in the parent flex row exactly as the store select does today. Desktop
  layout is unchanged apart from the new 180px trigger.

Tailwind v4 is in use, so the `min-[480px]:` arbitrary variant is available. `display: contents`
is broadly supported.

### Dropdown sizing

- `position="popper" sideOffset={4}`.
- `max-h-[min(320px,var(--radix-select-content-available-height))]` — **not** a bare
  `max-h-[320px]`. `SelectContent` already ships
  `max-h-(--radix-select-content-available-height)`; two `max-h` utilities have equal
  specificity, so which one wins depends on their order in the generated stylesheet, not on the
  order in the class string. The `min()` form composes both intents and is order-independent.
  With 36 rows the list scrolls rather than covering the results, and on a short viewport
  (phone in landscape) it still cannot exceed the space Radix measured.
- `max-w-[calc(100vw-2rem)]` so a long name can never push the popper past the viewport edge.
  Radix's popper viewport carries `min-w-[var(--radix-select-trigger-width)]`, so the content
  can grow wider than the trigger; the content also has `overflow-x-hidden`.
- Item text keeps default wrapping. On a narrow phone
  "Sezonsko / Posebni izdelki" may wrap to two lines inside the dropdown — accepted, still
  readable, and preferable to truncating a name the user is choosing between.

### Selected-value truncation

No extra work: `SelectTrigger` already carries
`*:data-[slot=select-value]:line-clamp-1`, which truncates with an ellipsis. It needs the
`min-w-0` from the trigger layout above to take effect in a flex row; inside the fixed
`sm:w-[180px]` desktop trigger it works as-is.

### Empty-state hint

`text-sm text-center max-w-xs px-4` so the Slovenian sentence wraps cleanly on a phone instead
of running to the container edge.

### Desktop row wrapping

The parent row is already `sm:flex-wrap`. The extra 180px trigger may push the switches onto a
second line on ~768px tablets. That is handled by the existing wrap and is acceptable.

## 7. Gotchas carried forward

**Category filtering hides uncategorized products.** The filter is an `EXISTS` on the category
link table, so a product with no category link matches nothing. Coverage as of 2026-07-27:
spar 95.9%, merkator 87.2%, hofer 77.8%, lidl 56.3%. Selecting "Mlečni izdelki" can legitimately
hide a Lidl yoghurt that has no category link yet. PR #28 improves coverage but it will never be
100%. Consequences: the result count **will** drop when a category is selected, sometimes a lot,
and that is expected rather than a bug to chase. Never default to a selected category. The
empty-state hint exists so a thin result set does not read as broken.

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
- No multi-select. That would need a `Popover` with a checkbox list, an "N izbranih" trigger
  label and a clear-all affordance — shadcn's `Select` is not built for multi-value. Revisit if
  analytics show users re-running the same search with different categories back to back.
- No third indent level.

## 9. Verification

Manual against production, since the repo has vitest configured but zero test files. No suite is
being introduced here; `buildCategoryTree` is a pure function specifically so it can be
unit-tested later.

- Category list renders grouped, parents selectable with children indented, "Vse kategorije"
  first and selected by default.
- Selecting a category sets `?categories=<id>` and refetches; selecting "Vse kategorije" removes
  the param entirely rather than setting it empty.
- **Parent rollup:** `q=meso` with `categories=3` returns products whose `product.categoryIds`
  include `20` or `21` but not `3` itself.
- Combines with store, availability, card-discount and sorting (AND semantics).
- `?categories=999` renders the empty state plus the hint, not an error, and is recoverable by
  picking "Vse kategorije".
- `?categories=abc` and `?categories=` are parsed away safely.
- Page resets to 0 when the category changes — and also when store, sort, order or either
  switch changes. Changing `view` does **not** reset the page.
- `GET /categories` failing or returning 204 leaves only "Vse kategorije" and search still works.
- Responsive: filter bar and dropdown usable at 320px, 375px, 480px, 640px and 768px. Selects
  stack below 480px and sit side by side from 480px. Dropdown scrolls rather than covering
  results, never exceeds the viewport horizontally, and a long selected name truncates in the
  trigger rather than overflowing.
