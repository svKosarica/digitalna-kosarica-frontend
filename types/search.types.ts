import type { StoreName } from "@/lib/store";

export type FilterOption = "PRICE" | "PRICE_PER_UNIT" | "DISCOUNT_PCT" | "NONE";

export type SortOption = "ASCENDING" | "DESCENDING" | "NONE";

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

/** Wire ids for the stores the API serves. `Object.keys` order defines filter order. */
export const STORE_MAP: Record<number, StoreName> = {
  1: "spar",
  2: "lidl",
  3: "mercator",
  4: "hofer",
  5: "tus",
};

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
