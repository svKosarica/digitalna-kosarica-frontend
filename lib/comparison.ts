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

// Re-declared rather than imported from types/comparison.types.ts, which exports
// the identical VALID_MULTI_STORE_SORTS. Importing that value would make this a
// value import, and bare `node` cannot resolve the `@/` alias — the module would
// stop being directly runnable, which is the whole verification story in the file
// header above. Keep these four values in sync by hand; do not DRY them.
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
  // !Number.isFinite covers Infinity as well as NaN: Infinity passes a bare `> 0`
  // test, and price / Infinity is 0 — which would render "0,00 €/kg" as though the
  // product were free, instead of hiding the per-unit line the way a missing
  // quantity should.
  if (totalQuantity == null || !Number.isFinite(totalQuantity) || totalQuantity <= 0)
    return null;
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
