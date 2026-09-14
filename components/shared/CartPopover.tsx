"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ProductImage } from "@/components/shared/ProductImage";
import { useCart, type CartItem } from "@/lib/cart";
import { formatEurAmount } from "@/lib/format";
import { STORE_LOGOS } from "@/lib/store";
import { cn } from "@/lib/utils";

interface CartPopoverProps {
  /**
   * Trigger chrome. Owned by the Header rather than set here so the basket
   * button keeps matching the nav icons beside it, including their active state.
   */
  className?: string;
}

/**
 * The header basket: a peek at the cart instead of a jump to /basket.
 *
 * Quantity edits write straight to the cart context, so this and the basket
 * page stay in step without either knowing the other exists.
 */
export function CartPopover({ className }: CartPopoverProps) {
  const { items, totalItems, lastAddedAt, updateQuantity } = useCart();
  const [open, setOpen] = useState(false);

  // A plain expression, not a useMemo: one pass over a hand-sized cart costs
  // less than the bookkeeping a memo would add.
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Košarica"
          title="Košarica"
          className={className}
        >
          {/* key remounts on each add so the bump animation replays; the class
              is only applied after the first add (lastAddedAt > 0). relative
              lives here rather than on the button so the badge pins to the icon
              and not to the padded hit area. */}
          <span
            key={lastAddedAt}
            className={cn(
              "relative inline-block",
              lastAddedAt > 0 && "animate-cart-bump",
            )}
          >
            <Image src="/Icon.svg" alt="" width={20} height={20} />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </span>
        </button>
      </PopoverTrigger>

      {/* p-0 so the header, list and footer can each own their padding and the
          dividers span the full width. The viewport clamp keeps the panel on
          screen on a narrow phone, where the trigger sits against the edge. */}
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(23rem,calc(100vw-2rem))] p-0 bg-card border-border/40 rounded-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/20">
          <h2 className="font-bold text-foreground">
            Košarica
            {totalItems > 0 && (
              <span className="ml-1.5 font-semibold text-muted-foreground">
                ({totalItems})
              </span>
            )}
          </h2>
          {/* Explicit close beside the usual click-outside and Escape: on a
              phone there is very little "outside" left to tap. */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Zapri košarico"
            className="p-1 -mr-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <ShoppingCart
              className="size-10 text-muted-foreground"
              strokeWidth={1.5}
            />
            <p className="text-sm text-muted-foreground">
              Vaša košarica je prazna.
            </p>
          </div>
        ) : (
          <>
            <ul className="max-h-[min(60vh,20rem)] overflow-y-auto divide-y divide-border/15">
              {items.map((item) => (
                <CartPopoverRow
                  key={`${item.id}-${item.storeName}`}
                  item={item}
                  onUpdateQuantity={updateQuantity}
                />
              ))}
            </ul>

            <div className="px-4 py-3 border-t border-border/20 space-y-3">
              {/* No per-store breakdown and no loyalty-card note here — both
                  are the basket page's job, and this panel is a glance. */}
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-foreground">
                  Skupaj
                </span>
                <span className="text-lg font-extrabold text-primary">
                  {formatEurAmount(total)} &euro;
                </span>
              </div>
              <Link
                href="/basket"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all active:scale-95"
              >
                Poglej košarico
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * One cart line, trimmed to what fits a popover: image, name, line total and
 * the stepper. Deliberately not BasketItemCard — that card carries the brand,
 * size, per-item price and discount badge the full page has room for.
 */
function CartPopoverRow({
  item,
  onUpdateQuantity,
}: {
  item: CartItem;
  onUpdateQuantity: (id: number, qty: number) => void;
}) {
  const storeLogo = STORE_LOGOS[item.storeName];
  const isLastUnit = item.quantity <= 1;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="relative w-11 h-11 shrink-0 bg-secondary/40 rounded-lg flex items-center justify-center overflow-visible">
        <ProductImage
          src={item.imageUrl}
          alt={item.productName}
          sizes="44px"
          className="object-contain p-1"
          iconClassName="size-5"
        />
        {storeLogo && (
          <div className="absolute -bottom-1 -right-1 size-4 rounded-full bg-card border border-border/20 flex items-center justify-center overflow-hidden">
            <Image
              src={storeLogo.logoUrl}
              alt={storeLogo.label}
              width={12}
              height={12}
              className="w-full h-full object-contain"
            />
          </div>
        )}
      </div>

      <div className="grow min-w-0">
        <p className="text-sm font-bold text-foreground leading-tight truncate">
          {item.productName}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatEurAmount(item.price * item.quantity)} &euro;
        </p>
      </div>

      {/* Stepping below 1 drops the line: updateQuantity treats qty <= 0 as a
          removal, which is what the basket page's stepper relies on too. The
          trash icon at one unit says so before the click. */}
      <div className="flex items-center bg-secondary rounded-full shrink-0">
        <button
          type="button"
          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
          aria-label={
            isLastUnit
              ? `Odstrani ${item.productName}`
              : `Zmanjšaj količino: ${item.productName}`
          }
          className={cn(
            "p-1.5 transition-colors cursor-pointer",
            isLastUnit ? "hover:text-destructive" : "hover:text-primary",
          )}
        >
          {isLastUnit ? (
            <Trash2 className="size-3.5" aria-hidden />
          ) : (
            <Minus className="size-3.5" aria-hidden />
          )}
        </button>
        <span className="min-w-[20px] text-center font-bold text-foreground text-xs">
          {item.quantity}
        </span>
        <button
          type="button"
          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          aria-label={`Povečaj količino: ${item.productName}`}
          className="p-1.5 hover:text-primary transition-colors cursor-pointer"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </li>
  );
}
