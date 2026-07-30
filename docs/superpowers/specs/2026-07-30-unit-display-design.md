# Unit display and price-per-unit

Backend PR #41 replaced the free-text `Product.unit` label with a structured
size on the listing, and redefined `pricePerUnit` to a base we compute
ourselves. The API stopped sending `unit` when #41 shipped, so every card's unit
slot renders nothing today. This picks the new fields up across every screen.

Frontend-only. No backend change is required or proposed.

## Verified against the backend

Checked against `../digitalna-kosarica` at `c480a25`, not against the handoff
document alone.

Confirmed as described:

- `ProductModel` has no `unit` field — `Product.unit` in our types is dead.
- `baseUnit: String` and `totalQuantity: BigDecimal` exist on both
  `StoreProductModel` and `StoreProductDetailModel`.
- The base-unit vocabulary is exactly `g` / `ml` / `piece` / `m`
  (`UnitSpec` constants; `UnitParser.baseUnitOf` returns those four or null).
- `pricePerUnit` maps from the `price_per_base` column
  (`IBlStoreProductMapper:26`), per kg / per L / per piece / per m.
- The `PRICE_PER_UNIT` sort is grouped:
  `ORDER BY sp.base_unit NULLS LAST, sp.price_per_base <dir> NULLS LAST`
  (`IStoreProductRepositoryImpl:171`). It is live in our UI at
  `SearchFilters.tsx:227` ("Cena na enoto").

Where the handoff is wrong or incomplete:

- **`pricePerUnit` is nullable.** The handoff's diff leaves
  `pricePerUnit: number` untouched, but the DTO Javadoc says "Null when the
  listing's unit could not be parsed" and their own `formatPricePerUnit` accepts
  `number | null`. Our type must change. (Their `@Schema` is also missing
  `nullable = true` on that field — a doc bug on their side, no runtime effect.)
- **Coverage is better than the stated 99.6%.** PR #43 landed after #41 and
  added the `kos` declensions, `listov`, `par`, Lidl's `250/g` slash form and
  `.75/l` leading dot, addressing most of 331 unparsed production listings.
  Nulls remain by design (`cenazakosobnakupuNkosov` stays null deliberately), so
  the design is unchanged.
- **Sub-metre sizes exist.** `UnitParser.fold` divides `cm` by 100 and `mm` by
  1000 at three decimals, so a 15 cm listing arrives as `0.15` and 5 mm as
  `0.005`. The handoff's formatter renders those `0,15 m` and `0,01 m`.
- **`totalQuantity` arrives in exponent notation.** The backend calls
  `stripTrailingZeros()`, so 1980 serialises as `1.98E+3`. `JSON.parse` resolves
  it to `1980`, so no action is needed — but it must never be treated as a
  string.

## Decisions

| decision | choice |
|---|---|
| Where €/unit appears | Detail page, every product card and every search row — not the basket |
| Grouped `PRICE_PER_UNIT` sort | Per-row unit labels, no group headers |
| Basket | `CartItem` gains an optional pre-formatted size |
| Sub-metre lengths | Demote to `cm` / `mm` |
| Number formatting | New strings use `sl-SI`; existing prices are left alone |
| Verification | Chrome against the dev server; no test files |

## 1. Types — `types/product.types.ts`

```ts
export type BaseUnit = "g" | "ml" | "piece" | "m";
```

- Delete `Product.unit` (line 11).
- `DiscountItem` gains `baseUnit: BaseUnit | null` and
  `totalQuantity: number | null`. Both are null together when the store's label
  could not be parsed.
- `pricePerUnit: number` becomes `pricePerUnit: number | null`.

`ProductDetail extends DiscountItem`, so the detail page inherits all three.
Size is listing data, never product data — the same product in two stores can
legitimately carry different sizes, so nothing may cache a size against a
product id.

## 2. Formatters — new `lib/format.ts`

Two exported functions, both returning `string | null`, with `null` meaning
"render nothing".

```ts
formatSize(totalQuantity: number | null, baseUnit: BaseUnit | null): string | null
formatPricePerUnit(pricePerUnit: number | null, baseUnit: BaseUnit | null): string | null
```

Behaviour, one rule applied everywhere:

| input | output |
|---|---|
| `500`, `g` | `500 g` |
| `1500`, `g` | `1,5 kg` |
| `330`, `ml` | `330 ml` |
| `1980`, `ml` | `1,98 L` |
| `150`, `m` | `150 m` |
| `1.5`, `m` | `1,5 m` |
| `0.15`, `m` | `15 cm` |
| `0.005`, `m` | `5 mm` |
| `1`, `piece` | `1 kos` |
| `2`, `piece` | `2 kosa` |
| `3`, `piece` | `3 kosi` |
| `5`, `piece` | `5 kosov` |
| `1.5`, `piece` | `2 kosa` |
| `0.2`, `piece` | `null` |
| `null`, `null` | `null` |

Four deviations from the handoff's reference implementation, each deliberate:

**Sub-metre demotion.** Below 1 m the value promotes downward, mirroring the
upward promotion at ≥ 1000: `≥ 0.01` renders as centimetres at one fraction
digit (a `cm` label divided by 100 at three decimals can carry one, e.g.
15,5 cm → `0.155`), below that as millimetres at zero (an `mm` label divided by
1000 at three decimals is always a whole number of millimetres). This restores
what the shelf label said instead of showing `0,01 m`. The handoff's table pins
only 150 m and 1,5 m, so nothing in it is contradicted.

**Unknown `baseUnit` returns null.** The handoff's implementation ends in an
unguarded `return \`${nf(2).format(q)} m\``, so any value that is not `g`, `ml`
or `piece` renders as metres. `baseUnit` arrives as a bare `String` from the
DTO, so a fifth unit added backend-side would silently mislabel every listing.
Both functions match `m` explicitly and return `null` for anything else.

**`Intl` objects are constructed once at module scope.** The reference
implementation builds a fresh `NumberFormat` and `PluralRules` per call; these
run once per card in an auto-fill grid.

**Price-per-unit uses exactly two fraction digits.** The handoff sets only
`maximumFractionDigits`, so `3.5` renders `3,5 €/L`. A price reads as
`3,50 €/L`. Sizes keep maximum-only, so `1500 g` stays `1,5 kg` rather than
`1,50 kg`.

### Two further deviations, both found by browser verification

Added after implementation, against live production data. Recorded here so the
spec matches shipped behaviour.

**Sub-cent price-per-unit widens to four digits.** Two decimals collapsed real
prices to `0,00 €/kos` on 7 of 50 rows of a paper search: the backend counts
sheets, so a 20-roll pack is 3000 pieces and €/piece is 0.0013. That reads as
free, and inside the price-per-unit sort it left a run of identical-looking rows
in an order the reader could not check. When two decimals would round a non-zero
price to zero, four are used instead — exactly the wire precision
(`NUMERIC(10,4)`), so no digit is invented. An exact zero still renders `0,00`.

**Piece counts round before the plural is selected.** CLDR Slovenian sends any
value with visible fraction digits to `few`, so selecting the form on the raw
quantity while printing a rounded number disagrees: a 0.2 printed as `0`
rendered `0 kosi`, and a 1.5 printed as `2` would have read `2 kosi` instead of
`2 kosa`. The count is rounded first and the form selected on the result.

A count that rounds to zero renders no size at all. Production carries sub-unit
piece counts — a 200 ml sun lotion parsed as 0.2 pieces — and `0 kosov` is
exactly the "`0` as if data were missing" this contract rejects.

Slovenian pluralisation comes from `Intl.PluralRules("sl")`, which implements
the dual, not from a hand-rolled rule:

```ts
const PIECE_FORMS = { one: "kos", two: "kosa", few: "kosi", other: "kosov",
                      zero: "kosov", many: "kosov" } as const;
```

`lib/utils.ts:22` already hand-rolls the same shape of rule for
`izdelek/izdelka/izdelki/izdelkov`. It is correct — verified for 1, 2, 3, 11,
100 and 101 — and is left untouched. Converting it is a separate change.

## 3. Slovenian strings

Every user-facing string this change introduces:

| source | Slovenian output |
|---|---|
| `g` below / at-or-above 1000 | `500 g` / `1,5 kg` |
| `ml` below / at-or-above 1000 | `330 ml` / `1,98 L` |
| `m` at-or-above 1 / 0,01–1 / below 0,01 | `1,5 m` / `15 cm` / `5 mm` |
| `piece` 1 / 2 / 3–4 / 5+ | `1 kos` / `2 kosa` / `3 kosi` / `5 kosov` |
| unparsed listing | *(nothing rendered)* |
| per-unit label, `g` / `ml` / `piece` / `m` | `€/kg` / `€/L` / `€/kos` / `€/m` |
| detail-page size label | `Pakiranje` |
| detail-page per-unit label | `Cena na enoto` |
| screen-reader label, `g` / `ml` / `piece` / `m` | `cena na kilogram` / `cena na liter` / `cena na kos` / `cena na meter` |

`Cena na enoto` is the exact phrase already at `SearchFilters.tsx:227`, so the
sort option and the detail-page label read identically.

The `€/unit` line carries an `aria-label` from the fourth row above, because
`1,16 €/L` does not read aloud usefully.

Litre stays uppercase `L` in both `1,98 L` and `€/L`. Slovenian accepts either
case; uppercase avoids `l`/`1` confusion at the 10px size the cards use.

`sl-SI` also gives a period as the group separator, so a large piece count
renders `1.500 kosov`. That is correct Slovenian and is left as the locale
produces it.

### Number formatting is knowingly inconsistent with existing prices

All 14 existing price sites format with `toFixed(2)`, producing a decimal
**point** — the app shows `2.29 €` today. `ProductScrollSection.tsx:119-120`
is looser still, passing `item.price?.toString()`, so home-page cards show
`2.3` or `3`.

The new strings use the correct Slovenian comma, which means a card will read
`2.29 €` above `1,16 €/L`. This was raised and the tight scope was chosen
deliberately: normalising prices would touch every screen's price rendering and
belongs in its own change. Recorded here so the mismatch is not later mistaken
for a bug in this work.

## 4. Cards — `ProductCard`, `ProductCardList`

The prop `unit?: string` becomes `size?: string`, and `pricePerUnit?: string`
is added. Both are pre-formatted strings, matching how `price` and `oldPrice`
are already passed — the cards stay presentational and no formatter is imported
into a client component.

- `size` goes in the existing top-right slot beside the brand. The brand
  truncates and the size stays pinned, exactly as the current comment at
  `ProductCard.tsx:138` describes. No layout change.
- `pricePerUnit` is a small muted line directly under the main price.
  `ProductCard` is a fixed `h-[380px]` column with a `grow` middle block, so the
  middle absorbs the extra line. `ProductCardList` needs it in two places: the
  mobile stacked block and the `sm:` right-hand column.

Both render nothing when the prop is absent, so an unparsed listing shows title
and price with no gap, no dash and no `0`.

## 5. Call sites

Five, covering every screen that shows a product:

| file | screens reached |
|---|---|
| `app/(main)/search/page.tsx` grid branch | /search grid |
| `app/(main)/search/page.tsx` list branch | /search list |
| `components/shared/ProductResults.tsx` `cardProps` | /popular, /top-discounts |
| `components/shared/ProductScrollSection.tsx` | home ×3, "Sorodni izdelki" on the detail page |
| `app/(main)/product/[product_id]/page.tsx` | product detail |

Each reads `item.baseUnit`, `item.totalQuantity` and `item.pricePerUnit` off the
listing, never off `item.product`.

## 6. Detail page

`app/(main)/product/[product_id]/page.tsx` currently shows neither size nor
price-per-unit. It destructures the three new fields from `data` and renders:

- the size beside the brand line, labelled `Pakiranje`
- the price-per-unit under the existing price row, labelled `Cena na enoto`

Labels appear here and not on the cards because the detail page has the room and
the phrase already exists in the sort control. When both format to `null` the
labels are omitted too, not rendered against an empty value.

## 7. Basket

`CartItem` in `lib/cart.tsx` gains `size?: string` — the already-formatted
string, so the basket needs no formatter and no `baseUnit`.

- Written at all three `addItem` sites: `ProductCard.handleAddToCart`,
  `ProductCardList.handleAddToCart`, and `AddToCartButton` on the detail page.
- Rendered in `BasketItemCard` under the product name.
- Carts already persisted under `dk-cart` have no `size` and render nothing —
  the same treatment as an unparsed listing. No migration code; entries heal as
  users re-add items.

`BasketItemCard.tsx:83` already renders `{item.price.toFixed(2)} € / kos`,
where `/ kos` means *per item in the cart*, not the API's price-per-piece. With
a size now on the same row, that label reads as if it were the API's `€/kos`.
It is renamed to `€ / izdelek`, which is what it has always meant. This is a
one-string change and can be dropped without affecting anything else.

Price-per-unit is not shown in the basket. Only the size is.

## 8. Grouped `PRICE_PER_UNIT` sort

No group headers. The unit label on every row satisfies the handoff's
requirement that a reader can see where one group ends, and it needs no new
list-chrome component.

Nothing in the UI may compare `pricePerUnit` across different `baseUnit` values
— not in a badge, a sort, or a saving calculation. Nothing does today; this
change adds no such comparison.

Rows with an unparsed size sort last (`NULLS LAST`) and correctly show neither a
size nor a `€/unit` line.

## 9. Verification

Chrome against the dev server. No test files — consistent with the rest of the
repo, which has none, and with `vitest.config.ts` being wired only to the
Storybook browser project.

Screens to check:

- home — all three scroll sections
- /search — grid and list, and again with `filter=PRICE_PER_UNIT` to confirm
  group boundaries are legible from the per-row labels alone
- /popular and /top-discounts
- /product/[id] — `Pakiranje` and `Cena na enoto` both present
- /basket — size on a newly added item, nothing on a pre-existing one

The four `kos` forms are confirmed by evaluating `formatSize` in the browser
console for 1, 2, 3 and 5 pieces. Live data will not reliably contain a listing
of each count, and the plural forms are the part most likely to be wrong.

Also confirm a listing with an unparsed size renders cleanly, and grep for
leftover `product.unit` references after the type field is removed.

## 10. Report back to the backend team

Not blocking, and no backend change is requested:

- Their diff leaves `pricePerUnit` non-nullable while their own formatter and
  DTO Javadoc treat it as nullable.
- `@Schema` on `pricePerUnit` is missing `nullable = true` in both
  `StoreProductModel` and `StoreProductDetailModel`.
- We demote sub-metre lengths to `cm`/`mm` rather than rendering `0,01 m`. Their
  display table does not cover values below 1 m.

Two data-quality findings from verifying against production, which are theirs to
decide on rather than ours to work around:

- **Sub-unit piece counts exist.** `store_product` 42219-adjacent row "mleko za
  sončenje zf50, sun kiss, 200ml" carries `totalQuantity` 0.2 with
  `baseUnit = 'piece'` — a 200 ml lotion read as a fifth of a piece. We now
  render no size for it. Its `pricePerUnit` of 34.95 €/kos is computed off that
  0.2 and is not a real per-piece price, but it still sorts and displays; we did
  not suppress it, because the value is what the backend computed and ranks on.
  A piece count below 1 is arguably never valid and could be rejected at parse
  time the way unparseable labels already are.
- **Sheet counts make €/piece very small.** Toilet paper parsed as `listov`
  yields 1500–4400 pieces per pack and prices around 0.0013 €/kos. Legitimate
  and comparable, but worth knowing that per-piece prices span four orders of
  magnitude, which is why the frontend now widens precision rather than showing
  `0,00`.
