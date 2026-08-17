import type { StoreName } from "@/lib/store";

export type FilterOption = "PRICE" | "PRICE_PER_UNIT" | "DISCOUNT_PCT" | "NONE";

export type SortOption = "ASCENDING" | "DESCENDING" | "NONE";

/**
 * Every accepted value, for validating URL params. Shared so the page and the
 * filter bar cannot disagree about what a valid sort is.
 *
 * Note that sortOption NONE is not neutral server-side — it orders descending —
 * so the UI must never show a chosen filter with no direction.
 */
export const VALID_FILTERS: FilterOption[] = [
  "PRICE",
  "PRICE_PER_UNIT",
  "DISCOUNT_PCT",
  "NONE",
];

export const VALID_SORTS: SortOption[] = ["ASCENDING", "DESCENDING", "NONE"];

export interface SearchRequest {
  page: number;
  size: number;
  query: string;
  filter: FilterOption;
  sortOption: SortOption;
  storeIds?: number[];
  isAvailable: boolean;
  cardDiscount: boolean;
  /**
   * Omitted / null / [] all mean "every category". A parent id matches its
   * whole subtree, not just its direct children — the backend's rollup went
   * recursive when the drinks branch gained a third level, so sending Pijače
   * also matches a listing filed only on the Vino leaf.
   */
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

/**
 * One category with its subtree. Depth is not fixed: the taxonomy was two
 * levels until the drinks branch gained a third (Pijače > Alkoholne pijače >
 * Vino), so nothing here may assume a leaf is reached at any particular level.
 */
export interface CategoryTreeNode {
  category: Category;
  children: CategoryTreeNode[];
}

/**
 * Shared by the trigger placeholder and the "all" item label. These MUST stay
 * identical — stale-id recovery in SearchFilters depends on an unknown id
 * rendering the placeholder and being visually indistinguishable from "all".
 */
export const ALL_CATEGORIES_LABEL = "Vse kategorije";
