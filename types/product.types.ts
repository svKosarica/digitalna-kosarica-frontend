export interface Brand {
  id: number;
  name: string;
}

/**
 * Canonical base the backend expresses a quantity in. Mirrors the four
 * UnitSpec constants in the product-comparison service; there is no fifth
 * value today. Null on a listing whose store label could not be parsed.
 */
export type BaseUnit = "g" | "ml" | "piece" | "m";

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

export interface Store {
  id: number;
  name: string;
  url: string;
  imageUrl: string;
}

export interface DiscountItem {
  id: number;
  product: Product;
  store: Store;
  price: number;
  // Null for products the API has never seen at a different price (no history
  // yet). Negative discountPct means the product got *more expensive* — the
  // most-popular list returns all three cases mixed together.
  oldPrice: number | null;
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
  discountPct: number | null;
  isAvailable: boolean;
  cardDiscount: boolean;
  url: string;
}

/**
 * Time window for the highest-discount list.
 * CURRENT = discounted right now, DAILY = discount appeared today,
 * WEEKLY = appeared in the last 7 days (the API default).
 */
export type DiscountWindow = "CURRENT" | "DAILY" | "WEEKLY";

export interface SearchResponse {
  products: DiscountItem[];
  currentPage: number;
  numberOfPages: number;
  currentItems: number;
  allItems: number;
}

export interface PriceHistoryEntry {
  timestamp: string;
  price: number;
  cardDiscount: boolean;
}

export interface ProductDetail extends DiscountItem {
  priceHistory: PriceHistoryEntry[];
}
