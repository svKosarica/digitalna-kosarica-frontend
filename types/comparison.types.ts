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
