"use client";

import { CreditCard } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Tooltip text, badge text, and aria-label on the mark itself. */
export const CARD_DISCOUNT_LABEL = "Cena s kartico ugodnosti";

/** Chart tooltip line. Shorter: the tooltip already says "Cena" above it. */
export const CARD_DISCOUNT_CHART_NOTE = "S kartico ugodnosti";

/** Basket summary note under the grand total. */
export const CARD_DISCOUNT_TOTAL_NOTE =
  "Seštevek vključuje cene s kartico ugodnosti.";

interface CardDiscountMarkProps {
  /**
   * "icon" is a bare card glyph with a tooltip, for the price rows on cards,
   * list rows and basket lines, where there is no room for a label. "badge"
   * is the labelled pill the detail page shows beside the availability chip.
   */
  variant?: "icon" | "badge";
  /** Tailwind size for the glyph in the "icon" variant. Defaults to size-4. */
  iconClassName?: string;
  className?: string;
}

/**
 * Marks a price as conditional on the store's loyalty card.
 *
 * Renders nothing on its own account — callers guard on the listing's
 * `cardDiscount`, because a "no loyalty card needed" marker would be noise on
 * the majority of rows.
 */
export function CardDiscountMark({
  variant = "icon",
  iconClassName,
  className,
}: CardDiscountMarkProps) {
  if (variant === "badge") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-secondary text-foreground",
          className,
        )}
      >
        <CreditCard className="size-3.5 shrink-0" aria-hidden="true" />
        {CARD_DISCOUNT_LABEL}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A span, not a button: this renders inside the card's <Link>, and a
            span never swallows the navigation, so no call site needs a
            preventDefault. tabIndex keeps it reachable by keyboard, which is
            the only way besides hover to open a Radix tooltip. */}
        <span
          role="img"
          tabIndex={0}
          aria-label={CARD_DISCOUNT_LABEL}
          className={cn("inline-flex text-primary cursor-help", className)}
        >
          <CreditCard
            className={cn("size-4", iconClassName)}
            aria-hidden="true"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{CARD_DISCOUNT_LABEL}</TooltipContent>
    </Tooltip>
  );
}
