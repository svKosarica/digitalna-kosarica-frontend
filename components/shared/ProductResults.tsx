import ProductCard from "@/components/shared/ProductCard";
import ProductCardList from "@/components/shared/ProductCardList";
import { normalizeStoreName } from "@/lib/utils";
import type { DiscountItem } from "@/types/product.types";

interface ProductResultsProps {
  items: DiscountItem[];
}

/**
 * Shared card props for both layouts.
 *
 * Unlike the search page this passes discountPct straight through and picks the
 * badge variant per item, so a list mixing cheaper and pricier products (which
 * most-popular returns when onlyDiscounted is off) renders "-X%" in primary and
 * "+X%" in destructive side by side.
 */
function cardProps(item: DiscountItem) {
  const storeName = item.store?.name
    ? normalizeStoreName(item.store.name)
    : undefined;

  return {
    id: item.id,
    imageUrl: item.product?.imageUrl ?? "",
    brandName: item.product?.brand?.name ?? "",
    productName: item.product?.title ?? item.product?.name ?? "",
    price: item.price?.toFixed(2) ?? "0.00",
    oldPrice:
      item.oldPrice != null && item.oldPrice !== item.price
        ? item.oldPrice.toFixed(2)
        : undefined,
    discountPct: item.discountPct ?? undefined,
    badgeVariant: (item.discountPct != null && item.discountPct < 0
      ? "increase"
      : "discount") as "increase" | "discount",
    stores: storeName ? [storeName] : [],
  };
}

/**
 * Results for the filtered listing pages: dense rows on phones, card grid from
 * sm up — the same split /search settles on, but decided in CSS rather than via
 * a URL param, so there is no first-paint flash and no extra server round trip.
 *
 * Both layouts are rendered and one is hidden. Card images are lazy by default,
 * so the hidden half costs DOM but no image requests.
 */
export function ProductResults({ items }: ProductResultsProps) {
  return (
    <>
      <div className="space-y-4 sm:hidden">
        {items.map((item) => (
          <ProductCardList key={item.id} {...cardProps(item)} />
        ))}
      </div>

      <div className="hidden sm:grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 justify-items-center">
        {items.map((item) => (
          <ProductCard key={item.id} {...cardProps(item)} />
        ))}
      </div>
    </>
  );
}
