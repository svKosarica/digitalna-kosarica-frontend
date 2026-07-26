"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart";

interface AddToCartButtonProps {
  item: Omit<CartItem, "quantity">;
  className?: string;
}

export function AddToCartButton({ item, className }: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleClick() {
    if (added) return;
    addItem(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={added}
      className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-primary text-primary-foreground px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-xs sm:text-sm whitespace-nowrap transition-colors duration-200 ${
        added ? "animate-button-pop cursor-default" : "hover:bg-primary/90 active:scale-95 cursor-pointer"
      } ${className ?? ""}`}
    >
      {added ? (
        <Check className="size-3.5 sm:size-4" strokeWidth={3} />
      ) : (
        <Plus className="size-3.5 sm:size-4" />
      )}
      <span className="hidden sm:inline">
        {added ? "Dodano v Košarico" : "Dodaj v Košarico"}
      </span>
      <span className="sm:hidden">{added ? "Dodano" : "V Košarico"}</span>
    </button>
  );
}
