# Category Filter in Search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user narrow `/search` results to one product category from the existing filter bar, where selecting a parent category also returns its subcategories.

**Architecture:** A new `Select` in the existing `SearchFilters` client component writes a `categories` URL search param; the server component `app/(main)/search/page.tsx` parses it and forwards `categoryIds` to the existing search endpoint. The category list itself comes from a new cached server action, because the backend has no CORS config. The parent→children rollup happens server-side, so the client always sends exactly one id.

**Tech Stack:** Next.js 16 (App Router, React 19), TypeScript, Tailwind CSS v4, shadcn/ui on Radix.

**Spec:** `docs/superpowers/specs/2026-07-29-search-category-filter-design.md`
**Branch:** `feature/search-category-filter` (already exists, off `main`, spec already committed)

**Verification approach:** no test suite. This repo has no test files and none are being added. Each task ends with a short browser check driven through Chrome against the running dev server, and Task 7 is a final sweep. `pnpm lint` and `pnpm build` are the only automated gates.

## Global Constraints

Every task's requirements implicitly include this section.

- **All user-facing copy is Slovenian.** Match the existing filter bar's tone.
- **Never fetch the backend from the browser.** No CORS config exists by design. Every backend call goes through a `"use server"` action using `process.env.API_URL`.
- **Never send all 36 category ids.** Omitted / `null` / `[]` already means "every category" server-side. Send `undefined` when nothing is selected.
- **Never send a parent's descendants.** Send `[3]`, not `[3, 20, 21]`. The backend expands descendants itself.
- **Preserve the API's array order** when rendering categories. No alphabetical sort, no hardcoded id table — the category set will drift.
- **Do not change `STORE_MAP`.** `{1: spar, 2: lidl, 3: mercator, 4: hofer}` is correct; the backend's Swagger text is stale.
- **Do not add an age gate or alcohol warning** to `Alkoholne pijače` (22) — it deliberately contains 79 alcohol-free products.
- **Slovenian declension:** never interpolate a category name into a grammatical case (`"Vse v Meso"` is wrong — locative would be `"v Mesu"`). Only the suffix form `` `${name} — vse` `` is allowed.
- **Do not add test files or test tooling.**
- Existing item classes to reuse verbatim: `font-semibold text-foreground focus:bg-secondary focus:text-foreground`.

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `components/shared/SearchFilters.tsx` | Filter bar UI; owns all URL param writes via `updateParam` | 1, 5 |
| `types/search.types.ts` | Request/domain types + `ALL_CATEGORIES_LABEL` | 2 |
| `types/product.types.ts` | `Product.categoryIds` | 2 |
| `lib/utils.ts` | `buildCategoryTree` — pure flat-list→two-level grouping | 2 |
| `actions/category.actions.ts` | `getCategories` server action + its degradation contract | 3 |
| `app/(main)/search/page.tsx` | Parses params, fetches, renders results + coverage hint | 4, 5, 6 |

## Commit Strategy

**Task 1 must be its own commit** (`fix: …`). It repairs a pre-existing pagination bug affecting the store, sort, order and switch filters, and has nothing to do with categories — keeping it separate makes it reviewable and revertable on its own.

Tasks 2–6 each end in their own commit for reviewability. Squash them into a single `feat:` commit at merge time if you prefer; the spec's requirement is only that the Task 1 fix stay independent.

---

### Task 1: Reset pagination when any filter changes

Pre-existing bug: `updateParam` preserves every other param, including `page`. A user on page 4 who narrows the results stays on page 4 of a much shorter set and sees an empty list. Affects the store, sort, order and both switches today; the category filter would make it far worse.

**Files:**
- Modify: `components/shared/SearchFilters.tsx:45-56`

**Interfaces:**
- Consumes: nothing.
- Produces: `updateParam(key: string, value: string | null): void` — unchanged signature, now also deletes `page` when `key` is neither `"page"` nor `"view"`. Every later task relies on this behaviour and must not re-implement it.

- [ ] **Step 1: Replace the `updateParam` callback**

Replace lines 45–56 in `components/shared/SearchFilters.tsx` with:

```tsx
  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      // Any filter change invalidates the current page offset — a user on page 4
      // who narrows the results would otherwise land on an empty page 4.
      // `view` is presentation-only, so it keeps your place.
      if (key !== "page" && key !== "view") {
        params.delete("page");
      }
      router.replace(`/search?${params.toString()}`);
    },
    [router, searchParams],
  );
```

The mount `useEffect` that seeds `view` (lines 32–39) builds its own `URLSearchParams` and does **not** go through `updateParam`, so it is unaffected. Leave it alone.

- [ ] **Step 2: Browser check**

`pnpm dev`, then open `http://localhost:3000/search?q=mleko&page=4` and toggle **Na zalogi**.

- Expected: `page` disappears from the URL and results return to the first page.
- Then click the grid/list **view** toggle from a `page=4` URL — expected: `page` survives.

- [ ] **Step 3: Commit**

```bash
git add components/shared/SearchFilters.tsx
git commit -m "fix: reset pagination when a search filter changes

updateParam preserved every param including page, so changing a filter
left the user on a stale page of a shorter result set — an empty list.
Deleting page on any non-page, non-view change fixes it for the store,
sort, order and switch filters alike. view is presentation-only and
keeps its place."
```

---

### Task 2: Types and the category tree builder

**Files:**
- Modify: `types/search.types.ts`
- Modify: `types/product.types.ts:6-13`
- Modify: `lib/utils.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Category { id: number; parentCategoryId: number | null; name: string }` from `@/types/search.types`
  - `interface CategoryTreeNode { parent: Category; children: Category[] }` from `@/types/search.types`
  - `const ALL_CATEGORIES_LABEL: string` from `@/types/search.types`
  - `SearchRequest.categoryIds?: number[]`
  - `Product.categoryIds: number[]`
  - `buildCategoryTree(categories: Category[]): CategoryTreeNode[]` from `@/lib/utils`

- [ ] **Step 1: Add the request field and domain types**

In `types/search.types.ts`, add `categoryIds` to `SearchRequest`:

```ts
export interface SearchRequest {
  page: number;
  size: number;
  query: string;
  filter: FilterOption;
  sortOption: SortOption;
  storeIds?: number[];
  isAvailable: boolean;
  cardDiscount: boolean;
  /** Omitted / null / [] all mean "every category". A parent id matches its children too. */
  categoryIds?: number[];
}
```

Then append to the same file:

```ts
/** Flat node as returned by GET /categories; the tree is expressed by parentCategoryId. */
export interface Category {
  id: number;
  parentCategoryId: number | null;
  name: string;
}

/** One top-level category with its subcategories. The tree is exactly two levels deep. */
export interface CategoryTreeNode {
  parent: Category;
  children: Category[];
}

/**
 * Shared by the trigger placeholder and the "all" item label. These MUST stay
 * identical — stale-id recovery in SearchFilters depends on an unknown id
 * rendering the placeholder and being visually indistinguishable from "all".
 */
export const ALL_CATEGORIES_LABEL = "Vse kategorije";
```

- [ ] **Step 2: Add `categoryIds` to `Product`**

In `types/product.types.ts`:

```ts
export interface Product {
  id: number;
  brand: Brand;
  name: string;
  title: string;
  unit: string;
  imageUrl: string;
  /**
   * Ascending. May contain a parent AND its subcategory (e.g. [3, 20]), so this
   * is not a breadcrumb and not one-id-per-product. Empty when no store files
   * the product under any category. Unused in the UI today.
   */
  categoryIds: number[];
}
```

- [ ] **Step 3: Implement `buildCategoryTree`**

Add the type import at the top of `lib/utils.ts`:

```ts
import type { Category, CategoryTreeNode } from "@/types/search.types";
```

Append to the same file:

```ts
/**
 * Turns the flat GET /categories array into one entry per top-level category.
 *
 * API array order is preserved at both levels — the category set drifts, so
 * never sort or hardcode it. A child whose parentCategoryId matches no
 * top-level category is dropped rather than rendered as an orphan. The tree is
 * exactly two levels deep; the backend asserts this.
 */
export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const childrenByParentId = new Map<number, Category[]>();

  for (const category of categories) {
    if (category.parentCategoryId === null) continue;
    const siblings = childrenByParentId.get(category.parentCategoryId);
    if (siblings) {
      siblings.push(category);
    } else {
      childrenByParentId.set(category.parentCategoryId, [category]);
    }
  }

  return categories
    .filter((category) => category.parentCategoryId === null)
    .map((parent) => ({
      parent,
      children: childrenByParentId.get(parent.id) ?? [],
    }));
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm lint`
Expected: clean. Nothing consumes the new exports yet, so there is nothing to see in the browser.

- [ ] **Step 5: Commit**

```bash
git add types/search.types.ts types/product.types.ts lib/utils.ts
git commit -m "feat: add category types and the category tree builder

buildCategoryTree turns the flat GET /categories array into one entry per
top-level category, preserving API order and dropping orphans."
```

---

### Task 3: `getCategories` server action

**Files:**
- Create: `actions/category.actions.ts`

**Interfaces:**
- Consumes: `Category` from `@/types/search.types` (Task 2).
- Produces: `getCategories(): Promise<Category[]>` from `@/actions/category.actions`. Returns `[]` on every failure path — non-2xx, empty body (204), malformed JSON, network throw. Never rejects, never returns `null`.

- [ ] **Step 1: Create the action**

```ts
"use server";

import type { Category } from "@/types/search.types";

export async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${process.env.API_URL}/categories`, {
      // Liquibase-seeded reference data — ids and names only change with a
      // backend deploy, so cache hard rather than using no-store like search.
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      console.error(`Categories API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const text = await res.text();
    if (!text) return []; // 204 No Content

    return JSON.parse(text) as Category[];
  } catch (error) {
    console.error("Categories request failed:", error);
    return [];
  }
}
```

`JSON.parse` sits inside the `try`, so a malformed body degrades to `[]` like every other failure. This mirrors `actions/search.actions.ts` exactly.

- [ ] **Step 2: Typecheck**

Run: `pnpm lint`
Expected: clean. Wired up in Task 5.

- [ ] **Step 3: Commit**

```bash
git add actions/category.actions.ts
git commit -m "feat: add getCategories server action

Wraps GET /categories with a 24h revalidate — it is Liquibase-seeded
reference data, unlike search which is no-store. Every failure path
returns [] so a categories outage degrades to an all-categories
dropdown with search still working. Server-side because the backend
has no CORS config by design."
```

---

### Task 4: Wire `categoryIds` into the search request

No UI yet. After this task the filter works via a hand-edited URL, which is the cheapest way to confirm the backend contract before touching any component.

**Files:**
- Modify: `app/(main)/search/page.tsx:41-58`

**Interfaces:**
- Consumes: `SearchRequest.categoryIds` (Task 2).
- Produces: a `categoryIds: number[]` local in `SearchPage`, used by Tasks 5 and 6.

- [ ] **Step 1: Parse the param**

Immediately after the existing `storeIds` block (which ends `: ALL_STORE_IDS;`), add:

```tsx
  // Parsed as an array even though the UI is single-select, so the wire format
  // is multi-select-ready. filter(Boolean) drops the NaN from ?categories=abc
  // and the 0 from a hand-edited URL.
  const categoryIds = typeof params.categories === "string"
    ? params.categories.split(",").map(Number).filter(Boolean)
    : [];
```

- [ ] **Step 2: Send it**

Add one line to the existing `searchProducts` call, after `storeIds,`:

```tsx
    // undefined, not [] — omitted means "every category" server-side. Sending
    // all 36 ids would be wrong: it excludes uncategorized products.
    categoryIds: categoryIds.length ? categoryIds : undefined,
```

- [ ] **Step 3: Browser check**

`pnpm dev`, then compare result counts across these URLs:

| URL | Expected |
| --- | --- |
| `/search?q=mleko` | baseline count |
| `/search?q=mleko&categories=2` | smaller count — a large drop is correct, coverage is 56.3% at Lidl |
| `/search?q=meso&categories=3` | results present — the parent rollup working |
| `/search?q=mleko&categories=999` | empty state, no error |
| `/search?q=mleko&categories=abc` | identical to baseline |
| `/search?q=mleko&categories=` | identical to baseline |
| `/search?q=mleko&categories=2&stores=1` | smaller still — filters AND together |

- [ ] **Step 4: Commit**

```bash
git add "app/(main)/search/page.tsx"
git commit -m "feat: forward a categories URL param to the search request

Parsed defensively like stores, and sent as undefined rather than [] or
all 36 ids — omitted already means every category server-side. Filter is
usable by URL at this point; the dropdown lands next."
```

---

### Task 5: The category dropdown

**Files:**
- Modify: `components/shared/SearchFilters.tsx`
- Modify: `app/(main)/search/page.tsx`

**Interfaces:**
- Consumes: `buildCategoryTree`, `Category`, `ALL_CATEGORIES_LABEL` (Task 2); `getCategories` (Task 3); the `categoryIds` local (Task 4); `updateParam`'s page-reset behaviour (Task 1).
- Produces: `SearchFilters` now requires a `categories: Category[]` prop.

- [ ] **Step 1: Fetch the category list in the page**

Add the import next to the existing `searchProducts` import:

```tsx
import { getCategories } from "@/actions/category.actions";
```

Replace the existing `const response = await searchProducts({ … });` statement with a parallel fetch. Latency becomes `max(search, categories)` rather than the sum, and the categories call is almost always served from the 24h cache:

```tsx
  const [response, categories] = await Promise.all([
    searchProducts({
      page: currentPage,
      size: PAGE_SIZE,
      query,
      filter,
      sortOption: order,
      isAvailable,
      cardDiscount,
      storeIds,
      // undefined, not [] — omitted means "every category" server-side. Sending
      // all 36 ids would be wrong: it excludes uncategorized products.
      categoryIds: categoryIds.length ? categoryIds : undefined,
    }),
    getCategories(),
  ]);
```

Then replace `<SearchFilters />` with:

```tsx
      <SearchFilters categories={categories} />
```

- [ ] **Step 2: Accept the prop in `SearchFilters`**

Extend the imports:

```tsx
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_CATEGORIES_LABEL, STORE_MAP } from "@/types/search.types";
import type { Category } from "@/types/search.types";
import { buildCategoryTree, cn } from "@/lib/utils";
```

Add a module-level constant next to the existing `ALL_STORE_IDS`, so the long class string is not repeated five more times:

```tsx
const ITEM_CLASS =
  "font-semibold text-foreground focus:bg-secondary focus:text-foreground";
```

Change the signature:

```tsx
interface SearchFiltersProps {
  /** Flat list from GET /categories. Empty when the endpoint fails or returns 204. */
  categories: Category[];
}

export function SearchFilters({ categories }: SearchFiltersProps) {
```

Leave the existing store/sort `SelectItem` class strings as they are — rewriting them to use `ITEM_CLASS` would enlarge this diff for no behaviour change.

- [ ] **Step 3: Derive the tree and the selected value**

Add after the existing `selectedStores` declaration:

```tsx
  const categoryTree = buildCategoryTree(categories);

  // The raw param, deliberately not validated against `categories`. An unknown
  // id matches no item, so the trigger falls back to the placeholder — same text
  // as the "all" label — and picking "Vse kategorije" is then a real value
  // change that clears the param. Coercing to "all" first would look identical
  // but strand the user, since Radix does not fire onValueChange when
  // re-selecting the current value.
  const selectedCategory = searchParams.get("categories") ?? "all";
```

Add the handler next to `handleStoreChange`:

```tsx
  function handleCategoryChange(val: string) {
    updateParam("categories", val === "all" ? null : val);
  }
```

- [ ] **Step 4: Render the Select**

Insert immediately after the closing `</Select>` of the store select and before the `{/* Switches row */}` comment:

```tsx
        {/* Category select */}
        <Select value={selectedCategory} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-full sm:w-[180px] bg-card border-border text-foreground font-bold text-sm">
            <SelectValue placeholder={ALL_CATEGORIES_LABEL} />
          </SelectTrigger>
          <SelectContent
            position="popper"
            sideOffset={4}
            // `cn` is twMerge, so this max-h REPLACES SelectContent's own
            // max-h-(--radix-select-content-available-height) rather than
            // layering over it. min() keeps the viewport clamp; a bare
            // max-h-[320px] would overflow a short viewport.
            className="bg-card border-border max-h-[min(320px,var(--radix-select-content-available-height))] max-w-[calc(100vw-2rem)]"
          >
            <SelectItem value="all" className={ITEM_CLASS}>
              {ALL_CATEGORIES_LABEL}
            </SelectItem>
            {categoryTree.map(({ parent, children }) =>
              children.length === 0 ? (
                <SelectItem key={parent.id} value={String(parent.id)} className={ITEM_CLASS}>
                  {parent.name}
                </SelectItem>
              ) : (
                <SelectGroup key={parent.id}>
                  {/* Supplies the group's accessible name — without it a screen
                      reader hears a flat list and pl-6 is pure decoration. */}
                  <SelectLabel className="text-muted-foreground">{parent.name}</SelectLabel>
                  {/* The rollup, spelled out. Suffix form avoids declining the
                      name ("Vse v Meso" would be ungrammatical Slovenian). */}
                  <SelectItem
                    value={String(parent.id)}
                    className={cn(ITEM_CLASS, "pl-6")}
                  >
                    {parent.name} — vse
                  </SelectItem>
                  {children.map((child) => (
                    <SelectItem
                      key={child.id}
                      value={String(child.id)}
                      className={cn(ITEM_CLASS, "pl-6")}
                    >
                      {child.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ),
            )}
          </SelectContent>
        </Select>
```

- [ ] **Step 5: Browser check**

`pnpm lint` first — expected clean, in particular no unused-import or missing-prop errors.

Then `pnpm dev`, open `/search?q=mleko` and open the dropdown:

1. **Vse kategorije** first and selected; top-level categories in API order; each parent with children shows as a muted heading, then an indented **`<name> — vse`** row, then its indented children; the 12 childless parents show as plain unindented rows.
2. The list scrolls inside the dropdown rather than covering the results.
3. Pick **Meso — vse** → `?q=mleko&categories=3`, results refetch, no `page` param.
4. Pick **Ribe** → `?categories=21`.
5. Pick **Vse kategorije** → the `categories` param is **deleted**, not emptied.
6. Load `?categories=999` → trigger reads "Vse kategorije", results empty; picking **Vse kategorije** clears the stale param.
7. From `?q=mleko&page=4`, pick a category → `page` is gone (Task 1 doing its job).
8. Run `API_URL=http://127.0.0.1:1 pnpm dev` and load `/search?q=mleko` → dropdown holds only "Vse kategorije" and the page still renders. Restore `.env` afterwards.

- [ ] **Step 6: Commit**

```bash
git add components/shared/SearchFilters.tsx "app/(main)/search/page.tsx"
git commit -m "feat: add the category select to the search filter bar

Parents stay selectable as '<name> — vse' under a SelectLabel heading:
the heading gives the group an accessible name and the suffix makes the
server-side rollup self-evident, where bare indentation told nobody
anything. Suffix form also avoids declining 19 Slovenian names.

The Select value is the raw param so an unknown id falls back to the
placeholder and stays clearable. max-h uses min() because cn is twMerge
and would otherwise drop Radix's viewport clamp."
```

---

### Task 6: Coverage hint

Up to 44% of Lidl products carry no category link, so a filtered result set can be silently incomplete. The empty state is not enough: the dangerous case is 14 plausible-looking results that the user reads as authoritative.

**Files:**
- Modify: `app/(main)/search/page.tsx` (the `<header>` block)

**Interfaces:**
- Consumes: the `categoryIds` local (Task 4).
- Produces: nothing.

- [ ] **Step 1: Render the hint**

Inside `<header>`, directly after the `<p>` holding the result count:

```tsx
        {categoryIds.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground/80">
            Nekateri izdelki še niso razvrščeni v kategorije.
          </p>
        )}
```

In the header rather than the empty state, so one render site covers both the empty and the non-empty case.

- [ ] **Step 2: Browser check**

| URL | Expected |
| --- | --- |
| `/search?q=mleko` | no hint |
| `/search?q=mleko&categories=2` | hint visible, results present |
| `/search?q=mleko&categories=999` | hint visible above the empty state |
| `/search?q=mleko&categories=abc` | no hint — no category is active |

Also narrow to 320px and confirm the sentence wraps without horizontal overflow.

- [ ] **Step 3 (optional, adjacent bug): fix the result-count plural**

The line directly above the hint reads `{response.allItems === 1 ? "izdelek" : "izdelkov"}`, which is wrong for 2, 3 and 4 in Slovenian — "2 izdelkov" should be "2 izdelka". `productCountLabel` in `lib/utils.ts` already implements all four count forms and is unused here.

Not required by the spec — take it or leave it. To take it, import:

```tsx
import { normalizeStoreName, productCountLabel } from "@/lib/utils";
```

and replace `{response.allItems} {response.allItems === 1 ? "izdelek" : "izdelkov"}` with:

```tsx
{productCountLabel(response.allItems)}
```

Check searches returning 1, 2, 3 and 5 results: "1 izdelek", "2 izdelka", "3 izdelki", "5 izdelkov".

- [ ] **Step 4: Commit**

```bash
git add "app/(main)/search/page.tsx"
git commit -m "feat: warn that some products are uncategorized

Shown whenever a category is active, not only on an empty result set:
at 56.3% coverage for Lidl a filtered search can look complete while
hiding half the shelf, and that is the case a user cannot detect."
```

---

### Task 7: Final sweep

No code unless a check fails.

**Files:**
- Modify: whichever file a failing check points at.

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: nothing.

- [ ] **Step 1: Automated gates**

```bash
pnpm lint
pnpm build
```

Expected: lint clean, build succeeding with no type errors.

- [ ] **Step 2: Responsive sweep in the browser**

`pnpm dev`, `/search?q=mleko`, at 320px / 375px / 640px / 768px / 1280px:

1. **< 640px:** both selects full width and stacked. No horizontal page scroll at 320px.
2. **≥ 640px:** both selects on one row with the switches — store 160px, category 180px. The switches may wrap to a second line near 768px; that is the pre-existing `sm:flex-wrap` behaviour and is fine.
3. Dropdown at 320px: never extends past the viewport edge, scrolls internally, and a long name like "Sezonsko / Posebni izdelki — vse" wraps rather than being clipped.
4. With that long name selected, the trigger truncates to one line with an ellipsis rather than overflowing.
5. At a short viewport (~400px tall), the dropdown fits and scrolls — the `min()` clamp working.

- [ ] **Step 3: Rollup confirmation**

Open `/search?q=meso&categories=3` and check a few products' `categoryIds` — temporarily `console.log(results.map((r) => r.product.categoryIds))` in `page.tsx` if the response is awkward to read.

Expected: at least one product whose `categoryIds` contains `20` or `21` **without** containing `3` — proof the backend expanded the parent rather than matching id 3 literally. Remove any temporary logging afterwards.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feature/search-category-filter
gh pr create --base main --title "Filter search results by category" --body "$(cat <<'EOF'
## Summary

Adds a single-select category filter to the `/search` filter bar, driven by a `categories` URL param. Selecting a parent category also returns its subcategories — the rollup happens server-side, so the client sends one id.

Design: `docs/superpowers/specs/2026-07-29-search-category-filter-design.md`
Plan: `docs/superpowers/plans/2026-07-29-search-category-filter.md`
Backend: #27 (API), #28 (map expansion)

## Notes for review

- The first commit is an **independent fix** for a pre-existing bug: `updateParam` preserved `page`, so changing any filter left the user on a stale page of a shorter result set. It affects the store, sort, order and switch filters too, and can be reverted on its own.
- Parents render as `<name> — vse` under a `SelectLabel` heading rather than relying on indentation, which conveyed the rollup to nobody and left screen readers with a flat 36-item list.
- The coverage hint shows whenever a category is active, not only on an empty result set — at 56.3% category coverage for Lidl a filtered search can look complete while hiding half the shelf.

## Verification

`pnpm lint` and `pnpm build`, plus browser checks: responsive at 320/375/640/768/1280, parent rollup confirmed against production data, stale and malformed params, page reset on filter change, and a categories-endpoint outage degrading to an all-categories dropdown with search still working.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| 1. Types (`Category`, `CategoryTreeNode`, `ALL_CATEGORIES_LABEL`, `SearchRequest.categoryIds`, `Product.categoryIds`) | 2 |
| 2. `getCategories` server action + degradation | 3 (contract), 5 step 5 item 8 (outage check) |
| 3. `buildCategoryTree` | 2 |
| 4. Param parsing, `undefined` not `[]`, `Promise.all` | 4, 5 |
| 4. Coverage hint, unconditional when active | 6 |
| 5. Page reset in `updateParam` | 1 |
| 5. Dropdown structure, label + `— vse`, declension | 5 |
| 5. Raw value / stale-id recovery | 5 |
| 5. Handler deletes rather than empties the param | 5 |
| 6. Responsive: stacked below `sm`, `min()` max-h, `max-w`, truncation | 5 (implementation), 7 (verification) |
| 7. Gotchas — coverage drop expected, no age gate, zero-product categories visible | Global Constraints, Task 4 step 3 |
| 8. Out of scope — `STORE_MAP`, `normalizeStoreName`, chips, `usePathname` | Global Constraints; not implemented anywhere |
| 9. Verification incl. rollup | 4, 5, 6, 7 |

No gaps. The spec's "no suite is being introduced" line is honoured — verification is browser-based throughout.

**Placeholder scan:** none. Every code step carries complete code; every check names the exact URL and the expected observation. Task 6 step 3 is explicitly optional, not vague.

**Type consistency:** `Category` and `CategoryTreeNode` are defined in Task 2 and consumed under those exact names in Tasks 3 and 5. `buildCategoryTree(categories: Category[]): CategoryTreeNode[]` matches its call site in Task 5 step 3. `ALL_CATEGORIES_LABEL` is defined in Task 2 and used for both the placeholder and the `"all"` item in Task 5 step 4. `getCategories(): Promise<Category[]>` matches its `Promise.all` use in Task 5 step 1. The `categoryIds` local from Task 4 is the same identifier read in Task 5 step 1 and Task 6 step 1. `ITEM_CLASS` is defined in Task 5 step 2 and used in step 4. `updateParam(key, value)` keeps the signature Task 1 leaves it with.
