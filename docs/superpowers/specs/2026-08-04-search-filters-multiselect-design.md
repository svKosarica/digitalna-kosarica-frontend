# Search filters: multi-select, Tuš, and the view-mode flash

Six changes to `/search` and its inputs, plus one new store:

1. The home page's "Primerjaj cene" button becomes a link into a discount-sorted
   browse view instead of focusing the search field.
2. The one-second list-then-grid flash after a search is removed.
3. Grid view stops reverting to list when you search a second term.
4. "Razvrsti" defaults to "Brez razvrščanja" instead of "Cena".
5. Store and category filters become multi-select.
6. Tuš (storeId 5) joins the store list.
7. The missing-image placeholder is wired to load *failures*, not just to an
   absent URL.

Frontend-only. No backend change is required or proposed.

## Verified against the backend

Probed `https://digitalna-kosarica.duckdns.org/api/v1` directly, not inferred
from the existing client code. Every number below is measured.

**An empty query is valid and returns everything.** `query: ""` with
`filter: DISCOUNT_PCT, sortOption: DESCENDING` returns `allItems: 5153`, top
discounts first. `query` may also be omitted entirely. This is what makes the
hero-button browse view possible.

**`sortOption: "NONE"` is not neutral — it behaves as descending.** With
`filter: PRICE, sortOption: NONE` the first prices are
`[56.90, 29.99, 29.95, 26.99, 26.95]`; with `sortOption: ASCENDING` they are
`[0.44, 0.49, 0.59, 0.65, 0.65]`. So a UI that shows "Cena" selected with
neither direction pill lit would be showing the most expensive products first
while implying no order at all. §4 guards against that.

**`filter: "NONE"` ignores `sortOption` entirely.** `NONE`/`NONE` and
`NONE`/`DESCENDING` return byte-identical result orders. The direction pills are
therefore inert while the sort field is "Brez razvrščanja".

**A parent category id absorbs its children.** `categoryIds: [2]` and
`categoryIds: [2, 21]` both return `allItems: 180`. Sending a parent plus one of
its children is redundant, never additive.

**Parent-only products are a large fraction of the catalogue.** This decides §6's
tri-state behaviour, so it is measured rather than assumed:

| categoryIds | allItems (query `""`) |
|---|---|
| `[4]` Pijače (parent) | 4915 |
| `[22,23]` both its children | 3924 |
| `[3]` Meso (parent) | 1633 |
| `[20,21]` both its children | 1529 |

991 drinks (20%) and 104 meat products (6%) are filed on the parent with no
subcategory. There is no wire format for "parent minus one child", so any
child-level selection is unable to reach them.

**`storeIds: []` is treated as "all", not as "none".** Returns the same 341 for
`mleko` as omitting the field. Harmless today, but the frontend should not rely
on it — see the §6 guard.

**`storeIds: [5]` returns Tuš.** 66 of the 341 `mleko` listings. Store 5
serialises as `name: "tus"` (no diacritic).

**`size: 200` is rejected with HTTP 400.** `size: 100` is accepted. Our
`PAGE_SIZE` is 50, so this is only a note for future changes — a page-size bump
past 100 will fail.

**Tuš images are on a host we have not configured.** Product image hosts across
802 sampled listings:

| host | store | count |
|---|---|---|
| `cdn1.interspar.at` | Spar | 281 |
| `mercatoronline.si` | Mercator | 238 |
| `hitrinakup.com` | **Tuš** | 164 |
| `imgproxy-retcat.assets.schwarz` | Lidl | 59 |
| `dm.emea.cms.aldi.cx` | Hofer | 34 |
| `www.lidl.si` | Lidl | 15 |
| *(empty string)* | — | 11 |

`hitrinakup.com` is absent from `next.config.ts`. `next/image` **throws** on an
unconfigured hostname in development, so adding storeId 5 without adding the
host would error out every results page containing a Tuš product. This is
load-bearing, not cosmetic.

**Images 404 in production, not just in theory.** 6 of 12 sampled Lidl
`imgproxy-retcat.assets.schwarz` URLs (all the `.../si/1/...` ones) return 404
while resolving DNS and TLS fine. Together with the 11 empty `imageUrl` values
(1.4%), that is why §7 needs an `onError` path and not merely a null check.

## Decisions

| decision | choice |
|---|---|
| Multi-select primitive | Popover + checkbox list; URL written on close, not per click |
| Draft/URL sync point | Popover **open** (not an effect watching the param) |
| Category parent semantics | Parent checkbox *is* the rollup; tri-state via indeterminate |
| Unchecking a child under a checked parent | Expands to remaining siblings |
| Empty selection | Impossible; unchecking the last item resets to "all" |
| `/search` with no `q` | Browses everything, headed "Vsi izdelki" |
| Default sort | `filter=NONE`, `order=NONE`; direction pills disabled |
| Default view with no `view` param | Both layouts rendered, CSS picks — as `ProductResults` already does |
| New search from the header | Carries every param except `page`, and only when already on `/search` |
| Placeholder look | Unchanged (`ImageIcon`, `text-border`); one shared component owns it |
| Store display names | From `STORE_LOGOS[...].label`, not `capitalize` |
| Verification | Chrome against the dev server; no test files |

## 1. Tuš — storeId 5

`lib/store.ts`

```ts
export type StoreName = "spar" | "mercator" | "hofer" | "lidl" | "tus";
```
plus `tus: { label: "Tuš", logoUrl: "/images/tus.png" }` in `STORE_LOGOS`.

`types/search.types.ts` — add `5: "tus"` to `STORE_MAP`, and tighten its type
from `Record<number, string>` to `Record<number, StoreName>` (importing the type
from `lib/store`) so `STORE_LOGOS[STORE_MAP[id]]` type-checks in §6. `lib/store`
imports nothing, so this introduces no cycle.

`lib/utils.ts` — add `tus: "tus"` and `"tuš": "tus"` to `STORE_ALIASES`. The API
sends `"tus"`; the accented alias is defensive, costs one line, and
`normalizeStoreName` lowercases before matching so it is reachable. No existing
alias contains `tus` as a substring, so the loop's first-match-wins order is
unaffected.

`next.config.ts` — add `{ protocol: "https", hostname: "hitrinakup.com" }`.

`ALL_STORE_IDS` is derived from `Object.keys(STORE_MAP)` in both
`search/page.tsx:72` and `SearchFilters.tsx:21`, so store 5 flows into the
default query and the filter list with no further change. Card and detail-page
logos come from `STORE_LOGOS` and likewise need no change.

Explicitly out of scope: consolidating the id → name → label → logo mapping,
currently split across `STORE_MAP`, `STORE_LOGOS` and `STORE_ALIASES`, into a
single registry. It is a real wart but not in the way of this work.

## 2. `ProductImage` — one owner for the placeholder

The `ImageIcon` fallback already exists at all four call sites
(`ProductCard.tsx:101`, `ProductCardList.tsx:96`, `BasketItemCard.tsx:40`,
`product/[product_id]/page.tsx:68`), but only the two card components pass
`onError`. The basket and detail page test `imageUrl` for truthiness alone, so a
URL that 404s renders a broken image there. New
`components/shared/ProductImage.tsx` owns the whole decision:

```tsx
"use client";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  /** Required: every call site has a different rendered width. */
  sizes: string;
  /** Classes for the <Image> itself — object-fit, padding, hover transform. */
  className?: string;
  /** Fallback icon size, e.g. "size-12". */
  iconClassName?: string;
  priority?: boolean;
}
```

Falsy `src` or a fired `onError` renders
`<ImageIcon className={cn("text-border", iconClassName)} />`; otherwise a `fill`
`<Image>`. It renders **only the inner content, not the positioned wrapper** —
the four wrappers differ (`aspect-square`, `w-20 h-20`, `w-16 h-16`,
`md:w-[420px] aspect-square`) and each keeps its own, so this stays a drop-in.

Per call site:

| call site | `sizes` | `iconClassName` | notes |
|---|---|---|---|
| `ProductCard` | `(max-width: 640px) 50vw, 240px` | `size-12` | keeps `group-hover:scale-110` |
| `ProductCardList` | `112px` | `size-10` | keeps `p-2`, `group-hover:scale-105` |
| `BasketItemCard` | `80px` | `size-6 sm:size-8` | gains the `onError` path |
| detail page | `(max-width: 768px) 240px, 420px` | `size-14 sm:size-20` | keeps `priority` |

The detail page is a server component; `ProductImage` is a client leaf inside
it, which is fine.

While here: both cards default `imageAlt = "Product image"` and no caller
overrides it, so every card image has that generic English alt text. They will
pass `alt={productName}` instead, keeping the `imageAlt` prop as an override.

## 3. The view-mode flash and the grid→list revert

Both bugs trace to the same mount effect, `SearchFilters.tsx:43-50`, which
rewrites the URL with `view=grid` on desktop whenever the param is missing.
Deleted outright.

**The flash.** The server renders `list` (`search/page.tsx:109` defaults
anything that is not `"grid"` to `"list"`), then the effect replaces the URL and
the grid re-renders — hence roughly a second of rows. Fix: make `view`
three-state and, when the param is absent, render *both* layouts and let CSS
choose, exactly as `ProductResults.tsx:54-68` already does on `/popular` and
`/top-discounts`:

```tsx
const viewParam = params.view === "grid" || params.view === "list" ? params.view : null;
```

- `viewParam === null` → grid gets `hidden sm:grid`, list gets `sm:hidden`
- `"grid"` / `"list"` → only that layout is rendered

`cn` is `twMerge`, so appending `hidden sm:grid` to the grid container's
`grid grid-cols-[…]` correctly resolves to `hidden sm:grid` while keeping the
`grid-cols`/`gap` utilities.

Cost when the param is absent: both DOM trees for 50 results. `ProductResults`
already accepts this on two other routes, and its comment notes hidden card
images are lazy so they cost DOM but no requests. Consistency with the existing
pattern is worth more than the saved nodes.

`ProductResults` is deliberately *not* reused here: its `cardProps` passes
`discountPct` straight through and flips the badge variant per item, whereas
search hides a negative `discountPct` (`search/page.tsx:38-39`). Only the CSS
technique is shared.

**The toggle's own highlight** must follow the same rule, with no JS, or it
reintroduces a flash of its own. With `viewParam === null` the grid button is
styled active from `sm` up and the list button below it, via `sm:` variants:

```ts
const TOGGLE_BASE = "p-2 rounded-lg border border-transparent transition-colors cursor-pointer";
const TOGGLE_ON   = "bg-card text-primary border-primary/30";
const TOGGLE_OFF  = "text-muted-foreground/40 hover:text-primary";
// viewParam === null:
//   grid: cn(TOGGLE_BASE, TOGGLE_OFF, "sm:bg-card sm:text-primary sm:border-primary/30")
//   list: cn(TOGGLE_BASE, TOGGLE_ON, "sm:bg-transparent sm:text-muted-foreground/40 sm:border-transparent sm:hover:text-primary")
```

With `viewParam` set to `"grid"` or `"list"` the buttons use `TOGGLE_ON` /
`TOGGLE_OFF` directly, with no `sm:` overrides — the URL is authoritative, so
both breakpoints agree.

`border-transparent` in the base is a small fix to an existing wart: today the
active state adds `border` and the inactive state has none, so the button shifts
by 1px when toggled.

**The grid→list revert.** `SearchBar.tsx:37` pushes `/search?q=…` with every
other param dropped, and because the component does not remount on a same-route
navigation the deleted effect never re-fired — so the user landed on the server's
`list` default. Per the decision above, a new search carries everything except
`page`, and only when already on `/search`:

```tsx
const params = pathname === "/search"
  ? new URLSearchParams(searchParams.toString())
  : new URLSearchParams();
params.set("q", query.trim());
params.delete("page");
router.push(`/search?${params.toString()}`);
```

The `pathname` guard matters: from `/popular` or `/top-discounts`,
`useSearchParams()` holds *that* page's params, and an unguarded copy would leak
`?onlyDiscounted=true` or `?window=WEEKLY` into the search URL.

## 4. "Razvrsti" defaults to "Brez razvrščanja"

`search/page.tsx:66,70` and `SearchFilters.tsx:35-36` change their fallbacks from
`PRICE`/`DESCENDING` to `NONE`/`NONE`.

Because `sortOption: "NONE"` silently means descending (see *Verified*), two
guards keep the control from lying:

- **While `filter === "NONE"`, the Naraš./Pad. pills are `disabled`**, styled
  `disabled:opacity-40 disabled:pointer-events-none` to match the carousel
  arrows at `ProductScrollSection.tsx:90`. The API ignores `sortOption` in this
  state; a live-looking button that does nothing is worse than a visibly inert
  one.
- **Choosing a sort field while `order === "NONE"` sets a direction in the same
  URL update**, so "Cena" cannot land on most-expensive-first:

  ```ts
  const DEFAULT_ORDER: Record<Exclude<FilterOption, "NONE">, SortOption> = {
    PRICE: "ASCENDING",           // cheapest first
    PRICE_PER_UNIT: "ASCENDING",  // best value first
    DISCOUNT_PCT: "DESCENDING",   // biggest discount first
  };
  ```

  Choosing "Brez razvrščanja" deletes `order` entirely, so the pills return to
  unlit *and* disabled rather than keeping a stale highlight.

This needs a multi-key URL update, so `updateParam(key, value)` grows into
`updateParams(entries: Record<string, string | null>)`, with the single-key form
kept as a thin wrapper. The existing page-reset rule is preserved: any change
other than `page` or `view` deletes `page`.

## 5. Hero CTA → browse mode

`components/shared/HeroFocusButton.tsx` is deleted. `app/(main)/page.tsx` inlines
a plain link, which removes a client component from the home page entirely:

```tsx
<Link href="/search?filter=DISCOUNT_PCT&order=DESCENDING" className={/* unchanged classes */}>
  Primerjaj cene <ArrowRight className="size-5" />
</Link>
```

`search/page.tsx` drops the no-`q` early return (lines 52-59). With `q` absent it
passes `query: ""` and heads the page `Vsi izdelki`; with `q` present the header
is unchanged. The existing count line and the uncategorised-products note are
unchanged.

`/top-discounts` keeps its own title. The two destinations differ for real —
`/top-discounts` is a capped 50-item list with no filter bar, this paginates all
5153 listings with the full bar — so the header stays "Vsi izdelki" rather than
duplicating "Najvišji popusti".

Three things become dead code and are removed with it, since
`HeroFocusButton:10` was the only `focus-search` dispatcher (grepped across
`app`, `components`, `lib`, `stories`, `.storybook`):

- `SearchBar.tsx:21-33` — the `focus-search` listener
- `SearchBar.tsx:56` — the `onAnimationEnd` handler
- `app/globals.css:148-157` — the `search-pop` keyframes and
  `animate-search-pop` utility

`SearchBar`'s `inputRef` is then unused and goes too. The
`pathname !== "/search"` effect that clears the query stays.

## 6. Multi-select stores and categories

Three new files, which also keeps `SearchFilters` (291 lines today) from
ballooning:

- `components/shared/FilterPopover.tsx` — presentational shell only
- `components/shared/StoreMultiSelect.tsx` — flat list
- `components/shared/CategoryMultiSelect.tsx` — two-level tri-state tree

### URL contract (unchanged)

`?stores=1,5` and `?categories=21,4`. Both already parse as comma lists on the
wire; `search/page.tsx:77-85` anticipated this. Committed ids are **sorted
ascending**, so the URL is canonical regardless of click order and the
"did anything change?" check is a string compare.

### `FilterPopover`

Owns the trigger button (label + chevron, styled like today's `SelectTrigger`),
the popover chrome, and the open/close plumbing. It holds no selection state of
its own:

```tsx
interface FilterPopoverProps {
  /** Rendered in the trigger, e.g. "Vse trgovine" / "Spar" / "2 trgovini". */
  label: string;
  /** Trigger width, matching today's Select triggers: "sm:w-[160px]" / "sm:w-[180px]". */
  triggerClassName?: string;
  /** Popover width, e.g. "w-56" / "w-72". */
  contentClassName?: string;
  /** Pinned above the scroll area — the "Vse …" reset row. */
  header: React.ReactNode;
  /** The scrolling checkbox list. */
  children: React.ReactNode;
  onOpenChange: (open: boolean) => void;
}
```

`PopoverContent` ships with
`w-72 p-4`, so it is overridden with an explicit width, `p-0`, and an inner
scroll container, clamped the way the current category `SelectContent`
is (`SearchFilters.tsx:144`) but with the popover variable:

```
max-h-[min(320px,var(--radix-popover-content-available-height))] max-w-[calc(100vw-2rem)]
```

The "Vse trgovine" / "Vse kategorije" reset row sits above the scroll container
so it stays reachable in a 36-entry list.

### Commit-on-close, and where the draft comes from

Each multi-select holds a `draft` of ids and is otherwise dumb: `SearchFilters`
parses the param, passes `selected`, and receives `onCommit(ids)`.

`onOpenChange(open)`:
- **open** → `setDraft(...)` from `selected`. Opening is the sync point, so no
  effect watching a prop is needed and an externally-changed param (a new search
  carrying different filters) cannot leave a stale draft behind.
- **close** → if the sorted draft differs from the sorted `selected`, call
  `onCommit`. One server round trip per session of edits instead of one per
  checkbox.

`SearchFilters` maps the committed array back to the URL, collapsing
"everything selected" to an absent param.

### Trigger labels

All → "Vse trgovine" / "Vse kategorije". Exactly one → that item's own label,
from `STORE_LOGOS[...].label` for stores (so Tuš keeps its š, which
`capitalize` on `STORE_MAP`'s `"tus"` would not) and `Category.name` for
categories. Otherwise a count, which needs Slovenian's dual:

- *trgovina*: 1 trgovina, 2 trgovini, 3–4 trgovine, 5+ trgovin
- *kategorija*: 1 kategorija, 2 kategoriji, 3–4 kategorije, 5+ kategorij

New helpers in `lib/utils.ts` built on `Intl.PluralRules("sl")`, matching how
`lib/format.ts:16-23,41` handles `kos`/`kosa`/`kosi`/`kosov` — the file's comment
explains that hand-rolling the rule off the last two digits is how it goes
wrong. `productCountLabel` in `lib/utils.ts:22` is the older hand-rolled kind;
it is left alone rather than rewritten as drive-by scope.

Note the existing header line uses the *locative* ("v 3 trgovinah",
`search/page.tsx:120`) while a trigger label needs the *nominative*. Different
helpers, not a shared one.

### `StoreMultiSelect`

- On open, `setDraft(selected.length ? selected : ALL_STORE_IDS)` — expanding
  "all" to the explicit list is what lets the first uncheck mean
  "all except this one".
- "Vse trgovine" row: checked when the draft holds every id; clicking it selects
  all (a no-op when already all).
- **An empty selection is unreachable.** Unchecking the last remaining store
  resets the draft to all rather than leaving zero. Zero stores would either
  show nothing or, given `storeIds: []` behaves as "all", show everything —
  neither is what unchecking the last box looks like it should do.
- Commit maps a full-length selection back to `null` (param deleted).

### `CategoryMultiSelect`

Draft holds ids exactly as they go on the wire — a parent id when that parent is
rolled up, child ids otherwise.

Parent row state:

| condition | state |
|---|---|
| draft contains the parent id | checked |
| draft contains any of its children | indeterminate |
| neither | unchecked |

A child renders checked when the draft holds either its own id or its parent's.

Interactions:
- **Parent, checked or indeterminate → clear.** Removes the parent id and all of
  its child ids.
- **Parent, unchecked → roll up.** Adds the parent id and drops its child ids,
  which the parent absorbs (verified: `[2,21]` ≡ `[2]`).
- **Child, parent rolled up → expand to siblings.** Removes the parent id and
  adds every child except the clicked one.
- **Child, otherwise → plain toggle** of its own id.
- A childless top-level category is a plain checkbox on its own id; the parent
  logic above already degenerates to that with an empty child list, so there is
  one code path, and the current `children.length === 0` branch
  (`SearchFilters.tsx:150`) disappears.
- "Vse kategorije": checked when the draft is empty; clicking empties it.

**Known tradeoff, accepted.** Expanding a rollup drops products filed on the
parent only — 991 of 4915 for Pijače, 104 of 1633 for Meso (measured above).
This is unavoidable at child-level granularity and applies however the user
arrives there; expanding on child-uncheck merely reaches that state in one click
instead of two. The result count visibly changes, which is the only signal the
UI can honestly give.

**Stale ids from a bookmark.** On open the draft is initialised from
`selected ∩ known ids`, so an id that no longer exists is simply not checked and
drops out on the first commit. This replaces the `""`-placeholder trick at
`SearchFilters.tsx:62-75`, whose comment already flagged itself as a v1 tradeoff
to revisit "when multi-select lands", along with the single-known-id assumption
that made `?categories=2,6` fall back to the placeholder.

Category ids are deliberately **not** validated against the fetched list in
`search/page.tsx`: `getCategories()` returns `[]` on an outage, and validating
against an empty list would silently wipe a legitimate filter. The positive-
integer check there stays as the only server-side guard.

### `components/ui/checkbox.tsx` needs a tri-state indicator

Radix renders `CheckboxPrimitive.Indicator` for `indeterminate` as well as
`checked`, and line 26 renders `CheckIcon` unconditionally — so an indeterminate
parent would be indistinguishable from a fully-checked one. The primitive gains:

- `group/checkbox` on the Root, plus
  `data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground`
  so the indeterminate box is filled like a checked one
- inside the Indicator, `CheckIcon` and a `MinusIcon`, swapped with
  `group-data-[state=indeterminate]/checkbox:` variants

Purely additive: `checked`/`unchecked` rendering is untouched, so the checkbox's
other consumers are unaffected.

### Two latent bugs fixed in passing

- `search/page.tsx:73-75` — `?stores=` (empty value) is a string, so it parses
  to `[]` and forwards `storeIds: []`. It happens to behave as "all" today, but
  that is the backend's choice and not something to depend on. The parsed list
  now falls back to `ALL_STORE_IDS` when empty and drops ids absent from
  `STORE_MAP`, so `?stores=99` cannot reach the API.
- `.filter(Boolean)` on the same line also silently swallows `NaN` from
  `?stores=abc`; the membership check subsumes it.

## 7. Verification

Chrome against `pnpm dev`, per this repo's convention — there are no test files
and none are added. Each item is a distinct failure mode, not a re-run of the
same path:

1. **Hero CTA** — home → "Primerjaj cene" lands on
   `/search?filter=DISCOUNT_PCT&order=DESCENDING`, headed "Vsi izdelki", top
   discounts first, filter bar present.
2. **No list flash** — hard-reload a desktop search with no `view` param and
   confirm the grid is the first paint, with no rows and no URL rewrite.
3. **Grid survives a second search** — pick grid, search another term, confirm
   still grid and that `view=grid` is in the URL.
4. **Mobile default** — at <640px the same URL renders rows, and the list button
   reads as active.
5. **Sort default** — a first search shows "Brez razvrščanja" with both
   direction pills inert; choosing "Cena" lights Naraš. and returns cheapest
   first (not 56,90 €).
6. **Store multi-select** — tick Spar + Tuš, close once, confirm a single
   navigation to `?stores=1,5`, results from those two stores only, trigger
   reads "2 trgovini"; uncheck down to the last store and confirm it resets to
   "Vse trgovine".
7. **Category tri-state** — tick Pijače (parent) → `?categories=4`, children
   shown checked; untick Alkoholne pijače → `?categories=23`, parent
   indeterminate, count drops.
8. **Stale bookmark** — load `?categories=999`, confirm the trigger reads "Vse
   kategorije" and the id is gone after the next commit.
9. **Tuš end to end** — a Tuš product renders its `hitrinakup.com` image and the
   Tuš logo, in a card, a row, the detail page and the basket; the store filter
   lists "Tuš" with the diacritic.
10. **Placeholder** — a known-404 Lidl `.../si/1/...` listing shows the icon in
    card, row, detail page and basket, with no broken-image glyph and no
    console error beyond the failed request.
