"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Plus } from "lucide-react";
import { ProductImage } from "@/components/shared/ProductImage";
import { CardDiscountMark } from "@/components/shared/CardDiscountMark";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { STORE_LOGOS, type StoreName } from "@/lib/store";
import { formatEurAmount } from "@/lib/format";
import { useCart } from "@/lib/cart";

interface ProductCardProps {
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
  /** Raw euro amount. The card formats it; callers must not pre-format. */
  price: number;
  /** Raw euro amount, passed only when it differs from `price`. */
  oldPrice?: number;
  discountPct?: number;
  currency?: string;
  stores?: StoreName[];
  /** True when this price only applies with the store's loyalty card. */
  cardDiscount?: boolean;
  badgeVariant?: "discount" | "increase";
}

export default function ProductCard({
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
  cardDiscount = false,
  badgeVariant = "discount",
}: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  // Price direction vs. old price (oldPrice is only passed when it differs).
  const priceDir: "up" | "down" | null =
    oldPrice != null && oldPrice !== price
      ? price > oldPrice
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
      price,
      oldPrice,
      discountPct,
      storeName: stores[0],
      size,
      cardDiscount,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <Link href={`/product/${id}`} className="group w-64 h-[380px] bg-card rounded-xl p-5 transition-all duration-300 hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.06)] flex flex-col">
      <div className="relative aspect-square mb-4 bg-card rounded-lg flex items-center justify-center overflow-hidden border border-border/10">
        <ProductImage
          src={imageUrl}
          alt={imageAlt ?? productName}
          sizes="(max-width: 640px) 50vw, 240px"
          className="w-4/5 h-4/5 object-contain transition-transform duration-500 group-hover:scale-110"
          iconClassName="size-12"
        />

        {discountPct != null &&
          (badgeVariant === "increase" ? discountPct < 0 : discountPct > 0) && (
            <div
              className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold tracking-tight ${
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

        {stores.length > 0 && (
          <div className="absolute top-3 right-3 flex gap-1">
            {stores.map((store) => {
              const storeInfo = STORE_LOGOS[store];
              if (!storeInfo) return null;
              const { label, logoUrl } = storeInfo;
              return (
                <div
                  key={store}
                  className="w-7 h-7 rounded-full bg-card shadow-sm border border-border/20 flex items-center justify-center p-1"
                  title={label}
                >
                  <Image
                    src={logoUrl}
                    alt={label}
                    width={20}
                    height={20}
                    className="w-full h-full object-contain"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grow">
        {/* Brand left, size right — brand truncates so the size stays pinned
            to the edge on narrow cards instead of pushing out of the card. */}
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

      <div className="mt-auto flex items-end justify-between">
        <div>
          {oldPrice != null && (
            <p
              className={`text-xs text-accent-foreground mb-0.5 ${
                isIncrease ? "" : "line-through"
              }`}
            >
              {formatEurAmount(oldPrice)} {currency}
            </p>
          )}
          <div className="flex items-center gap-1">
            <p className="text-2xl font-bold text-foreground">
              {formatEurAmount(price)} {currency}
            </p>
            {priceDir === "up" && (
              <ArrowUp className="size-4 text-red-500" strokeWidth={3} aria-label="Cena narasla" />
            )}
            {priceDir === "down" && (
              <ArrowDown className="size-4 text-green-600" strokeWidth={3} aria-label="Cena padla" />
            )}
            {cardDiscount && <CardDiscountMark />}
          </div>
          {pricePerUnit && (
            <p
              className="text-[11px] text-muted-foreground font-semibold mt-0.5"
              aria-label={pricePerUnitAria}
            >
              {pricePerUnit}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={added}
          aria-label={added ? "Dodano v košarico" : "Dodaj v košarico"}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200 ${
            added
              ? "bg-primary text-primary-foreground animate-button-pop cursor-default"
              : "bg-primary-foreground text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer"
          }`}
        >
          {added ? <Check className="size-5" strokeWidth={3} /> : <Plus className="size-5" />}
        </button>
      </div>
    </Link>
  );
}
