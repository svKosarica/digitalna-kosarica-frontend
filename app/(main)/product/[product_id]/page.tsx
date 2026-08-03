import { notFound } from "next/navigation";
import Image from "next/image";
import { ImageIcon, ExternalLink } from "lucide-react";
import { getProduct, getSimilarProducts } from "@/actions/product.actions";
import { formatPricePerUnit, formatSize, pricePerUnitAriaLabel } from "@/lib/format";
import { normalizeStoreName } from "@/lib/utils";
import { STORE_LOGOS } from "@/lib/store";
import { PriceHistoryChart } from "@/components/shared/PriceHistoryChart";
import ProductScrollSection from "@/components/shared/ProductScrollSection";
import { BackButton } from "@/components/shared/BackButton";
import { AddToCartButton } from "@/components/shared/AddToCartButton";

interface Props {
  params: Promise<{ product_id: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { product_id } = await params;

  let data;
  let similar;
  try {
    [data, similar] = await Promise.all([
      getProduct(product_id),
      getSimilarProducts(product_id),
    ]);
  } catch {
    notFound();
  }

  const {
    product,
    store,
    price,
    oldPrice,
    discountPct,
    isAvailable,
    cardDiscount,
    url,
    priceHistory,
    baseUnit,
    totalQuantity,
    pricePerUnit,
  } = data;

  const storeName = store?.name ? normalizeStoreName(store.name) : null;
  const size = formatSize(totalQuantity, baseUnit);
  const perUnit = formatPricePerUnit(pricePerUnit, baseUnit);
  const perUnitAria = pricePerUnitAriaLabel(pricePerUnit, baseUnit);

  return (
    <div className="py-6 sm:py-8 space-y-6 sm:space-y-10">
      <div className="px-4 sm:px-6 lg:px-20 space-y-6 sm:space-y-10">
        <BackButton />

        <section className="flex flex-col md:flex-row gap-6 md:gap-12">
          {/* Product image */}
          <div className="relative w-full max-h-[240px] sm:max-h-none md:w-[420px] aspect-square shrink-0 bg-card rounded-2xl flex items-center justify-center border border-border/10 mx-auto md:mx-0">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.title || product.name}
                fill
                className="object-contain p-6 sm:p-8"
                sizes="(max-width: 768px) 240px, 420px"
                priority
              />
            ) : (
              <ImageIcon className="size-14 sm:size-20 text-border" />
            )}

            {discountPct != null && discountPct > 0 && (
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-bold tracking-tight">
                -{discountPct}%
              </div>
            )}

            {storeName && STORE_LOGOS[storeName] && (
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-card shadow-sm border border-border/20 flex items-center justify-center p-1 sm:p-1.5">
                <Image
                  src={STORE_LOGOS[storeName].logoUrl}
                  alt={STORE_LOGOS[storeName].label}
                  width={28}
                  height={28}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col justify-center gap-3 sm:gap-4">
            <div>
              {product.brand?.name && (
                <p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 sm:mb-2">
                  {product.brand.name}
                </p>
              )}
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground leading-tight break-words">
                {product.title || product.name}
              </h1>
              {size && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                  Pakiranje:{" "}
                  <span className="font-semibold text-foreground">{size}</span>
                </p>
              )}
            </div>

            <div className="flex items-baseline gap-2 sm:gap-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-primary">
                {price.toFixed(2)} &euro;
              </span>
              {oldPrice != null && oldPrice !== price && (
                <span className="text-base sm:text-lg font-semibold text-accent-foreground line-through">
                  {oldPrice.toFixed(2)} &euro;
                </span>
              )}
            </div>

            {perUnit && (
              <p
                className="text-xs sm:text-sm text-muted-foreground"
                aria-label={perUnitAria ?? undefined}
              >
                Cena na enoto:{" "}
                <span className="font-semibold text-foreground">{perUnit}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span
                className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold ${
                  isAvailable
                    ? "bg-primary/10 text-primary"
                    : "bg-border/30 text-muted-foreground"
                }`}
              >
                {isAvailable ? "Na zalogi" : "Ni na zalogi"}
              </span>
              {cardDiscount && (
                <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-secondary text-foreground">
                  Zvestobni popus
                </span>
              )}
            </div>

            <div className="flex gap-3 mt-2 sm:mt-4">
              {storeName && (
                <AddToCartButton
                  className="flex-1"
                  item={{
                    id: data.id ?? product.id ?? Number(product_id),
                    productName: product.title || product.name,
                    brandName: product.brand?.name ?? "",
                    imageUrl: product.imageUrl,
                    price,
                    oldPrice:
                      oldPrice != null && oldPrice !== price ? oldPrice : undefined,
                    discountPct:
                      discountPct != null && discountPct > 0 ? discountPct : undefined,
                    storeName,
                    size: size ?? undefined,
                  }}
                />
              )}
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-secondary text-foreground px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-xs sm:text-sm whitespace-nowrap hover:bg-secondary/70 transition-all active:scale-95"
                >
                  <span className="">Poglej v trgovini</span>

                  <ExternalLink className="size-3.5 sm:size-4" />
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Zgodovina cen</h2>

          {priceHistory && priceHistory.length > 0 ? (
            <PriceHistoryChart data={priceHistory} />
          ) : (
            <div className="bg-card rounded-2xl p-8 sm:p-12 border border-border/10 flex items-center justify-center">
              <p className="text-muted-foreground">
                Za ta izdelek še ni podatkov o zgodovini cen.
              </p>
            </div>
          )}
        </section>
      </div>

      <ProductScrollSection
        title="Sorodni izdelki"
        subtitle="Izdelki, ki bi vam lahko bili všeč"
        items={similar}
      />
    </div>
  );
}
