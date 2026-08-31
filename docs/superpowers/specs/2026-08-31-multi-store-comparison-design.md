# Multi-store product comparison

Date: 2026-08-31
Branch: `feature/multi-store-comparison` (off `development`)

## Problem

The app compares prices, but only ever one listing at a time. Every card, every
detail page and every cart line is a *store's listing* of an article. When Lidl
sells Coca Cola 1,5 L for 1,79 € and Tuš for 2,29 €, nothing in the UI connects
the two — the shopper has to search the name and eyeball the results.

The backend now answers this directly. Two read-only endpoints under
`/api/v1/products` return the article itself and what every store charges for
it, grouped on a shared GTIN/EAN or an exact brand + name + quantity match.

Meanwhile the home page's third rail, **"Največje podražitve"**, shows the
articles that got most expensive. It is the weakest of the three rails: it has
no destination page, it tells a shopper nothing actionable, and it is the
natural slot for the comparison feature.

## Scope

1. Replace the "Največje podražitve" home rail with **"Isti izdelek, več cen"**.
2. New list page `/primerjava` over `GET /api/v1/products/multi-store`.
3. New detail page `/primerjava/[product_id]` over `GET /api/v1/products/{id}`,
   with a multi-series price chart and a per-store price table.
4. A manual cross-link from the existing product page into the comparison.

Out of scope:

- Any backend change. The endpoints exist and are correct as documented.
- Changing where `/search`, `/popular` or `/top-discounts` cards link. See
  "Non-goals" below — this is a hard constraint, not an omission.
- `GET /api/v1/stores` as a runtime source of truth for store ids. The app's
  existing hardcoded `STORE_MAP` stays.
- Deleting `getHighestPriceIncrease`. It becomes unreferenced; leave it.

## Non-goals

**A product being sold in several stores must not change where an existing card
links.** A card on `/search`, `/popular` or `/top-discounts` represents one
store's listing, and clicking it goes to `/product/{storeProductId}` exactly as
it does today, whether or not four other stores carry the same article. There is
no redirect anywhere, in either direction.

`/primerjava` is only ever reached by:

- the home rail's cards and its `Več izdelkov →` link,
- cards on `/primerjava` itself,
- the opt-in `Primerjaj ceno v drugih trgovinah →` link on
  `/product/[product_id]`, which the shopper clicks deliberately.

`ProductCard.tsx` and `ProductCardList.tsx` are not modified by this work at
all. That is the mechanism that guarantees the above.

## The two id spaces

This is the single most dangerous thing in this feature and the reason for a
separate route.

| Route | Path param is | Endpoint |
|---|---|---|
| `/product/[product_id]` | `storeProductId` | `GET /store/products/{id}` |
| `/primerjava/[product_id]` | `product.id` | `GET /api/v1/products/{id}` |

Both are bare positive integers, so a URL cannot be validated into the right
space and a mistake shows a plausible page about the wrong article. Rules:

- Never build a `/primerjava/...` href from `item.id`.
- Never build a `/product/...` href from `item.product.id`.
- `ProductComparisonListing.storeProductId` is the only bridge from the
  comparison page back to the single-listing world.

`product.id` is already present in every existing response as
`item.product.id` (`ProductModel.id` in the backend, described there as "a
single product row can back listings from several stores"). It was simply never
used for links. That is what makes the cross-link free of an extra request.

## Data layer

### `types/comparison.types.ts` (new)

A new file, deliberately not an addition to `types/product.types.ts`, which
already exports a `ProductDetail` that means *one store's listing plus its
history*. Two types with that name in one feature is how this goes wrong.

```ts
import type { BaseUnit } from "@/types/product.types";
import type { Product, Store } from "@/types/product.types";

/**
 * Ranking for GET /products/multi-store. Each option carries its own fixed
 * direction — the endpoint has no `direction` param — so the UI must never
 * offer an ascending/descending control beside it.
 */
export type MultiStoreSort = "SAVINGS_PCT" | "STORE_COUNT" | "MIN_PRICE" | "NAME";

export const VALID_MULTI_STORE_SORTS: MultiStoreSort[] = [
  "SAVINGS_PCT",
  "STORE_COUNT",
  "MIN_PRICE",
  "NAME",
];

export const DEFAULT_MULTI_STORE_SORT: MultiStoreSort = "SAVINGS_PCT";

/** One row of the multi-store list. Has NO pricePerUnit — see "Derived €/unit". */
export interface MultiStoreProduct {
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
  /** False means the headline saving is unbuyable today. Gates the badge. */
  cheapestIsAvailable: boolean;
  /** Can be lower than storeCount, including 0. */
  availableStoreCount: number;
}

export interface MultiStoreProductPage {
  products: MultiStoreProduct[];
  currentPage: number;
  numberOfPages: number;
  currentItems: number;
  allItems: number;
}

export interface ComparisonPricePoint {
  timestamp: string;
  price: number;
  cardDiscount: boolean;
  /**
   * Synthetic point stamped at the start of the `days` window, carrying the
   * last price observed before it. Render it so a stable price still draws a
   * line; never count it as a price change and never label it as one.
   */
  anchor: boolean;
}

/** One LISTING, not one store. A store that lists the article twice appears twice. */
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
  /** Scraped from the store, not computed. See "Derived €/unit". */
  pricePerUnit: number | null;
  baseUnit: BaseUnit | null;
  totalQuantity: number | null;
  isAvailable: boolean;
  cardDiscount: boolean;
  /** Already absolute. Never build a store URL by hand. */
  url: string;
  lastSeenAt: string | null;
  priceHistory: ComparisonPricePoint[];
}

/**
 * Detail response. Intentionally NOT sharing a base type with
 * MultiStoreProduct: it has no cheapestIsAvailable and no availableStoreCount,
 * because per-listing isAvailable is strictly more information.
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
  /** Cheapest first. `listings.length` can EXCEED storeCount. */
  listings: ProductComparisonListing[];
}
```

`Product` and `Store` are reused from `product.types.ts` — the wire shapes are
the same backend records (`ProductModel`, `StoreModel`).

Three caveats the existing types get wrong for this endpoint, which the new
code must tolerate rather than trust:

- `Product.brand` is typed non-nullable in `product.types.ts` but the API can
  send `null`. Existing call sites already guard with `product.brand?.name`;
  new code does the same.
- `Store.imageUrl` is likewise typed non-nullable but can be `null`. The new
  components read logos from `STORE_LOGOS` keyed on the normalised name, not
  from this field, so a null never reaches an `<Image src>`.
- `baseUnit` arrives as a bare string. `formatSize` already returns `null` for
  an unknown value, so a sixth unit added backend-side degrades to "no size"
  rather than a mislabelled one.

### `actions/comparison.actions.ts` (new)

Two server actions, following the conventions in `home.actions.ts` and
`product.actions.ts`.

```ts
export async function getMultiStoreProducts(params: {
  page?: number;
  size?: number;
  sort?: MultiStoreSort;
  query?: string;
  categoryIds?: number[];
}): Promise<MultiStoreProductPage>
```

- **Clamps every parameter before the fetch.** The endpoint has no
  `@ControllerAdvice`, so a violated `@Min`/`@Max` surfaces as a bare 500 with
  no parsed body: `page = max(0, page)`, `size` clamped to 1–100, `categoryIds`
  truncated to 64 entries, `sort` validated against `VALID_MULTI_STORE_SORTS`.
- Omits `query` when blank and `categoryIds` when empty — an empty
  `categoryIds` is not "all categories" on the wire and must never be sent.
- Reads the body as text before `JSON.parse`, reusing the `parseItems` idea from
  `home.actions.ts`: this endpoint is documented as always answering 200, but the
  other list endpoints in this app answer 204 with an empty body and `res.ok` is
  true for 204.
- Swallows every error and resolves to an empty page
  (`{ products: [], currentPage: 0, numberOfPages: 0, currentItems: 0, allItems: 0 }`),
  so the page can float the promise into a Suspense boundary without risking an
  unhandled rejection — the pattern `searchProducts` already relies on.

```ts
export async function getProductComparison(
  id: string,
  days?: number,          // default 365, clamped 1..365
): Promise<ProductComparison>
```

- **Throws** on `!res.ok`, matching `getProduct`, so the page turns it into
  `notFound()`. A 404 here means either no such product or every listing behind
  it has been delisted; both are "gone" as far as the UI is concerned.
- Does **not** forward the client IP. `getProduct` does that because fetching a
  store product records a view for the most-popular list; this endpoint has no
  such side effect, and forwarding the IP would imply one.

### Store ids

`storeIds` and `cheapestStoreId` are bare numbers; only the detail response
embeds a full `store` object. Resolve list-side ids through the existing
`STORE_MAP` in `types/search.types.ts` (1 spar, 2 lidl, 3 mercator, 4 hofer,
5 tus), which already matches the live table. An id absent from the map renders
no logo and is excluded from the count label rather than throwing.

Detail-side, use `normalizeStoreName(listing.store.name)` as everywhere else in
the app — the embedded name is authoritative and needs no id lookup.

> The API's own OpenAPI descriptions carry a stale store-id mapping
> ("2=MERKATOR, 3=LIDL"). It is wrong. `STORE_MAP` is right.

## Derived €/unit

The list response carries `baseUnit` and `totalQuantity` but **no
`pricePerUnit`**. The card shows a per-unit price anyway, computed as:

```
g, ml   →  minPrice / totalQuantity * 1000     // €/kg, €/L
piece   →  minPrice / totalQuantity            // €/kos
m       →  not derived — show size only
```

Two things this must not become:

1. **It can disagree with the detail page.** Backend `pricePerUnit` is *scraped*
   from each store's own feed (`price_per_unit`, `pricePerSubUnit`,
   `comparison`), not computed from price ÷ quantity. A store's published
   figure can be stale or rounded differently, so the derived list figure and
   the scraped detail figure may differ by a cent. This is accepted and must be
   documented in a comment at the derivation site so it is not later "fixed".
2. **`m` is deliberately excluded.** The ×1000 scaling was confirmed only in
   `BlStaplesSelectionService`, where every unit except `piece` is scaled — which
   would make `m` render €/km while `lib/format.ts` labels it `€/m`. Rather than
   ship a possibly-wrong number for a rare unit, `m` products show their size and
   no per-unit line.

Guard `totalQuantity != null && totalQuantity > 0` before dividing.
The detail rows use the scraped `listing.pricePerUnit` unchanged, via the
existing `formatPricePerUnit`.

## Routes and URL contract

```
/primerjava                    list
/primerjava/[product_id]       detail
```

Search params on `/primerjava`, named to match `/search` so `Pagination` and
`CategoryMultiSelect` drop in unmodified:

| Param | Values | Default |
|---|---|---|
| `q` | free text | absent |
| `categories` | comma-separated positive ints | absent |
| `sort` | a `MultiStoreSort` | `SAVINGS_PCT` |
| `page` | zero-based int | `0` |
| `view` | `grid` \| `list` \| absent | absent = CSS decides |

Validation mirrors `/search`: `categories` keeps only `Number.isInteger(n) && n > 0`
(which rejects `NaN`, `0`, `2.5` and `1e400`), `page` floors at 0, an unknown
`sort` falls back to the default rather than reaching a `<Select>` as-is.

`PAGE_SIZE = 50`, as on `/search`. At ~727 qualifying articles that is ~15
pages.

## Components

```
components/shared/
  StoreLogos.tsx                   NEW
  MultiStoreProductCard.tsx        NEW
  MultiStoreProductCardList.tsx    NEW
  MultiStoreResults.tsx            NEW
  MultiStoreFilters.tsx            NEW
  MultiStoreResultsSkeleton.tsx    NEW
  MultiStorePriceChart.tsx         NEW
  StoreListingRow.tsx              NEW
  ProductScrollSection.tsx         MODIFIED — accepts multi-store items
  ProductCard.tsx                  UNCHANGED
  ProductCardList.tsx              UNCHANGED
lib/store.ts                       MODIFIED — + a chart colour per store
lib/price-history.ts               MODIFIED — + a multi-series builder
lib/comparison.ts                  NEW — derivation + labelling helpers
```

New card components rather than a `variant` prop on the existing ones: the data
differs (`minPrice`/`savingsPct`/`storeCount`/`cheapestStoreId` instead of
`price`/`oldPrice`/`discountPct`), the action differs (no `+` button), and
`ProductCard` is on the critical path of three shipped pages. Keeping it
untouched is also what enforces the non-goal above.

### `StoreLogos.tsx`

The overlapping logo cluster, extracted so both new cards and the detail hero
agree on it. Props: `stores: StoreName[]`, a size, and a `max` after which it
renders a `+N` chip instead of more logos — a card 256 px wide cannot show five
logos beside a price. Only the new components use it; the existing cards keep
their inline versions, since editing them is out of scope.

### `MultiStoreProductCard` (grid)

Same 256×380 frame as `ProductCard`, so the two never disagree in a mixed
layout. Whole card is a `<Link>` to `/primerjava/{product.id}`.

```
┌──────────────────────────────┐
│ [prihrani 22%]   [logos +N] │   badge top-left, logos top-right
│                              │
│          product image       │
│                              │
│ COCA-COLA              1,5 L │   brand truncates, size pinned right
│ Coca Cola 1,5L PET           │   truncate + tooltip, as today
│                              │
│ od 1,79 €                    │
│ najceneje v Lidl · 1,19 €/L  │
│ na zalogi v 2 od 3           │   only when availableStoreCount < storeCount
└──────────────────────────────┘
```

- **No `+` button.** The price block uses the full card width.
- Savings badge reads `prihrani 22%` (rounded from `savingsPct`) in `bg-primary`.
- **The badge is hidden entirely when `cheapestIsAvailable` is false.** Not
  greyed, not dimmed — absent. An unbuyable headline saving is worse than no
  headline.

Stock is one line, resolved by the first matching rule, so the two signals can
never stack into a contradictory pair:

| # | Condition | Line | Badge |
|---|---|---|---|
| 1 | `availableStoreCount === 0` | `trenutno ni na zalogi` | hidden |
| 2 | `!cheapestIsAvailable` | `najcenejša ni na zalogi` | hidden |
| 3 | `availableStoreCount < storeCount` | `na zalogi v 2 od 3` | shown |
| 4 | otherwise | no line | shown |

Rule 2 outranks rule 3 deliberately: when the cheapest listing is out of stock,
*which* listing is missing matters more than how many are.
- Cheapest store name comes from `STORE_MAP[cheapestStoreId]`; when the id is
  unknown the line degrades to just the derived €/unit.
- No `cardDiscount` mark: the list response has no such field, and the cheapest
  listing's loyalty-card status is not knowable from it. The detail rows show it.

### `MultiStoreProductCardList` (row)

The same information in `ProductCardList`'s row frame — mobile stacked, `sm+`
with a right-hand column — minus the cart button. The logo cluster moves into
the right column at `sm+` and sits under the thumbnail on mobile, matching where
`ProductCardList` puts its single logo.

### `MultiStoreResults.tsx`

The results block, mirroring `ProductResults`/`/search`: renders the grid of
`MultiStoreProductCard` and the rows of `MultiStoreProductCardList`, hiding one
via CSS at `sm` when `view` is absent and via the param when it is set, then the
`Pagination`. Holds the single `cardProps`-style mapper from
`MultiStoreProduct` to card props, including the €/unit derivation, so the home
rail and this page cannot disagree about how a row is displayed.

### `MultiStoreFilters.tsx`

Exactly the controls the endpoint supports, so there are no dead ones:

```
[ Išči izdelke…                          🔍 ]
[Vse kategorije ▾]  [Največji prihranek ▾]      [⌗][≡]
```

- Its own search input writing `?q=` on this page — the header `SearchBar`
  hardcodes `/search` and explicitly clears itself off that route, so it cannot
  serve this page.
- `CategoryMultiSelect`, reused as-is, committing to `?categories=`.
- A sort `<Select>` with no direction control:

  | Label | Value |
  |---|---|
  | Največji prihranek | `SAVINGS_PCT` |
  | V največ trgovinah | `STORE_COUNT` |
  | Najcenejši | `MIN_PRICE` |
  | Po abecedi | `NAME` |

- The grid/list toggle, same `TOGGLE_BASE`/`TOGGLE_ON`/`TOGGLE_OFF` classes as
  `SearchFilters`.
- **No** store multi-select, availability toggle or card-discount toggle. The
  endpoint accepts none of them, and filtering the current 50 rows client-side
  would make the count and pagination lie.
- Any change to `q`, `categories` or `sort` deletes `page`; `view` does not.

### `/primerjava/page.tsx`

Structurally a copy of `/search/page.tsx`, which already solves this shape:

- Floats the `getMultiStoreProducts` promise (unawaited) into two Suspense
  boundaries, so the header and filters stream immediately.
- `resultsKey = JSON.stringify([q, sort, categoryIds, page])` on both
  boundaries, so a filter change — a same-route `router.replace`, which does not
  re-run `loading.tsx` — remounts them and the skeletons reappear. `view` is
  excluded: it re-renders from data already on the page and must not flash.
- Renders both layouts and lets CSS pick when `view` is absent, so there is no
  first-paint flash.
- Header: `h1` **Isti izdelek, več cen**, then a count line from `allItems`
  (`productCountLabel`), plus `v več trgovinah` so the number is not mistaken
  for the whole catalogue.

Empty states matter more here than on `/search`, because the corpus is ~727
articles and a category filter empties it often:

| Condition | Copy |
|---|---|
| `q` set, nothing found | `Ni rezultatov za „…" med izdelki v več trgovinah.` |
| category filter, nothing found | `V izbranih kategorijah ni izdelkov, ki bi jih prodajalo več trgovin.` |
| no filters, nothing found | `Trenutno ni izdelkov, ki bi jih prodajalo več trgovin.` |

Each with the `PackageSearch` icon treatment `/popular` uses, and — when a
filter is set — a link clearing it.

`loading.tsx` mirrors the real header's line boxes exactly, as `/search`'s does,
so handing over does not shift the layout.

## Detail page — `/primerjava/[product_id]`

`getProductComparison(product_id, 365)`, server-rendered, `notFound()` on throw.
`not-found.tsx` copies the existing product one with comparison-specific copy.

### Hero

```
┌───────────────┐   COCA-COLA
│               │   Coca Cola 1,5L PET
│    image      │   Pakiranje: 1,5 L
│               │
│  [logos]      │   od 1,79 €   najceneje v Lidl
└───────────────┘   3 trgovine · 1,79–2,29 € · prihranite do 0,50 €
                    Cena na enoto: od 1,19 €/L
```

- No add-to-cart, no open-in-store. Both live per-row below; a page-level
  "V košarico" would have to silently pick a store.
- The logo cluster replaces the single store logo the `/product` hero shows.
- The spread line is suppressed when `savings` is 0 (every store charges the
  same) — `prihranite do 0,00 €` is noise.
- Hero €/unit is derived from `minPrice` and prefixed `od`, consistent with the
  card; per-row figures below are the scraped ones.
- `storeCount === 1`: an info note **"Ta izdelek trenutno prodaja samo ena
  trgovina."** and the spread line omitted. Everything else renders normally —
  a year of price history is still worth the page. This state is reachable via
  the cross-link, so it must look deliberate, not broken.

### Chart — `MultiStorePriceChart.tsx`

A new component, not a mode on `PriceHistoryChart`: that one takes a single
`PriceHistoryEntry[]` and is shipped on `/product/[id]`. Its behaviour must not
change.

- **One `<Line type="stepAfter">` per listing**, keyed by `storeProductId`. The
  price was flat between two points, not sliding, so a smoothed line lies.
- **Colour by store**, so lines match the logos beside them. `lib/store.ts`
  gains a `color` per `StoreName`, drawn from the existing `--chart-*` tokens.
- A store's second listing gets **the same colour, dashed**, labelled
  `Lidl (2)`. About 7% of listings are within-store duplicates with different
  prices and URLs; collapsing them would hide a published price.
- **`storeProductId` is the React key.** Never `store.id`.
- Clickable legend toggling series visibility; with 3–5 step lines the chart
  gets busy. Legend entries carry the store's colour dot and its dash style.
- Fetched once at `days=365`. Period buttons `1 mes / 3 mes / 6 mes / 1 leto`
  filter **client-side**, instantly. **No "Vse"** — 365 days is the API ceiling
  and a button promising more than the data holds is a lie.
- Tooltip lists every visible store's price at that date, cheapest first, with
  the `CARD_DISCOUNT_CHART_NOTE` mark where `cardDiscount` is true.

`lib/price-history.ts` gains a multi-series builder beside `buildPriceSeries`,
which is left exactly as it is:

```ts
export function buildMultiStorePriceSeries(
  listings: { storeProductId: number; priceHistory: ComparisonPricePoint[] }[],
  months: number | null,
  now?: Date,
): { time: number; [seriesKey: string]: number | null }[]
```

- Reuses `buildPriceSeries`'s daily-collapse and carry-forward-to-`now` logic per
  listing, then merges onto one sorted, deduplicated time axis.
- A series is `null` at a timestamp where it has no reading; `connectNulls` on
  the `<Line>` keeps it unbroken, so a line does not gap where a *different*
  store changed price.
- The `anchor` point is rendered like any other, and never counted or labelled
  as a price change. A listing with no reading before the window has no anchor
  and simply starts later.
- `now` stays a parameter, as it is today, so output is a function of inputs.
- Empty `priceHistory` for a listing means no line for it — not a zero line.
  Every listing having an empty history falls back to the same "no data" panel
  `/product/[id]` shows.

### Store table — `StoreListingRow.tsx`

Heading **Cene po trgovinah**. One row per **listing**, in API order (cheapest
first), keyed by `storeProductId`.

```
┌─ NAJCENEJE ─────────────────────────────────────────┐
│ [lidl]  Lidl        2̶,̶2̶9̶ €  1,79 €  [-22%]  💳     │
│         Na zalogi   1,19 €/L    [+ V košarico] [↗] │
└─────────────────────────────────────────────────────┘
  [spar]  Spar                    2,09 €
          Na zalogi   1,39 €/L    [+ V košarico] [↗]
  [tus]   Tuš                     2,29 €
          Ni na zalogi 1,53 €/L   [+ V košarico] [↗]     ← muted, + disabled
```

- Cheapest row ringed with a `NAJCENEJE` badge. Applied to `listings[0]` only,
  even when a later row ties on price — one winner, no ambiguity.
- Out-of-stock rows are **muted but still shown**, with the cart button
  disabled and its `aria-label` explaining why. An out-of-stock price is still
  a published price.
- `oldPrice` struck through and a `-X%` chip, **only when `discountPct > 0`** —
  it is negative when the price rose, and search already applies this rule.
- `cardDiscount` renders the existing `CardDiscountMark`.
- `pricePerUnit` via `formatPricePerUnit` — the scraped value, unchanged.
- `V košarico` reuses `AddToCartButton` with the listing's own
  `storeProductId`, price, `cardDiscount` and store. `lib/cart.tsx` needs no
  change: it keys on `id`, so the same article from two stores is two lines,
  which is correct — those are two different purchases.
- `↗` is `listing.url` verbatim, `target="_blank" rel="noopener noreferrer"`.
  Never construct a store URL.
- The store's own `title` differs per store for the same article; show it as a
  small secondary line when it differs from `product.title`, so a shopper can
  tell the store is really selling the same thing.
- A `lastSeenAt` older than ~7 days shows a quiet `nazadnje videno …` note.

Then `ProductScrollSection` "Sorodni izdelki" is **not** rendered: the similar
endpoint keys on `storeProductId` and returns store listings, which would mix
the two id spaces on one page. Left for a follow-up.

## Home page

`app/(main)/page.tsx`:

- `getHighestPriceIncrease()` drops out of the `Promise.all`;
  `getMultiStoreProducts({ size: 20, sort: "SAVINGS_PCT" })` takes its place.
- The third `ProductScrollSection` becomes:

```tsx
<ProductScrollSection
  title="Isti izdelek, več cen"
  subtitle="Primerjajte cene med trgovinami"
  multiStoreItems={multiStore.products}
  moreHref="/primerjava"
/>
```

`ProductScrollSection` currently takes `items: DiscountItem[]` and always
renders `ProductCard`. It gains a second, mutually exclusive prop
`multiStoreItems: MultiStoreProduct[]` which renders `MultiStoreProductCard`
instead. The scroll mechanics, arrows, `Več izdelkov` link and the
hide-when-empty behaviour are shared and unchanged — and that hide-when-empty
guard is what makes a failed fetch degrade to no section rather than a stray
header.

`getHighestPriceIncrease` in `actions/home.actions.ts` becomes unreferenced. It
stays: the endpoint still exists and the rail may come back elsewhere.

## Cross-link on `/product/[product_id]`

One link under the existing button pair:

```
Primerjaj ceno v drugih trgovinah →   →  /primerjava/{data.product.id}
```

Always rendered when `data.product?.id` is present — no extra request, since the
id is already in the payload. It is a link the shopper chooses to follow, never
a redirect. A single-store article lands on the `storeCount === 1` state
described above, which is why that state had to look deliberate.

Rendered only when `product.id` exists, so a payload without it degrades to no
link rather than to `/primerjava/undefined`.

## Verification

No test files — this repo has none, and the standing preference is browser
verification against the dev server.

1. `pnpm build` and lint clean.
2. Home: the third rail is the comparison rail, cards have no `+`, cards link
   to `/primerjava/{id}`, `Več izdelkov` reaches `/primerjava`.
3. `/primerjava`: each of the four sorts changes the order; a category filter
   narrows and shows a skeleton while doing so; `?q=` narrows; both views
   render; pagination reaches the last page; the three empty states appear.
4. **Non-goal check:** a product on `/search` known to be in several stores
   still opens `/product/{storeProductId}`, not `/primerjava`.
5. A 3-store detail page: three coloured lines matching three logos, legend
   toggles, all four period buttons, rows in cheapest-first order with the
   cheapest badged.
6. A **within-store duplicate** product: two rows for one store, two lines in
   one colour with the second dashed, `listings.length > storeCount`, no React
   key warning in the console.
7. A product with `cheapestIsAvailable: false`: **no** savings badge on the
   card, and the corresponding row muted with a disabled cart button.
8. A product with `baseUnit: null`: no per-unit line and no size, on card,
   hero and rows.
9. A `storeCount: 1` product reached via the cross-link: the info note, one
   row, one line, no spread line.
10. Cart: add the same article from two stores → two lines, correct per-store
    prices; reload and confirm both persist.
11. `/product/[id]`, `/search`, `/popular`, `/top-discounts` and `/basket`
    unchanged, including the single-store chart's `Vse` button.

## Risks

| Risk | Mitigation |
|---|---|
| The two id spaces get crossed | Separate routes; `ProductCard` untouched; a rule stated at the top of this spec and repeated as a comment in `comparison.actions.ts` |
| Derived €/unit disagrees with the scraped one | Accepted, documented at the derivation site; `m` not derived at all |
| A bad param returns 500 with no body | Every param clamped client-side before the fetch |
| Corpus is small, so filters empty the page | Three specific empty states with a clear-filter link |
| Chart unreadable with 5+ lines | Store colours matching logos, dashes for duplicates, toggleable legend |
| Responses cached ~4h | No "live price" affordance anywhere; `lastSeenAt` note where a listing is stale |
