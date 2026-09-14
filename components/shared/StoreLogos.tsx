import Image from "next/image";
import { STORE_LOGOS, type StoreName } from "@/lib/store";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "w-6 h-6", px: 16 },
  md: { box: "w-7 h-7", px: 20 },
  lg: { box: "w-9 h-9", px: 24 },
} as const;

interface StoreLogosProps {
  /** Resolved store names. An unknown id must be filtered out before this. */
  stores: StoreName[];
  /**
   * Logos to draw before collapsing the rest into a "+N" chip. A 256px card
   * cannot show five logos beside a price, and five overlapping circles read
   * as a smudge rather than as five stores.
   */
  max?: number;
  size?: keyof typeof SIZES;
  /** Overlapping stack (rows, detail hero) vs. a spaced row (grid cards). */
  overlap?: boolean;
  className?: string;
}

/**
 * The store-logo cluster shown wherever one article belongs to several stores.
 *
 * Deliberately not retrofitted into ProductCard/ProductCardList, which have
 * their own inline single-logo markup: those two files are frozen for this
 * feature, because leaving them untouched is what guarantees /search and
 * /popular keep linking to the single-listing page.
 */
export function StoreLogos({
  stores,
  max = 4,
  size = "md",
  overlap = false,
  className,
}: StoreLogosProps) {
  if (stores.length === 0) return null;

  const { box, px } = SIZES[size];
  const shown = stores.slice(0, max);
  const hidden = stores.length - shown.length;

  return (
    <div
      className={cn("flex items-center", overlap ? "-space-x-2" : "gap-1", className)}
      // One label for the whole cluster: five nested title attributes are
      // unreadable, and each logo already carries its store name as alt text.
      aria-label={`Na voljo v: ${stores.map((s) => STORE_LOGOS[s].label).join(", ")}`}
    >
      {shown.map((store) => {
        const { label, logoUrl } = STORE_LOGOS[store];
        return (
          <div
            key={store}
            className={cn(
              box,
              "rounded-full bg-card border border-border/20 flex items-center justify-center overflow-hidden shadow-sm shrink-0",
              overlap && "border-2 border-card",
            )}
            title={label}
          >
            <Image
              src={logoUrl}
              alt={label}
              width={px}
              height={px}
              className="w-full h-full object-contain p-0.5"
            />
          </div>
        );
      })}

      {hidden > 0 && (
        <div
          className={cn(
            box,
            "rounded-full bg-secondary border border-border/20 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0",
            overlap && "border-2 border-card",
          )}
          aria-hidden
        >
          +{hidden}
        </div>
      )}
    </div>
  );
}
