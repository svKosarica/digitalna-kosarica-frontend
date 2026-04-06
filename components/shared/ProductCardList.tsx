"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { type StoreName, STORE_LOGOS } from "@/components/shared/ProductCard";

interface ProductCardListProps {
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
  const hasImage = !!imageUrl && !imgError;

  return (
    <article className="group bg-card rounded-xl p-4 shadow-[0_4px_20px_rgba(62,39,35,0.08)] flex items-center gap-6 hover:ring-1 hover:ring-primary/40 transition-all">
      <div className="relative w-28 h-28 shrink-0 bg-card rounded-lg flex items-center justify-center overflow-visible">
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
      </div>

      <div className="grow min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
          {brandName}
        </span>
        <h4 className="text-xl font-extrabold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
          {productName}
        </h4>
      </div>

      <div className="flex flex-col items-end gap-3 shrink-0 min-w-[180px]">
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
                const { label, logoUrl } = STORE_LOGOS[store];
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
            className="bg-primary text-primary-foreground py-2 px-5 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all active:scale-95 cursor-pointer"
          >
            Add to List
          </button>
        </div>
      </div>
    </article>
  );
}
