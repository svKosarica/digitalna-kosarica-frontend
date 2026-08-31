"use client";

import Link from "next/link";
import { ProductImage } from "@/components/shared/ProductImage";
import { StoreLogos } from "@/components/shared/StoreLogos";
import { formatEurAmount } from "@/lib/format";
import { storeCountLabel } from "@/lib/utils";
import type { MultiStoreCardProps } from "@/components/shared/MultiStoreProductCard";

/**
 * Row layout for an article several stores carry — ProductCardList's frame
 * minus the cart button, for the same reason MultiStoreProductCard has no "+".
 *
 * Takes the exact same props as the grid card so MultiStoreResults can feed
 * both from one mapper and they cannot drift apart.
 */
export default function MultiStoreProductCardList({
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
      className="group block bg-card rounded-xl p-4 shadow-[0_4px_20px_rgba(62,39,35,0.08)] hover:ring-1 hover:ring-primary/40 transition-all"
    >
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="relative w-20 h-20 sm:w-28 sm:h-28 shrink-0 bg-card rounded-lg flex items-center justify-center overflow-visible">
          <ProductImage
            src={imageUrl}
            alt={productName}
            sizes="112px"
            className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
            iconClassName="size-10"
          />

          {/* Wording deliberately matches the grid card's "prihrani NN%" — do NOT
              shorten this to "-NN%". That form already means "NN% off the old
              price" everywhere else in this app (ProductCardList), and this
              badge is a cross-store spread, not a discount. */}
          {savingsPct != null && savingsPct > 0 && (
            <div className="absolute -top-1 -left-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold tracking-tight bg-primary text-primary-foreground">
              prihrani {Math.round(savingsPct)}%
            </div>
          )}

          {/* Logos ride under the thumbnail on phones, where the right-hand
              column is hidden — the same place ProductCardList puts its one. */}
          <StoreLogos
            stores={stores}
            max={3}
            size="sm"
            overlap
            className="absolute -bottom-1 -right-1 sm:hidden"
          />
        </div>

        <div className="grow min-w-0 flex flex-col gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate min-w-0">
                {brandName}
              </span>
              {size && (
                <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                  {size}
                </span>
              )}
            </div>
            <h4 className="text-base sm:text-xl font-extrabold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
              {productName}
            </h4>
          </div>

          {/* Mobile price block. The sm+ column below carries the same numbers. */}
          <div className="flex flex-col items-start gap-1 sm:hidden">
            <span className="text-lg font-bold text-foreground">
              <span className="text-xs font-semibold text-muted-foreground mr-1">
                od
              </span>
              {formatEurAmount(minPrice)} &euro;
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground truncate max-w-full">
              {cheapestStoreLabel && <>najceneje v {cheapestStoreLabel}</>}
              {cheapestStoreLabel && pricePerUnit && " · "}
              {pricePerUnit && (
                <span aria-label={pricePerUnitAria}>{pricePerUnit}</span>
              )}
              {/* Fallback when the cheapest store id isn't in STORE_MAP yet — a new
                  retailer can reach the API before this build knows its name. Same
                  locative wording as the grid card; storeCountLabel is nominative and
                  wrong after "v". */}
              {!cheapestStoreLabel && !pricePerUnit && (
                <>v {storeCount === 1 ? "1 trgovini" : `${storeCount} trgovinah`}</>
              )}
            </span>
            {stockNote && (
              <span className="text-[11px] font-semibold text-accent-foreground">
                {stockNote}
              </span>
            )}
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-2 shrink-0 min-w-[200px]">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-2xl font-bold text-foreground">
              <span className="text-sm font-semibold text-muted-foreground mr-1">
                od
              </span>
              {formatEurAmount(minPrice)} &euro;
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {cheapestStoreLabel && <>najceneje v {cheapestStoreLabel}</>}
              {cheapestStoreLabel && pricePerUnit && " · "}
              {pricePerUnit && (
                <span aria-label={pricePerUnitAria}>{pricePerUnit}</span>
              )}
              {/* Fallback when the cheapest store id isn't in STORE_MAP yet — a new
                  retailer can reach the API before this build knows its name. Same
                  locative wording as the grid card; storeCountLabel is nominative and
                  wrong after "v". */}
              {!cheapestStoreLabel && !pricePerUnit && (
                <>v {storeCount === 1 ? "1 trgovini" : `${storeCount} trgovinah`}</>
              )}
            </span>
            {stockNote && (
              <span className="text-[11px] font-semibold text-accent-foreground">
                {stockNote}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {/* storeCountLabel, not an inline ternary: this is a BARE nominative
                  count, where Slovenian has four forms (1 trgovina, 2 trgovini,
                  3/4 trgovine, 5+ trgovin). Note the grid card's "v N trgovinah" is
                  a different, LOCATIVE frame where a two-branch form IS correct —
                  do not "unify" the two. */}
              {storeCountLabel(storeCount)}
            </span>
            <StoreLogos stores={stores} max={5} size="lg" overlap />
          </div>
        </div>
      </div>
    </Link>
  );
}
