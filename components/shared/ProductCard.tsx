"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, ImageIcon, Plus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { STORE_LOGOS, type StoreName } from "@/lib/store";
import { useCart } from "@/lib/cart";

interface ProductCardProps {
  id: number;
  imageUrl: string;
  imageAlt?: string;
  brandName: string;
  productName: string;
  price: string;
  oldPrice?: string;
  discountPct?: number;
  currency?: string;
  stores?: StoreName[];
  badgeVariant?: "discount" | "increase";
}

export default function ProductCard({
  id,
  imageUrl,
  imageAlt = "Product image",
  brandName,
  productName,
  price,
  oldPrice,
  discountPct,
  currency = "€",
  stores = [],
  badgeVariant = "discount",
}: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const [added, setAdded] = useState(false);
  const hasImage = !!imageUrl && !imgError;
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
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <Link href={`/product/${id}`} className="group w-64 h-[380px] bg-card rounded-xl p-5 transition-all duration-300 hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.06)] flex flex-col">
      <div className="relative aspect-square mb-4 bg-card rounded-lg flex items-center justify-center overflow-hidden border border-border/10">
        {hasImage ? (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            className="w-4/5 h-4/5 object-contain transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 640px) 50vw, 240px"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImageIcon className="size-12 text-border" />
        )}

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
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
          {brandName}
        </p>

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
          {oldPrice && (
            <p
              className={`text-xs text-accent-foreground mb-0.5 ${
                isIncrease ? "" : "line-through"
              }`}
            >
              {oldPrice} {currency}
            </p>
          )}
          <div className="flex items-center gap-1">
            <p className="text-2xl font-bold text-foreground">
              {price} {currency}
            </p>
            {priceDir === "up" && (
              <ArrowUp className="size-4 text-red-500" strokeWidth={3} aria-label="Cena narasla" />
            )}
            {priceDir === "down" && (
              <ArrowDown className="size-4 text-green-600" strokeWidth={3} aria-label="Cena padla" />
            )}
          </div>
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
