import type { StoreName } from "@/lib/store";

export type FilterOption = "PRICE" | "PRICE_PER_UNIT" | "DISCOUNT_PCT" | "NONE";

export type SortOption = "ASCENDING" | "DESCENDING" | "NONE";

/**
 * Every accepted filter value, for validating URL params. Shared so the page
 * and the filter bar cannot disagree about what a valid sort is.
 */
export const VALID_FILTERS: FilterOption[] = [
  "PRICE",
  "PRICE_PER_UNIT",
  "DISCOUNT_PCT",
  "NONE",
];

/**
 * The two real directions. NONE is a valid SortOption on the wire but is not a
 * direction: sortOption NONE is not neutral server-side — it orders descending —
 * so a chosen field must never reach the API carrying it.
 */
const SORT_DIRECTIONS: SortOption[] = ["ASCENDING", "DESCENDING"];

/** Direction each field falls back to when the URL carries no explicit one. */
export const DEFAULT_ORDER: Record<Exclude<FilterOption, "NONE">, SortOption> = {
  PRICE: "ASCENDING",
  PRICE_PER_UNIT: "ASCENDING",
  DISCOUNT_PCT: "DESCENDING",
};

/**
 * Field a search sorts by when the URL names none — cheapest first, which is
 * the question a price-comparison search is opened to answer. Typing into the
 * header search bar produces exactly such a URL (?q=… and nothing else).
 */
export const DEFAULT_FILTER: FilterOption = "PRICE";

/**
 * Resolves the sort pair from raw URL params.
 *
 * The search page and the filter bar both go through this so the results and
 * the controls above them cannot disagree — they previously defaulted
 * independently, which is exactly how a default would drift.
 *
 * An absent `filter` means "not chosen" and takes DEFAULT_FILTER; an explicit
 * `filter=NONE` is a choice — the visitor switched sorting off — and is kept.
 */
export function resolveSort(
  filterParam: string | null | undefined,
  orderParam: string | null | undefined,
): { filter: FilterOption; order: SortOption } {
  const filter = VALID_FILTERS.includes(filterParam as FilterOption)
    ? (filterParam as FilterOption)
    : DEFAULT_FILTER;

  // No field means no direction: the API ignores sortOption without one, and a
  // direction resolved here would light a pill the filter bar renders disabled.
  if (filter === "NONE") return { filter, order: "NONE" };

  const order = SORT_DIRECTIONS.includes(orderParam as SortOption)
    ? (orderParam as SortOption)
    : DEFAULT_ORDER[filter];

  return { filter, order };
}

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
