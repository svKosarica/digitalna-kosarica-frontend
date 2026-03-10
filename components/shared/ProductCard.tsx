// ProductCard.tsx — Next.js + Tailwind component
// All values are passed as props

import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type StoreName = "spar" | "mercator" | "hofer" | "lidl";

const STORE_LOGOS: Record<StoreName, { label: string; logoUrl: string }> = {
  spar:     { label: "Spar",     logoUrl: "/images/spar.png"     },
  mercator: { label: "Mercator", logoUrl: "/images/mercator.png" },
  hofer:    { label: "Hofer",    logoUrl: "/images/hofer.png"    },
  lidl:     { label: "Lidl",     logoUrl: "/images/lidl.png"     },
};

interface ProductCardProps {
  imageUrl: string;
  imageAlt?: string;
  brandName: string;
  productName: string;
  price: string;
  oldPrice?: string;
  currency?: string;
  stores?: StoreName[];
}

export default function ProductCard({
  imageUrl,
  imageAlt = "Product image",
  brandName,
  productName,
  price,
  oldPrice,
  currency = "€",
  stores = [],
}: ProductCardProps) {
  return (
    <div className="group relative w-64 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white">
      {/* ── Image area ───────────────────────────────────────── */}
      <div className="relative h-44 w-full bg-white overflow-hidden">
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
          sizes="208px"
        />

        {/* Store badges — top-right overlay */}
        {stores.length > 0 && (
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {stores.map((store) => {
              const { label, logoUrl } = STORE_LOGOS[store];
              return (
                <div
                  key={store}
                  className="w-8 h-8 rounded-full bg-white shadow-md overflow-hidden flex items-center justify-center border border-white"
                  title={label}
                >
                  <Image
                    src={logoUrl}
                    alt={label}
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Info area ────────────────────────────────────────── */}
      <div className="bg-primary px-4 pt-3 pb-4 flex flex-col gap-0.5">
        {/* Brand */}
        <p className="text-foreground/60 text-[11px] font-semibold uppercase tracking-widest leading-none">
          {brandName}
        </p>

        {/* Product name */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <h3 className="text-foreground text-base font-bold leading-tight truncate cursor-default">
                {productName}
              </h3>
            </TooltipTrigger>
            <TooltipContent>{productName}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Price row */}
        <div className="mt-2 flex items-end gap-2">
          <span className="text-foreground text-2xl font-extrabold leading-none tracking-tight">
            {currency}
            {price}
          </span>

          {oldPrice && (
            <span className="text-foreground/50 text-sm font-medium line-through leading-none mb-0.5">
              {currency}
              {oldPrice}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Usage example ────────────────────────────────────────────────────────────
//
// <ProductCard
//   imageUrl="/products/cheesecake-ice-cream.jpg"
//   imageAlt="American Cheesecake Ice Cream"
//   brandName="American"
//   productName="Cheesecake Ice Cream"
//   price="1.99"
//   oldPrice="2.49"
//   currency="€"
//   stores={["spar", "mercator", "hofer", "lidl"]}
// />
