"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { type StoreName, STORE_LOGOS } from "@/lib/store";
import { useCart } from "@/lib/cart";

interface ProductCardListProps {
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
}

export default function ProductCardList({
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
}: ProductCardListProps) {
  const [imgError, setImgError] = useState(false);
  const [added, setAdded] = useState(false);
  const hasImage = !!imageUrl && !imgError;
  const { addItem } = useCart();

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
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
    setTimeout(() => setAdded(false), 300);
  }

  return (
    <Link href={`/product/${id}`} className="group block bg-card rounded-xl p-4 shadow-[0_4px_20px_rgba(62,39,35,0.08)] hover:ring-1 hover:ring-primary/40 transition-all">
    <div className="flex items-center gap-4 sm:gap-6">
      <div className="relative w-20 h-20 sm:w-28 sm:h-28 shrink-0 bg-card rounded-lg flex items-center justify-center overflow-visible">
        {hasImage ? (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
            sizes="112px"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImageIcon className="size-10 text-border" />
        )}

        {discountPct != null && discountPct > 0 && (
          <div className="absolute -top-1 -left-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold tracking-tight">
            -{discountPct}%
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
          <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
            {brandName}
          </span>
          <h4 className="text-base sm:text-xl font-extrabold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
            {productName}
          </h4>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:hidden">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-foreground">
              {price} {currency}
            </span>
            {oldPrice && (
              <span className="text-xs font-semibold text-accent-foreground line-through">
                {oldPrice} {currency}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleAddToCart}
            className={`bg-primary text-primary-foreground py-1.5 px-3 rounded-xl font-bold text-xs hover:bg-primary/90 transition-all duration-200 cursor-pointer ${
              added ? "scale-110" : "active:scale-95"
            }`}
          >
            V Košarico
          </button>
        </div>
      </div>

      <div className="hidden sm:flex flex-col items-end gap-3 shrink-0 min-w-[180px]">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground">
            {price} {currency}
          </span>
          {oldPrice && (
            <span className="text-sm font-semibold text-accent-foreground line-through">
              {oldPrice} {currency}
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
            className={`bg-primary text-primary-foreground py-2 px-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all duration-200 cursor-pointer ${
              added ? "scale-110" : "active:scale-95"
            }`}
          >
            V Košarico
          </button>
        </div>
      </div>
    </div>
    </Link>
  );
}
