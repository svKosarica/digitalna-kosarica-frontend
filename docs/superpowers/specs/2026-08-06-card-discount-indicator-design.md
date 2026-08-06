# Card-discount indicator

Date: 2026-08-06
Branch: `development` (all work stays on this branch)

## Problem

Adding Tuš pushed the number of card-discounted listings well past what the UI
was built for — roughly 1500 at Tuš, plus Mercator, plus about 500 at Lidl. A
shopper scanning a result grid currently has no way to tell that a price is
conditional on holding the store's loyalty card. They only find out on the
detail page, and only there.

Today `cardDiscount` surfaces in exactly two places:

- the `cardDiscount` search filter, labelled "Zvestobni popusti"
- a pill on the detail page reading **"Zvestobni popus"** — a typo, missing the
  final *t*

## Scope

Show, in Slovenian, that a price requires a loyalty card, on:

1. `ProductCard` (grid)
2. `ProductCardList` (rows, mobile and `sm+`)
3. the product detail page
4. the price-history chart tooltip
5. the basket — item rows and the grand total

Out of scope: the CSV export format, the server-side `cardDiscount` filter, and
consolidating the three `cardProps` builders.

## Data

No API or type changes are needed. `cardDiscount: boolean` already exists on
`DiscountItem` (`types/product.types.ts:61`) and on every `PriceHistoryEntry`
(`types/product.types.ts:83`). The work is prop-threading plus one new
component. The only type change anywhere is an optional field on the
client-side `CartItem`.

## Copy

Three strings, all exported from `CardDiscountMark.tsx` so no Slovenian copy is
written inline anywhere. The string has already gone wrong once in this
codebase; centralising it is the point.

```ts
/** Tooltip text, badge text, and aria-label on the mark itself. */
export const CARD_DISCOUNT_LABEL = "Cena s kartico ugodnosti";

/** Chart tooltip line. Shorter: the tooltip already says "Cena" above it. */
export const CARD_DISCOUNT_CHART_NOTE = "S kartico ugodnosti";

/** Basket summary note under the grand total. */
export const CARD_DISCOUNT_TOTAL_NOTE =
  "Seštevek vključuje cene s kartico ugodnosti.";
```

`CARD_DISCOUNT_LABEL` is the wording the user chose; the other two are that
same phrase adapted to a context that already supplies the missing subject.

The existing search filter keeps its current label, "Zvestobni popusti". It
describes a filter action rather than a price condition, so it reads correctly
as-is and is left alone.

## Component: `components/shared/CardDiscountMark.tsx`

Two variants behind one component, so the copy and the accessibility wiring are
written once.

### `variant="icon"`

Used on the card, both list layouts, and the basket row.

- lucide `CreditCard`, `size-4` (`size-3.5` in the dense mobile row),
  `text-primary`
- wrapped in a Radix `Tooltip` whose trigger is a `<span tabIndex={0}>` with
  `role="img"` and the `aria-label`

A `<span>` trigger rather than a `<button>`: the mark renders inside the card's
`<Link>`, and a span never swallows the navigation, so no `preventDefault` is
needed anywhere.

### `variant="badge"`

Used on the detail page. The pill that already sits beside the "Na zalogi"
chip, now carrying the icon and the full label.

### Known limitation: touch

Radix tooltips open on hover and focus, not on tap. On a phone the icon sits
inside the card's `<Link>`, so tapping it navigates to the detail page, where
the labelled badge spells the condition out in full. Touch users therefore get
the icon as a signal and the detail page as the explanation. This is an
accepted trade-off, not an oversight: the alternative — a visible `s kartico`
text label at `sm+` — was considered and set aside to keep the fixed-height
card layout intact.

## Surfaces

### Card components

`ProductCard.tsx` and `ProductCardList.tsx` each gain `cardDiscount?: boolean`,
defaulting to `false`. When false, nothing renders — no greyed icon, no
"redna cena" counter-label.

Placement:

| Component | Position |
|---|---|
| `ProductCard` | in the existing `flex items-center gap-1` price row, after the up/down arrow |
| `ProductCardList` mobile | in the `flex flex-wrap items-baseline gap-1.5` price row, after the old price, with `self-center` to match the arrows |
| `ProductCardList` `sm+` | same position in the desktop price row |

Nothing new wraps onto its own line, so `ProductCard`'s fixed `h-[380px]` is
unaffected.

### Prop builders

| File | Change |
|---|---|
| `components/shared/ProductResults.tsx` | `cardProps()` → add `cardDiscount: item.cardDiscount` |
| `app/(main)/search/page.tsx` | `cardProps()` → add `cardDiscount: item.cardDiscount` |
| `components/shared/ProductScrollSection.tsx` | inline JSX → add `cardDiscount={item.cardDiscount}` |

These three builders are deliberately not merged. They differ on purpose —
search hides a negative `discountPct` while `ProductResults` flips the badge to
its "increase" variant — and those differences carry explanatory comments.

Threading these three covers every listing surface: `/search` in both views,
`/popular`, `/top-discounts`, the home page rails, and "Sorodni izdelki" on the
detail page.

### Detail page

`app/(main)/product/[product_id]/page.tsx` replaces its hand-rolled pill
(currently "Zvestobni popus") with `<CardDiscountMark variant="badge" />`, in
the same flex row as the "Na zalogi" chip. This removes the typo.

## Price-history chart

`components/shared/PriceHistoryChart.tsx`. Per-point `cardDiscount` already
arrives from the API but `buildSeries` drops it, mapping only
`{time, date, price}`.

1. **Carry the flag through** — add `cardDiscount: entry.cardDiscount` to the
   mapped point.
2. **Fix the carry-forward anchor.** The synthetic point at the window edge is
   built as `{ timestamp: cutoff, price: anchorPrice }`, copying only the price
   off the anchoring entry. It must copy that entry's `cardDiscount` too;
   otherwise a March card price carried into the 1-month window renders as a
   regular price. The single-point flat-line case already spreads
   (`{...mapped[0]}`) and needs no change.
3. **Tooltip.** The existing `formatter` returns `[price, "Cena"]` into a
   `flex flex-wrap gap-2` row. It becomes a fragment with a third child
   carrying `basis-full`, so the note drops onto its own line only when the
   flag is set:

   ```
   14. apr
   2,49 €   Cena
   S kartico ugodnosti
   ```

The line, the dots, and the axes are visually unchanged. No legend, no second
dot colour, no shaded bands — the flag is answered on hover, where the question
is asked.

## Basket

`CartItem` in `lib/cart.tsx` gains `cardDiscount?: boolean`. Optional, so carts
already persisted in `localStorage` deserialize unchanged and render nothing.
No migration and no storage version bump.

- **Writers** — `ProductCard` and `ProductCardList` add it to the object they
  hand `addItem`. The detail page adds it to the `item` prop it builds for
  `AddToCartButton`; it already destructures `cardDiscount` off the API
  response. `AddToCartButton` itself needs no change — it is typed
  `Omit<CartItem, "quantity">` and forwards the whole object.
- **`BasketItemCard.tsx`** — the icon renders next to the line total, in the
  `flex items-baseline gap-1.5 sm:flex-col` price block.
- **Summary** — in `app/(main)/basket/page.tsx`, when
  `items.some((i) => i.cardDiscount)`, a muted note renders under the "Skupaj"
  row:

  > Seštevek vključuje cene s kartico ugodnosti.

  Under the grand total rather than per-store: the point is that the total as a
  whole may not be reachable at the till without the cards.

The CSV export is unchanged. Adding a column would alter a file format users
may already be consuming.

## Edge cases

- **Filter interaction.** The server-side `cardDiscount` search filter means
  "only card-discounted products" and is untouched. With it on, every row shows
  the icon — correct and self-consistent rather than redundant.
- **`cardDiscount: false`** renders nothing at all.
- **Older persisted carts** lack the field; `undefined` is falsy, so they
  render nothing and the summary note stays hidden.
- **All user-facing text is Slovenian**, from the single exported constant.

## Verification

No test files in this repo. Verification is in Chrome against the dev server:

1. A Tuš or Mercator card-discounted product in `/search`, grid view — icon
   beside the price, tooltip on hover and on keyboard focus.
2. The same product in `/search` list view, at mobile width and at `sm+`.
3. Its detail page — badge reads "Cena s kartico ugodnosti", no truncation.
4. Its price-history chart — hover a card-priced point and confirm the extra
   tooltip line; hover a regular point and confirm its absence; switch to the
   1-month window and confirm the carried-forward anchor keeps its flag.
5. Add it to the basket — row icon plus the note under "Skupaj"; then a
   non-card product alone in the basket shows neither.
