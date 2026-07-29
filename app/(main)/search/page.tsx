import { searchProducts } from "@/actions/search.actions";
import { getCategories } from "@/actions/category.actions";
import ProductCard from "@/components/shared/ProductCard";
import ProductCardList from "@/components/shared/ProductCardList";
import { Pagination } from "@/components/shared/Pagination";
import { SearchFilters } from "@/components/shared/SearchFilters";
import { normalizeStoreName, productCountLabel } from "@/lib/utils";
import type { FilterOption, SortOption } from "@/types/search.types";
import { STORE_MAP } from "@/types/search.types";
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

  const ALL_STORE_IDS = Object.keys(STORE_MAP).map(Number);
  const storeIds = typeof params.stores === "string"
    ? params.stores.split(",").map(Number).filter(Boolean)
    : ALL_STORE_IDS;

  // Parsed as an array even though the UI is single-select, so the wire format
  // is multi-select-ready. filter(Boolean) drops the NaN from ?categories=abc
  // and the 0 from a hand-edited URL.
  const categoryIds = typeof params.categories === "string"
    ? params.categories.split(",").map(Number).filter(Boolean)
    : [];

  const isAvailable = params.available !== "false";
  const cardDiscount = params.cardDiscount === "true";
  const currentPage = Math.max(0, parseInt(typeof params.page === "string" ? params.page : "0", 10) || 0);

  const [response, categories] = await Promise.all([
    searchProducts({
      page: currentPage,
      size: PAGE_SIZE,
      query,
      filter,
      sortOption: order,
      isAvailable,
      cardDiscount,
      storeIds,
      // undefined, not [] — omitted means "every category" server-side. Sending
      // all 36 ids would be wrong: it excludes uncategorized products.
      categoryIds: categoryIds.length ? categoryIds : undefined,
    }),
    getCategories(),
  ]);

  const results = response.products;
  const viewMode = params.view === "grid" ? "grid" : "list";
  const storeCount = new Set(results.map((item) => item.store?.name).filter(Boolean)).size;

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <header className="mb-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1 break-words">
          Rezultati za &ldquo;{query}&rdquo;
        </h1>
        <p className="text-muted-foreground font-medium">
          {productCountLabel(response.allItems)} v {storeCount}{" "}
          {storeCount === 1 ? "trgovini" : "trgovinah"}
        </p>
        {categoryIds.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground/80">
            Nekateri izdelki še niso razvrščeni v kategorije.
          </p>
        )}
      </header>

      <SearchFilters categories={categories} />

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
              unit={item.product?.unit ?? undefined}
              price={item.price?.toFixed(2) ?? "0.00"}
              oldPrice={
                item.oldPrice != null && item.oldPrice !== item.price
                  ? item.oldPrice.toFixed(2)
                  : undefined
              }
              discountPct={
                item.discountPct != null && item.discountPct > 0
                  ? item.discountPct
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
      ) : (
        <div className="space-y-4">
          {results.map((item) => (
            <ProductCardList
              key={item.id}
              id={item.id}
              imageUrl={item.product?.imageUrl ?? ""}
              brandName={item.product?.brand?.name ?? ""}
              productName={item.product?.title ?? item.product?.name ?? ""}
              unit={item.product?.unit ?? undefined}
              price={item.price?.toFixed(2) ?? "0.00"}
              oldPrice={
                item.oldPrice != null && item.oldPrice !== item.price
                  ? item.oldPrice.toFixed(2)
                  : undefined
              }
              discountPct={
                item.discountPct != null && item.discountPct > 0
                  ? item.discountPct
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

      <Pagination currentPage={response.currentPage} totalPages={response.numberOfPages} />
    </div>
  );
}
