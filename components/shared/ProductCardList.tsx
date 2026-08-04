"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { ProductImage } from "@/components/shared/ProductImage";
import { type StoreName, STORE_LOGOS } from "@/lib/store";
import { useCart } from "@/lib/cart";

interface ProductCardListProps {
  id: number;
  imageUrl: string;
  /** Overrides the alt text, which defaults to the product name. */
  imageAlt?: string;
  brandName: string;
  productName: string;
  /** Pre-formatted, e.g. "1,98 L". Absent when the listing has no parsed size. */
  size?: string;
  /** Pre-formatted with its unit label, e.g. "1,16 €/L". Never render a bare number. */
  pricePerUnit?: string;
  /** Spoken form of pricePerUnit, e.g. "cena na liter: 1,16 €". */
  pricePerUnitAria?: string;
  price: string;
  oldPrice?: string;
  discountPct?: number;
  currency?: string;
  stores?: StoreName[];
  badgeVariant?: "discount" | "increase";
}

export default function ProductCardList({
  id,
  imageUrl,
  imageAlt,
  brandName,
  productName,
  size,
  pricePerUnit,
  pricePerUnitAria,
  price,
  oldPrice,
  discountPct,
  currency = "€",
  stores = [],
  badgeVariant = "discount",
}: ProductCardListProps) {
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  // Price direction vs. old price (oldPrice is only passed when it differs).
  const oldPriceNum = oldPrice ? parseFloat(oldPrice) : NaN;
  const priceNum = parseFloat(price);
  const priceDir: "up" | "down" | null =
    !Number.isNaN(oldPriceNum) && !Number.isNaN(priceNum) && oldPriceNum !== priceNum
      ? priceNum > oldPriceNum
        ? "up"
        : "down"
      : null;
  const isIncrease = priceDir === "up";

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (added) return;
    if (!stores[0]) return;
    addItem({
      id,
      productName,
      brandName,
      imageUrl,
      price: parseFloat(price),
      oldPrice: oldPrice ? parseFloat(oldPrice) : undefined,
      discountPct,
      storeName: stores[0],
      size,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <Link href={`/product/${id}`} className="group block bg-card rounded-xl p-4 shadow-[0_4px_20px_rgba(62,39,35,0.08)] hover:ring-1 hover:ring-primary/40 transition-all">
    <div className="flex items-center gap-4 sm:gap-6">
      <div className="relative w-20 h-20 sm:w-28 sm:h-28 shrink-0 bg-card rounded-lg flex items-center justify-center overflow-visible">
        <ProductImage
          src={imageUrl}
          alt={imageAlt ?? productName}
          sizes="112px"
          className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
          iconClassName="size-10"
        />

        {discountPct != null &&
          (badgeVariant === "increase" ? discountPct < 0 : discountPct > 0) && (
            <div
              className={`absolute -top-1 -left-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-tight ${
                badgeVariant === "increase"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {badgeVariant === "increase"
                ? `+${Math.round(Math.abs(discountPct))}%`
                : `-${discountPct}%`}
            </div>
          )}

        {stores.length > 0 && STORE_LOGOS[stores[0]] && (
          <div className="absolute -bottom-1 -right-1 sm:hidden">
            {(() => {
              const { label, logoUrl } = STORE_LOGOS[stores[0]];
              return (
                <div className="w-6 h-6 rounded-full bg-card border border-border/20 flex items-center justify-center overflow-hidden shadow-sm">
                  <Image src={logoUrl} alt={label} width={16} height={16} className="w-full h-full object-contain" />
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="grow min-w-0 flex flex-col gap-2">
        <div className="min-w-0">
          {/* Brand left, size right — brand truncates so the size stays pinned
              to the edge on narrow rows instead of pushing out of the card. */}
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

        {/* Stacked, not a justify-between row: with a wrapping row the button
            only dropped below the price when an old price made the row wide
            enough, so rows without one looked different. */}
        <div className="flex flex-col items-start gap-2 sm:hidden">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-lg font-bold text-foreground">
              {price} {currency}
            </span>
            {priceDir === "up" && (
              <ArrowUp className="size-3.5 self-center text-red-500" strokeWidth={3} aria-label="Cena narasla" />
            )}
            {priceDir === "down" && (
              <ArrowDown className="size-3.5 self-center text-green-600" strokeWidth={3} aria-label="Cena padla" />
            )}
            {oldPrice && (
              <span
                className={`text-xs font-semibold text-accent-foreground ${
                  isIncrease ? "" : "line-through"
                }`}
              >
                {oldPrice} {currency}
              </span>
            )}
          </div>
          {pricePerUnit && (
            <span
              className="text-[11px] font-semibold text-muted-foreground"
              aria-label={pricePerUnitAria}
            >
              {pricePerUnit}
            </span>
          )}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={added}
            className={`inline-flex items-center gap-1 bg-primary text-primary-foreground py-1.5 px-3 rounded-xl font-bold text-xs transition-colors duration-200 ${
              added ? "animate-button-pop cursor-default" : "hover:bg-primary/90 active:scale-95 cursor-pointer"
            }`}
          >
            {added ? (
              <>
                <Check className="size-3.5" strokeWidth={3} /> Dodano
              </>
            ) : (
              "V Košarico"
            )}
          </button>
        </div>
      </div>

      <div className="hidden sm:flex flex-col items-end gap-3 shrink-0 min-w-[180px]">
        {/* Price and its per-unit line are wrapped tightly: the column's gap-3
            would otherwise push the per-unit line away from the price it qualifies. */}
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-foreground">
              {price} {currency}
            </span>
            {priceDir === "up" && (
              <ArrowUp className="size-4 self-center text-red-500" strokeWidth={3} aria-label="Cena narasla" />
            )}
            {priceDir === "down" && (
              <ArrowDown className="size-4 self-center text-green-600" strokeWidth={3} aria-label="Cena padla" />
            )}
            {oldPrice && (
              <span
                className={`text-sm font-semibold text-accent-foreground ${
                  isIncrease ? "" : "line-through"
                }`}
              >
                {oldPrice} {currency}
              </span>
            )}
          </div>
          {pricePerUnit && (
            <span
              className="text-[11px] font-semibold text-muted-foreground"
              aria-label={pricePerUnitAria}
            >
              {pricePerUnit}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {stores.length > 0 && (
            <div className="flex -space-x-2">
              {stores.map((store) => {
                const storeInfo = STORE_LOGOS[store];
                if (!storeInfo) return null;
                const { label, logoUrl } = storeInfo;
                return (
                  <div
                    key={store}
                    className="w-8 h-8 rounded-full bg-card border-2 border-card flex items-center justify-center overflow-hidden shadow-sm"
                    title={label}
                  >
                    <Image
                      src={logoUrl}
                      alt={label}
                      width={24}
                      height={24}
                      className="w-full h-full object-contain"
                    />
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={added}
            className={`inline-flex items-center gap-1.5 bg-primary text-primary-foreground py-2 px-3 rounded-xl font-bold text-sm transition-colors duration-200 ${
              added ? "animate-button-pop cursor-default" : "hover:bg-primary/90 active:scale-95 cursor-pointer"
            }`}
          >
            {added ? (
              <>
                <Check className="size-4" strokeWidth={3} /> Dodano
              </>
            ) : (
              "V Košarico"
            )}
          </button>
        </div>
      </div>
    </div>
    </Link>
  );
}
