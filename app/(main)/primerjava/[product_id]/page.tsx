import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { getProductComparison } from "@/actions/comparison.actions";
import { BackButton } from "@/components/shared/BackButton";
import { MultiStorePriceChart } from "@/components/shared/MultiStorePriceChart";
import { ProductImage } from "@/components/shared/ProductImage";
import { StoreListingRow } from "@/components/shared/StoreListingRow";
import { StoreLogos } from "@/components/shared/StoreLogos";
import { derivePricePerUnit, STOCK_CHEAPEST_OUT } from "@/lib/comparison";
import {
  formatEurAmount,
  formatPricePerUnit,
  formatSize,
  pricePerUnitAriaLabel,
} from "@/lib/format";
import { STORE_LOGOS } from "@/lib/store";
import { storeCountLabel } from "@/lib/utils";
import { STORE_MAP } from "@/types/search.types";

/** Requested at the maximum: the chart filters shorter windows client-side. */
const HISTORY_DAYS = 365;

// Module-local for the same reason as PAGE_TITLE on the list page: a page
// module's export surface is validated by Next.
const SINGLE_STORE_NOTE = "Ta izdelek trenutno prodaja samo ena trgovina.";

interface Props {
  params: Promise<{ product_id: string }>;
}

/**
 * One article and what every store charges for it.
 *
 * `product_id` here is a product.id, NOT a storeProductId — a different
 * identity space from /product/[product_id]. Both are bare integers, so a
 * mix-up renders a plausible page about the wrong article.
 */
export default async function ProductComparisonPage({ params }: Props) {
  const { product_id } = await params;

  let data;
  try {
    data = await getProductComparison(product_id, HISTORY_DAYS);
  } catch {
    // 404 means no such product, or every listing behind it has been dropped
    // from its store's feed. Both are "gone" as far as the UI is concerned.
    notFound();
  }

  const {
    product,
    storeCount,
    storeIds,
    minPrice,
    maxPrice,
    savings,
    baseUnit,
    totalQuantity,
    listings,
  } = data;

  const stores = storeIds
    .map((id) => STORE_MAP[id])
    .filter((name): name is NonNullable<typeof name> => Boolean(name));

  const size = formatSize(totalQuantity, baseUnit);

  // Derived from minPrice, and prefixed "od" for that reason. The per-row
  // figures below are each store's own scraped value, which is why these two
  // numbers can differ by a cent — see derivePricePerUnit.
  const derived = derivePricePerUnit(minPrice, totalQuantity, baseUnit);
  const perUnit = formatPricePerUnit(derived, baseUnit);
  const perUnitAria = pricePerUnitAriaLabel(derived, baseUnit);

  // STORE_MAP gives the internal key ("lidl"); STORE_LOGOS gives the display
  // label ("Lidl"). Rendering the key would put lowercase store names on screen.
  const cheapestStoreName = STORE_MAP[data.cheapestStoreId];
  const cheapestLabel = cheapestStoreName
    ? STORE_LOGOS[cheapestStoreName].label
    : undefined;

  // listings is cheapest-first, so listings[0] is the listing minPrice came from.
  const cheapestUnavailable = listings.length > 0 && !listings[0].isAvailable;

  // Suppressed when every store charges the same — "prihranite do 0,00 €" is noise —
  // AND when the cheapest listing is unbuyable. The list card already hides its savings
  // badge in that case; a hero that still promised the saving would contradict the very
  // card the shopper clicked to get here. The price RANGE stays either way: it is a
  // factual statement about published prices. Only the actionable claim goes.
  const hasSpread = savings > 0;
  const canClaimSavings = hasSpread && !cheapestUnavailable;

  const productName = product.title || product.name;

  return (
    <div className="py-6 sm:py-8 space-y-6 sm:space-y-10">
      <div className="px-4 sm:px-6 lg:px-20 space-y-6 sm:space-y-10">
        <BackButton />

        <section className="flex flex-col md:flex-row gap-6 md:gap-12">
          <div className="relative w-full max-h-[240px] sm:max-h-none md:w-[420px] aspect-square shrink-0 bg-card rounded-2xl flex items-center justify-center border border-border/10 mx-auto md:mx-0">
            <ProductImage
              src={product.imageUrl}
              alt={productName}
              sizes="(max-width: 768px) 240px, 420px"
              className="object-contain p-6 sm:p-8"
              iconClassName="size-14 sm:size-20"
              priority
            />

            {/* The cluster replaces the single logo /product's hero shows —
                that is the whole point of this page. */}
            <StoreLogos
              stores={stores}
              max={5}
              size="lg"
              overlap
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10"
            />
          </div>

          {/* No add-to-cart and no open-in-store here: a page-level button would
              have to silently pick a store. Both live per-row below. */}
          <div className="flex flex-col justify-center gap-3 sm:gap-4">
            <div>
              {product.brand?.name && (
                <p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 sm:mb-2">
                  {product.brand.name}
                </p>
              )}
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground leading-tight break-words">
                {productName}
              </h1>
              {size && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                  Pakiranje:{" "}
                  <span className="font-semibold text-foreground">{size}</span>
                </p>
              )}
            </div>

            <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
              <span className="text-2xl sm:text-3xl font-extrabold text-primary">
                <span className="text-base font-semibold text-muted-foreground mr-1.5">
                  od
                </span>
                {formatEurAmount(minPrice)} &euro;
              </span>
              {cheapestLabel && (
                <span className="text-sm text-muted-foreground">
                  najceneje v{" "}
                  <span className="font-semibold text-foreground">
                    {cheapestLabel}
                  </span>
                </span>
              )}
            </div>

            {hasSpread && (
              <p className="text-xs sm:text-sm text-muted-foreground">
                {storeCountLabel(storeCount)} · {formatEurAmount(minPrice)}–
                {formatEurAmount(maxPrice)} &euro;
                {canClaimSavings && (
                  <>
                    {" "}
                    · prihranite do{" "}
                    <span className="font-semibold text-foreground">
                      {formatEurAmount(savings)} &euro;
                    </span>
                  </>
                )}
              </p>
            )}

            {cheapestUnavailable && (
              <p className="flex items-start gap-2 text-xs sm:text-sm text-accent-foreground">
                <Info className="size-4 shrink-0 mt-0.5" aria-hidden />
                {/* The same words the list card uses, imported rather than retyped so
                    the two surfaces cannot drift apart. */}
                Najcenejša ponudba: {STOCK_CHEAPEST_OUT}.
              </p>
            )}

            {perUnit && (
              <p
                className="text-xs sm:text-sm text-muted-foreground"
                aria-label={perUnitAria ?? undefined}
              >
                Cena na enoto:{" "}
                <span className="font-semibold text-foreground">od {perUnit}</span>
              </p>
            )}

            {/* Reachable via the cross-link on /product/[id], so it has to look
                deliberate rather than like a broken comparison. */}
            {storeCount === 1 && (
              <p className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground bg-secondary rounded-xl px-3 py-2">
                <Info className="size-4 shrink-0 mt-0.5" aria-hidden />
                {SINGLE_STORE_NOTE}
              </p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Zgodovina cen</h2>
          <MultiStorePriceChart listings={listings} />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Cene po trgovinah</h2>
          {/* API order — cheapest first — and one row per LISTING, so a store
              that lists the article twice appears twice, at both prices.
              storeProductId is the key: store.id is NOT unique here. */}
          <div className="space-y-4">
            {listings.map((listing, index) => (
              <StoreListingRow
                key={listing.storeProductId}
                listing={listing}
                // listings[0] only: one winner, even when a later row ties.
                isCheapest={index === 0 && listings.length > 1}
                productName={productName}
                brandName={product.brand?.name ?? ""}
                size={size ?? undefined}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
