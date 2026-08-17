"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { ProductImage } from "@/components/shared/ProductImage";
import { CardDiscountMark } from "@/components/shared/CardDiscountMark";
import { type CartItem } from "@/lib/cart";
import { formatEurAmount } from "@/lib/format";
import { STORE_LOGOS } from "@/lib/store";

interface BasketItemCardProps {
  item: CartItem;
  onUpdateQuantity: (id: number, qty: number) => void;
  onRemove: (id: number) => void;
}

export function BasketItemCard({
  item,
  onUpdateQuantity,
  onRemove,
}: BasketItemCardProps) {
  const storeLogo = STORE_LOGOS[item.storeName];
  const lineTotal = item.price * item.quantity;

  return (
    <div className="bg-card rounded-xl p-3 sm:p-4 border border-border/10 transition-all hover:border-border/30">
      <div className="flex gap-3 sm:gap-5">
        {/* Image */}
        <Link
          href={`/product/${item.id}`}
          className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-secondary/40 rounded-lg flex items-center justify-center overflow-visible"
        >
          <ProductImage
            src={item.imageUrl}
            alt={item.productName}
            sizes="80px"
            className="object-contain p-1.5 sm:p-2"
            iconClassName="size-6 sm:size-8"
          />
          {item.discountPct != null && item.discountPct > 0 && (
            <div className="absolute -top-1.5 -left-1.5 z-10 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold leading-none">
              -{item.discountPct}%
            </div>
          )}
          {storeLogo && (
            <div className="absolute -bottom-1 -right-1 z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-card border border-border/20 flex items-center justify-center overflow-hidden shadow-sm">
              <Image
                src={storeLogo.logoUrl}
                alt={storeLogo.label}
                width={16}
                height={16}
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </Link>

        {/* Info + Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center grow min-w-0 gap-2 sm:gap-4">
          {/* Title block */}
          <div className="grow min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
              {item.brandName}
            </span>
            <Link href={`/product/${item.id}`}>
              <h4 className="text-sm sm:text-base font-extrabold text-foreground leading-tight truncate hover:text-primary transition-colors">
                {item.productName}
              </h4>
            </Link>
            {item.size && (
              <span className="block text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                {item.size}
              </span>
            )}
          </div>

          {/* Price + Quantity */}
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 shrink-0">
            {/* Price */}
            <div className="flex items-baseline gap-1.5 sm:flex-col sm:items-end sm:gap-0">
              <span className="flex items-center gap-1.5 text-base sm:text-lg font-bold text-foreground whitespace-nowrap">
                {formatEurAmount(lineTotal)} &euro;
                {item.cardDiscount && (
                  <CardDiscountMark iconClassName="size-3.5" />
                )}
              </span>
              {item.quantity > 1 && (
                <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                  {/* "/ izdelek", not "/ kos": this is the per-cart-item price,
                      not the API's price-per-piece now shown beside it. */}
                  {formatEurAmount(item.price)} &euro; / izdelek
                </span>
              )}
            </div>

            {/* Quantity stepper */}
            <div className="flex items-center bg-secondary rounded-full">
              <button
                type="button"
                onClick={() =>
                  item.quantity <= 1
                    ? onRemove(item.id)
                    : onUpdateQuantity(item.id, item.quantity - 1)
                }
                className="p-1.5 sm:p-2 hover:text-primary transition-colors cursor-pointer"
              >
                <Minus className="size-3.5 sm:size-4" />
              </button>
              <span className="min-w-[24px] sm:min-w-[28px] text-center font-bold text-foreground text-xs sm:text-sm">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                className="p-1.5 sm:p-2 hover:text-primary transition-colors cursor-pointer"
              >
                <Plus className="size-3.5 sm:size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
