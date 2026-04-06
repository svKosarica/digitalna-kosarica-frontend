import { searchProducts } from "@/actions/search.actions";
import ProductCard from "@/components/shared/ProductCard";
import ProductCardList from "@/components/shared/ProductCardList";
import { Pagination } from "@/components/shared/Pagination";
import { SearchFilters } from "@/components/shared/SearchFilters";
import { normalizeStoreName } from "@/lib/utils";
import type { FilterOption, SearchRequest, SortOption } from "@/types/search.types";
import { SearchX } from "lucide-react";

const PAGE_SIZE = 50;

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
  const currentPage = Math.max(0, parseInt(typeof params.page === "string" ? params.page : "0", 10) || 0);

  const request: SearchRequest = {
    page: currentPage,
    size: PAGE_SIZE + 1,
    query,
    filter,
    sortOption: order,
    isAvailable,
    cardDiscount,
    ...(storeIds && storeIds.length > 0 ? { storeIds } : {}),
  };

  const allResults = await searchProducts(request);
  const hasNextPage = allResults.length > PAGE_SIZE;
  const results = allResults.slice(0, PAGE_SIZE);

  const viewMode = params.view === "grid" ? "grid" : "list";
  const storeCount = new Set(results.map((item) => item.store?.name).filter(Boolean)).size;

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <header className="mb-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1 break-words">
          Rezultati za &ldquo;{query}&rdquo;
        </h1>
        <p className="text-muted-foreground font-medium">
          {results.length} {results.length === 1 ? "izdelek" : "izdelkov"} v {storeCount}{" "}
          {storeCount === 1 ? "trgovini" : "trgovinah"}
        </p>
      </header>

      <SearchFilters />

      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <SearchX size={48} strokeWidth={1.5} />
          <p className="text-lg">
            Ni rezultatov za &ldquo;{query}&rdquo;.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 justify-items-center">
          {results.map((item) => (
            <ProductCard
              key={item.id}
              id={item.id}
              imageUrl={item.product?.imageUrl ?? ""}
              brandName={item.product?.brand?.name ?? ""}
              productName={item.product?.title ?? item.product?.name ?? ""}
              price={item.price?.toFixed(2) ?? "0.00"}
              oldPrice={
                item.oldPrice != null && item.oldPrice !== item.price
                  ? item.oldPrice.toFixed(2)
                  : undefined
              }
              discountPct={item.discountPct > 0 ? item.discountPct : undefined}
              stores={
                item.store?.name && normalizeStoreName(item.store.name)
                  ? [normalizeStoreName(item.store.name)!]
                  : []
              }
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((item) => (
            <ProductCardList
              key={item.id}
              id={item.id}
              imageUrl={item.product?.imageUrl ?? ""}
              brandName={item.product?.brand?.name ?? ""}
              productName={item.product?.title ?? item.product?.name ?? ""}
              price={item.price?.toFixed(2) ?? "0.00"}
              oldPrice={
                item.oldPrice != null && item.oldPrice !== item.price
                  ? item.oldPrice.toFixed(2)
                  : undefined
              }
              discountPct={item.discountPct > 0 ? item.discountPct : undefined}
              stores={
                item.store?.name && normalizeStoreName(item.store.name)
                  ? [normalizeStoreName(item.store.name)!]
                  : []
              }
            />
          ))}
        </div>
      )}

      {(results.length > 0 || currentPage > 0) && (
        <Pagination currentPage={currentPage} hasNextPage={hasNextPage} />
      )}
    </div>
  );
}
