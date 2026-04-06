"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart";

interface AddToCartButtonProps {
  item: Omit<CartItem, "quantity">;
  className?: string;
}

export function AddToCartButton({ item, className }: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleClick() {
    addItem(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 300);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-primary text-primary-foreground px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-xs sm:text-sm whitespace-nowrap hover:bg-primary/90 transition-all duration-200 cursor-pointer ${
        added ? "scale-110" : "active:scale-95"
      } ${className ?? ""}`}
    >
      <Plus className="size-3.5 sm:size-4" />
      <span className="hidden sm:inline">Dodaj v Košarico</span>
      <span className="sm:hidden">V Košarico</span>
    </button>
  );
}
