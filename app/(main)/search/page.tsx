import { searchProducts } from "@/actions/search.actions";
import ProductCard from "@/components/shared/ProductCard";
import { SearchFilters } from "@/components/shared/SearchFilters";
import { normalizeStoreName } from "@/lib/utils";
import type { FilterOption, SearchRequest, SortOption } from "@/types/search.types";
import { SearchX } from "lucide-react";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <SearchX size={48} strokeWidth={1.5} />
        <p className="text-lg">Vnesi iskalni pojem v iskalno polje.</p>
      </div>
    );
  }

  const VALID_FILTERS: FilterOption[] = ["PRICE", "PRICE_PER_UNIT", "DISCOUNT_PCT", "NONE"];
  const VALID_SORTS: SortOption[] = ["ASCENDING", "DESCENDING", "NONE"];

  const filter = VALID_FILTERS.includes(params.filter as FilterOption)
    ? (params.filter as FilterOption)
    : "PRICE";

  const order = VALID_SORTS.includes(params.order as SortOption)
    ? (params.order as SortOption)
    : "DESCENDING";

  const storeIds = typeof params.stores === "string"
    ? params.stores.split(",").map(Number).filter(Boolean)
    : undefined;

  const isAvailable = params.available !== "false";
  const cardDiscount = params.cardDiscount === "true";

  const request: SearchRequest = {
    page: 0,
    size: 50,
    query,
    filter,
    sortOption: order,
    isAvailable,
    cardDiscount,
    ...(storeIds && storeIds.length > 0 ? { storeIds } : {}),
  };

  const results = await searchProducts(request);

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <SearchFilters />

      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <SearchX size={48} strokeWidth={1.5} />
          <p className="text-lg">
            Ni rezultatov za &ldquo;{query}&rdquo;.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 justify-items-center">
          {results.map((item) => (
            <ProductCard
              key={item.id}
              imageUrl={item.product?.imageUrl ?? ""}
              brandName={item.product?.brand?.name ?? ""}
              productName={item.product?.title ?? item.product?.name ?? ""}
              price={item.price?.toFixed(2) ?? "0.00"}
              oldPrice={
                item.oldPrice != null && item.oldPrice !== item.price
                  ? item.oldPrice.toFixed(2)
                  : undefined
              }
              stores={
                item.store?.name && normalizeStoreName(item.store.name)
                  ? [normalizeStoreName(item.store.name)!]
                  : []
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
