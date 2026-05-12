"use client";

import { ArrowRight } from "lucide-react";

export function HeroFocusButton() {
  function handleClick() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Small delay so the scroll starts before focus fires
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("focus-search"));
    }, 300);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="bg-primary text-primary-foreground px-6 py-3 md:px-8 md:py-4 rounded-lg font-semibold tracking-wide shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer text-sm md:text-base"
    >
      Primerjaj cene
      <ArrowRight className="size-5" />
    </button>
  );
}
