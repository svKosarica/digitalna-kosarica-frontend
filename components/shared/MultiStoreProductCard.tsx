"use client";

import Link from "next/link";
import { ProductImage } from "@/components/shared/ProductImage";
import { StoreLogos } from "@/components/shared/StoreLogos";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatEurAmount } from "@/lib/format";
import type { StoreName } from "@/lib/store";

export interface MultiStoreCardProps {
  /** product.id — the /primerjava href. NEVER a storeProductId. */
  productId: number;
  imageUrl: string;
  brandName: string;
  productName: string;
  /** Pre-formatted, e.g. "1,5 L". Absent when the group has no agreed size. */
  size?: string;
  /**
   * Pre-formatted, e.g. "1,19 €/L", and DERIVED from minPrice rather than read
   * off a listing — the list endpoint sends no pricePerUnit. It can differ by
   * a cent from the detail page's scraped figure; see derivePricePerUnit.
   */
  pricePerUnit?: string;
  pricePerUnitAria?: string;
  /** Raw euro amount. The card formats it; callers must not pre-format. */
  minPrice: number;
  /** Absent when the stock rules say the badge must not show. */
  savingsPct?: number;
  storeCount: number;
  stores: StoreName[];
  /** e.g. "Lidl". Absent when cheapestStoreId is not in STORE_MAP. */
  cheapestStoreLabel?: string;
  /** The single stock line, already resolved by stockDisplay. */
  stockNote?: string;
}

/**
 * Grid card for an article several stores carry.
 *
 * Two deliberate differences from ProductCard:
 *
 *  - It links to /primerjava/{product.id}, a different id space from
 *    /product/{storeProductId}. Both are bare integers, so this must never be
 *    handed an `item.id`.
 *  - There is no "+" button. A group has no single price to add, and picking a
 *    store silently is the one thing this feature exists to stop. The choice
 *    happens on the comparison page, so the whole card is one link and the
 *    price block takes the full width.
 *
 * Same 256x380 frame as ProductCard so the two never disagree in a mixed
 * layout.
 */
export default function MultiStoreProductCard({
  productId,
  imageUrl,
  brandName,
  productName,
  size,
  pricePerUnit,
  pricePerUnitAria,
  minPrice,
  savingsPct,
  storeCount,
  stores,
  cheapestStoreLabel,
  stockNote,
}: MultiStoreCardProps) {
  return (
    <Link
      href={`/primerjava/${productId}`}
      className="group w-64 h-[380px] bg-card rounded-xl p-5 transition-all duration-300 hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.06)] flex flex-col"
    >
      <div className="relative aspect-square mb-4 bg-card rounded-lg flex items-center justify-center overflow-hidden border border-border/10">
        <ProductImage
          src={imageUrl}
          alt={productName}
          sizes="(max-width: 640px) 50vw, 240px"
          className="w-4/5 h-4/5 object-contain transition-transform duration-500 group-hover:scale-110"
          iconClassName="size-12"
        />

        {/* Absent, not dimmed, when the cheapest listing is unbuyable: an
            unbuyable headline saving is worse than no headline. The caller has
            already applied that rule by omitting savingsPct. */}
        {savingsPct != null && savingsPct > 0 && (
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold tracking-tight bg-primary text-primary-foreground">
            prihrani {Math.round(savingsPct)}%
          </div>
        )}

        <StoreLogos
          stores={stores}
          max={4}
          size="md"
          className="absolute top-3 right-3"
        />
      </div>

      <div className="grow">
        {/* Brand left, size right — brand truncates so the size stays pinned to
            the edge instead of pushing out of the card. */}
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold truncate min-w-0">
            {brandName}
          </p>
          {size && (
            <p className="text-[10px] text-muted-foreground font-semibold shrink-0">
              {size}
            </p>
          )}
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <h3 className="text-lg font-semibold text-foreground leading-snug mb-4 group-hover:text-primary transition-colors truncate cursor-default">
                {productName}
              </h3>
            </TooltipTrigger>
            <TooltipContent>{productName}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* No button, so this block spans the card rather than sharing a row. */}
      <div className="mt-auto">
        <p className="text-2xl font-bold text-foreground">
          <span className="text-sm font-semibold text-muted-foreground mr-1">
            od
          </span>
          {formatEurAmount(minPrice)} &euro;
        </p>

        <p className="text-[11px] text-muted-foreground font-semibold mt-0.5 truncate">
          {cheapestStoreLabel && <>najceneje v {cheapestStoreLabel}</>}
          {cheapestStoreLabel && pricePerUnit && " · "}
          {pricePerUnit && (
            <span aria-label={pricePerUnitAria}>{pricePerUnit}</span>
          )}
          {!cheapestStoreLabel && !pricePerUnit && (
            <>v {storeCount === 1 ? "1 trgovini" : `${storeCount} trgovinah`}</>
          )}
        </p>

        {stockNote && (
          <p className="text-[11px] text-accent-foreground font-semibold mt-0.5 truncate">
            {stockNote}
          </p>
        )}
      </div>
    </Link>
  );
}
