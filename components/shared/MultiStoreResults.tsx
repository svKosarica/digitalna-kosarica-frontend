import MultiStoreProductCard, {
  type MultiStoreCardProps,
} from "@/components/shared/MultiStoreProductCard";
import MultiStoreProductCardList from "@/components/shared/MultiStoreProductCardList";
import { Pagination } from "@/components/shared/Pagination";
import { derivePricePerUnit, stockDisplay } from "@/lib/comparison";
import {
  formatPricePerUnit,
  formatSize,
  pricePerUnitAriaLabel,
} from "@/lib/format";
import { STORE_LOGOS } from "@/lib/store";
import { cn } from "@/lib/utils";
import { STORE_MAP } from "@/types/search.types";
import type { MultiStoreProduct } from "@/types/comparison.types";

/**
 * The single wire-row-to-card-props mapper for multi-store rows.
 *
 * Exported because the home rail renders the same cards from the same endpoint
 * and must not grow a second copy of this logic — /search, /popular and
 * /product each already carry their own `cardProps`, and keeping those three in
 * agreement has been a recurring cost.
 */
export function multiStoreCardProps(row: MultiStoreProduct): MultiStoreCardProps {
  // Bare ids on the list endpoint (only the detail response embeds a store
  // object). An id absent from STORE_MAP renders no logo rather than throwing:
  // ids come from a database identity column, so a new retailer can appear
  // before this build knows its name.
  const stores = row.storeIds
    .map((id) => STORE_MAP[id])
    .filter((name): name is NonNullable<typeof name> => Boolean(name));

  const cheapestStore = STORE_MAP[row.cheapestStoreId];

  // Derived, not read: the list endpoint sends no pricePerUnit. Can differ by a
  // cent from the detail page's scraped value — see derivePricePerUnit.
  const derived = derivePricePerUnit(
    row.minPrice,
    row.totalQuantity,
    row.baseUnit,
  );

  const { note, showSavingsBadge } = stockDisplay(row);

  return {
    // product.id, NOT a storeProductId. This is the /primerjava href.
    productId: row.product.id,
    imageUrl: row.product?.imageUrl ?? "",
    brandName: row.product?.brand?.name ?? "",
    productName: row.product?.title ?? row.product?.name ?? "",
    size: formatSize(row.totalQuantity, row.baseUnit) ?? undefined,
    pricePerUnit: formatPricePerUnit(derived, row.baseUnit) ?? undefined,
    pricePerUnitAria: pricePerUnitAriaLabel(derived, row.baseUnit) ?? undefined,
    minPrice: row.minPrice,
    savingsPct: showSavingsBadge ? row.savingsPct : undefined,
    storeCount: row.storeCount,
    stores,
    cheapestStoreLabel: cheapestStore
      ? STORE_LOGOS[cheapestStore].label
      : undefined,
    stockNote: note ?? undefined,
  };
}

interface MultiStoreResultsProps {
  items: MultiStoreProduct[];
  currentPage: number;
  totalPages: number;
  /**
   * The `view` param, or null when the visitor has not chosen — which the
   * server cannot resolve, because it does not know the viewport. With null,
   * both layouts render and CSS picks at `sm`, exactly as /search does, so
   * results never flash as rows before becoming cards.
   */
  viewParam: "grid" | "list" | null;
}

export function MultiStoreResults({
  items,
  currentPage,
  totalPages,
  viewParam,
}: MultiStoreResultsProps) {
  return (
    <>
      {viewParam !== "list" && (
        <div
          className={cn(
            "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 justify-items-center",
            viewParam === null && "hidden sm:grid",
          )}
        >
          {items.map((row) => (
            <MultiStoreProductCard
              key={row.product.id}
              {...multiStoreCardProps(row)}
            />
          ))}
        </div>
      )}

      {viewParam !== "grid" && (
        <div className={cn("space-y-4", viewParam === null && "sm:hidden")}>
          {items.map((row) => (
            <MultiStoreProductCardList
              key={row.product.id}
              {...multiStoreCardProps(row)}
            />
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} />
    </>
  );
}
