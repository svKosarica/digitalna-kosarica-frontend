import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { AddToCartButton } from "@/components/shared/AddToCartButton";
import { CardDiscountMark } from "@/components/shared/CardDiscountMark";
import {
  formatEurAmount,
  formatPricePerUnit,
  pricePerUnitAriaLabel,
} from "@/lib/format";
import { STORE_LOGOS } from "@/lib/store";
import { cn, normalizeStoreName } from "@/lib/utils";
import type { ProductComparisonListing } from "@/types/comparison.types";

/**
 * A listing unseen this long gets a note; scrapes land daily.
 *
 * Must stay >= 5: staleNote hardcodes the CLDR "other" plural form "dnevi",
 * which is correct for 5 and above. Lowering this below 5 requires the
 * four-form treatment via Intl.PluralRules — see formatSize in lib/format.ts
 * for the in-repo pattern.
 */
const STALE_DAYS = 7;

export const OUT_OF_STOCK_CART_LABEL =
  "Ni na zalogi — dodajanje v košarico ni mogoče";

/**
 * Shown instead of OUT_OF_STOCK_CART_LABEL when the listing IS in stock but its
 * store is not one this build knows. Reachable by design: store ids come from a
 * database identity column, so a new retailer can reach the API before the
 * frontend has its name and logo. Saying "ni na zalogi" there would state a
 * false availability fact next to a row whose own chip reads "Na zalogi".
 */
export const UNKNOWN_STORE_CART_LABEL =
  "Dodajanje iz te trgovine še ni mogoče";

function staleNote(lastSeenAt: string | null): string | null {
  if (!lastSeenAt) return null;
  const seen = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(seen)) return null;
  const days = Math.floor((Date.now() - seen) / 86_400_000);
  if (days < STALE_DAYS) return null;
  return `nazadnje videno pred ${days} dnevi`;
}

interface StoreListingRowProps {
  listing: ProductComparisonListing;
  /** True for listings[0] only — one winner, even when a later row ties. */
  isCheapest: boolean;
  productName: string;
  brandName: string;
  /** Pre-formatted group size, e.g. "1,5 L". */
  size?: string;
}

/**
 * One store's price for the article, with its own actions.
 *
 * One row per LISTING, not per store: a store that lists the article twice gets
 * two rows, at its two different prices. The caller keys on storeProductId.
 *
 * Out-of-stock rows are muted but never removed — an out-of-stock price is
 * still a published price, and dropping it would make the comparison churn
 * daily as stock moved.
 */
export function StoreListingRow({
  listing,
  isCheapest,
  productName,
  brandName,
  size,
}: StoreListingRowProps) {
  const storeName = normalizeStoreName(listing.store.name);
  const info = storeName ? STORE_LOGOS[storeName] : undefined;

  const perUnit = formatPricePerUnit(listing.pricePerUnit, listing.baseUnit);
  const perUnitAria = pricePerUnitAriaLabel(
    listing.pricePerUnit,
    listing.baseUnit,
  );

  // discountPct is NEGATIVE when the price rose, so this is a > 0 test, not a
  // != null one — the same rule /search applies.
  const onSale =
    listing.discountPct != null &&
    listing.discountPct > 0 &&
    listing.oldPrice != null &&
    listing.oldPrice !== listing.price;

  // The store's own label differs per store for the same article. Showing it
  // when it differs lets a shopper confirm the store really sells this thing.
  const storeTitle =
    listing.title && listing.title !== productName ? listing.title : null;

  const stale = staleNote(listing.lastSeenAt);

  // Which failure the disabled button is reporting: out of stock, or a store
  // this build cannot put in the basket. Never conflate them.
  const disabledCartLabel = !listing.isAvailable
    ? OUT_OF_STOCK_CART_LABEL
    : UNKNOWN_STORE_CART_LABEL;

  return (
    <div
      className={cn(
        "relative bg-card rounded-2xl border p-4 sm:p-5",
        isCheapest ? "border-primary/40 ring-1 ring-primary/30" : "border-border/10",
        !listing.isAvailable && "opacity-60",
      )}
    >
      {isCheapest && (
        <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest">
          Najceneje
        </span>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 min-w-0 sm:w-44 shrink-0">
          {info ? (
            <div className="w-10 h-10 rounded-full bg-card border border-border/20 flex items-center justify-center overflow-hidden shrink-0">
              <Image
                src={info.logoUrl}
                alt={info.label}
                width={28}
                height={28}
                className="w-full h-full object-contain p-1"
              />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate">
              {info?.label ?? listing.store.name}
            </p>
            <p
              className={cn(
                "text-[11px] font-semibold",
                listing.isAvailable ? "text-primary" : "text-muted-foreground",
              )}
            >
              {listing.isAvailable ? "Na zalogi" : "Ni na zalogi"}
            </p>
          </div>
        </div>

        <div className="grow min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            {onSale && (
              <span className="text-sm font-semibold text-accent-foreground line-through">
                {formatEurAmount(listing.oldPrice!)} &euro;
              </span>
            )}
            <span className="text-xl sm:text-2xl font-bold text-foreground">
              {formatEurAmount(listing.price)} &euro;
            </span>
            {onSale && (
              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                -{Math.round(listing.discountPct!)}%
              </span>
            )}
            {listing.cardDiscount && <CardDiscountMark className="self-center" />}
          </div>

          {perUnit && (
            <p
              className="text-[11px] font-semibold text-muted-foreground mt-0.5"
              aria-label={perUnitAria ?? undefined}
            >
              {perUnit}
            </p>
          )}
          {storeTitle && (
            <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">
              {storeTitle}
            </p>
          )}
          {stale && (
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">{stale}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {listing.isAvailable && storeName ? (
            <AddToCartButton
              item={{
                // storeProductId: the cart is per-listing, so the same article
                // from two stores is two lines at two prices. That is correct —
                // they are two different purchases.
                id: listing.storeProductId,
                productName,
                brandName,
                imageUrl: listing.imageUrl ?? "",
                price: listing.price,
                oldPrice: onSale ? listing.oldPrice! : undefined,
                discountPct: onSale ? listing.discountPct! : undefined,
                storeName,
                size,
                cardDiscount: listing.cardDiscount,
              }}
            />
          ) : (
            <button
              type="button"
              disabled
              aria-label={disabledCartLabel}
              title={disabledCartLabel}
              className="inline-flex items-center justify-center gap-1.5 bg-border/40 text-muted-foreground px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-xs sm:text-sm whitespace-nowrap cursor-not-allowed"
            >
              V Košarico
            </button>
          )}

          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Poglej v trgovini ${info?.label ?? listing.store.name}`}
            className="inline-flex items-center justify-center gap-1.5 bg-secondary text-foreground px-3 sm:px-4 py-2.5 sm:py-3 rounded-full font-bold text-xs sm:text-sm hover:bg-secondary/70 transition-all active:scale-95"
          >
            <span className="hidden lg:inline">V trgovino</span>
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
