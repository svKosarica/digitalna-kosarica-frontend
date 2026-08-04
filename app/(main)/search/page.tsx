import { searchProducts } from "@/actions/search.actions";
import { getCategories } from "@/actions/category.actions";
import ProductCard from "@/components/shared/ProductCard";
import ProductCardList from "@/components/shared/ProductCardList";
import { Pagination } from "@/components/shared/Pagination";
import { SearchFilters } from "@/components/shared/SearchFilters";
import { formatPricePerUnit, formatSize, pricePerUnitAriaLabel } from "@/lib/format";
import { cn, normalizeStoreName, productCountLabel } from "@/lib/utils";
import type { DiscountItem } from "@/types/product.types";
import type { FilterOption, SortOption } from "@/types/search.types";
import { STORE_MAP, VALID_FILTERS, VALID_SORTS } from "@/types/search.types";
import { SearchX } from "lucide-react";

const PAGE_SIZE = 50;

/**
 * Shared card props for both layouts. Unlike ProductResults this hides a
 * negative discountPct rather than flipping the badge — search results are not
 * a most-popular list and never show a price increase as a badge.
 */
function cardProps(item: DiscountItem) {
  const storeName = item.store?.name ? normalizeStoreName(item.store.name) : undefined;

  return {
    id: item.id,
    imageUrl: item.product?.imageUrl ?? "",
    brandName: item.product?.brand?.name ?? "",
    productName: item.product?.title ?? item.product?.name ?? "",
    size: formatSize(item.totalQuantity, item.baseUnit) ?? undefined,
    pricePerUnit: formatPricePerUnit(item.pricePerUnit, item.baseUnit) ?? undefined,
    pricePerUnitAria:
      pricePerUnitAriaLabel(item.pricePerUnit, item.baseUnit) ?? undefined,
    price: item.price?.toFixed(2) ?? "0.00",
    oldPrice:
      item.oldPrice != null && item.oldPrice !== item.price
        ? item.oldPrice.toFixed(2)
        : undefined,
    discountPct:
      item.discountPct != null && item.discountPct > 0 ? item.discountPct : undefined,
    stores: storeName ? [storeName] : [],
  };
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  const filter = VALID_FILTERS.includes(params.filter as FilterOption)
    ? (params.filter as FilterOption)
    : "NONE";

  const order = VALID_SORTS.includes(params.order as SortOption)
    ? (params.order as SortOption)
    : "NONE";

  const ALL_STORE_IDS = Object.keys(STORE_MAP).map(Number);
  const requestedStoreIds =
    typeof params.stores === "string"
      ? params.stores.split(",").map(Number).filter((id) => id in STORE_MAP)
      : [];
  // Never forward [] — the API reads it as "every store", so an empty
  // (?stores=) or all-garbage (?stores=99) param would silently mean the
  // opposite of a filter. Membership also subsumes the old filter(Boolean),
  // which only caught NaN and 0.
  const storeIds = requestedStoreIds.length ? requestedStoreIds : ALL_STORE_IDS;

  // Parsed as an array even though the UI is single-select, so the wire format
  // is multi-select-ready. The positive-integer check rejects the NaN from
  // ?categories=abc, the 0 from a hand-edited URL, and non-integers/Infinity
  // (e.g. ?categories=2.5 or ?categories=1e400) — Infinity matters because
  // JSON.stringify turns it into a null array element, which can reach the
  // backend's categoryIds as a null inside a List<Long>.
  const categoryIds = typeof params.categories === "string"
    ? params.categories.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0)
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
  // Three states, and null is the interesting one: it means "the visitor has
  // not chosen", which the server cannot resolve because it does not know the
  // viewport. Rather than guess and correct on the client — which is what the
  // deleted mount effect did, and why results flashed as rows — both layouts
  // render and CSS picks, exactly as ProductResults does on /popular.
  const viewParam =
    params.view === "grid" || params.view === "list" ? params.view : null;
  const storeCount = new Set(results.map((item) => item.store?.name).filter(Boolean)).size;

  return (
    <div className="px-4 sm:px-6 lg:px-20 py-6 space-y-6">
      <header className="mb-2">
        {/* No query is not an error state: the API accepts an empty query and
            returns the whole catalogue, which is what the home page's
            "Primerjaj cene" links into. */}
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1 break-words">
          {query ? <>Rezultati za &ldquo;{query}&rdquo;</> : "Vsi izdelki"}
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
            {query ? <>Ni rezultatov za &ldquo;{query}&rdquo;.</> : "Ni rezultatov."}
          </p>
        </div>
      ) : (
        <>
          {viewParam !== "list" && (
            <div
              className={cn(
                "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 justify-items-center",
                viewParam === null && "hidden sm:grid",
              )}
            >
              {results.map((item) => (
                <ProductCard key={item.id} {...cardProps(item)} />
              ))}
            </div>
          )}

          {viewParam !== "grid" && (
            <div className={cn("space-y-4", viewParam === null && "sm:hidden")}>
              {results.map((item) => (
                <ProductCardList key={item.id} {...cardProps(item)} />
              ))}
            </div>
          )}
        </>
      )}

      <Pagination currentPage={response.currentPage} totalPages={response.numberOfPages} />
    </div>
  );
}
