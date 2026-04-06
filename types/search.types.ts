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
}

export const STORE_MAP: Record<number, string> = {
  1: "spar",
  2: "lidl",
  3: "mercator",
  4: "hofer",
};
