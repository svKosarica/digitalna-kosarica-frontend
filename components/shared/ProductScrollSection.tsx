"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "@/components/shared/ProductCard";
import { formatPricePerUnit, formatSize, pricePerUnitAriaLabel } from "@/lib/format";
import { normalizeStoreName } from "@/lib/utils";
import type { DiscountItem } from "@/types/product.types";

interface ProductScrollSectionProps {
  title: string;
  subtitle: string;
  items: DiscountItem[];
  badgeVariant?: "discount" | "increase";
  /**
   * Full listing page for this section. Optional because not every section has
   * one — "Največje podražitve" and "Sorodni izdelki" have no destination.
   */
  moreHref?: string;
}

export default function ProductScrollSection({
  title,
  subtitle,
  items,
  badgeVariant = "discount",
  moreHref,
}: ProductScrollSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [updateScrollState, items.length]);

  function scrollByViewport(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }

  const hasItems = items.length > 0;

  // Nothing to show (e.g. endpoint not yet available or a transient API
  // outage) — hide the whole section instead of leaving a stray header.
  if (!hasItems) return null;

  return (
    // The horizontal padding lives here, on the ancestor, rather than on the
    // scroll track below: a scroll container's padding does not clip its
    // content, so cards would slide through it and touch the viewport edge.
    // Insetting the whole section makes the track narrower, so the overflow is
    // clipped at the same gutter every other page section observes.
    <section className="px-4 sm:px-6 lg:px-20">
      <div className="pt-8 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl sm:text-[30px] font-semibold text-foreground">
              {title}
            </h2>
            {/* Beside the title rather than in the arrow group, which is hidden
                below md — this stays reachable on mobile. */}
            {moreHref && (
              <Link
                href={moreHref}
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all whitespace-nowrap"
              >
                Več izdelkov
                <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
          <p className="text-[14px] font-medium text-muted-foreground uppercase tracking-wider mt-1">
            {subtitle}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => scrollByViewport(-1)}
            disabled={!canScrollLeft}
            aria-label="Pomakni levo"
            className="w-10 h-10 rounded-full bg-primary-foreground text-primary border border-border/20 flex items-center justify-center transition-all duration-200 hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByViewport(1)}
            disabled={!canScrollRight}
            aria-label="Pomakni desno"
            className="w-10 h-10 rounded-full bg-primary-foreground text-primary border border-border/20 flex items-center justify-center transition-all duration-200 hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="flex gap-4 py-6 overflow-x-auto"
      >
        {items.map((item) => (
          <div key={item.id} className="shrink-0">
            <ProductCard
              id={item.id}
              imageUrl={item.product.imageUrl}
              brandName={item.product.brand?.name ?? ""}
              productName={item.product.name}
              size={formatSize(item.totalQuantity, item.baseUnit) ?? undefined}
              pricePerUnit={
                formatPricePerUnit(item.pricePerUnit, item.baseUnit) ?? undefined
              }
              pricePerUnitAria={
                pricePerUnitAriaLabel(item.pricePerUnit, item.baseUnit) ?? undefined
              }
              price={item.price?.toString() ?? ""}
              oldPrice={item.oldPrice?.toString() ?? ""}
              discountPct={item.discountPct ?? undefined}
              badgeVariant={badgeVariant}
              cardDiscount={item.cardDiscount}
              stores={
                item.store?.name && normalizeStoreName(item.store.name)
                  ? [normalizeStoreName(item.store.name)!]
                  : []
              }
            />
          </div>
        ))}
        {/* Breathing room after the last card at the end of the scroll. */}
        <div className="shrink-0 w-4" />
      </div>
    </section>
  );
}
