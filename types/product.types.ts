export interface Brand {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  brand: Brand;
  name: string;
  title: string;
  unit: string;
  imageUrl: string;
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
  pricePerUnit: number;
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
