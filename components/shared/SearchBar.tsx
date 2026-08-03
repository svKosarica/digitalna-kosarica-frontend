"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pathname !== "/search") {
      setQuery("");
    }
  }, [pathname]);

  useEffect(() => {
    function onFocusSearch() {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      // Remove, force reflow, re-add to reliably restart the animation
      el.classList.remove("animate-search-pop");
      void el.offsetWidth;
      el.classList.add("animate-search-pop");
    }
    window.addEventListener("focus-search", onFocusSearch);
    return () => window.removeEventListener("focus-search", onFocusSearch);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    // max-w rather than a fixed w so the field narrows on very small screens
    // instead of forcing the header icons out of view.
    <div className="relative w-full max-w-48 sm:max-w-64 md:max-w-80">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none"
      />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Kaj iščeš?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onAnimationEnd={(e) => e.currentTarget.classList.remove("animate-search-pop")}
        className="pl-9 bg-white dark:bg-white border-2 border-primary/30 rounded-full shadow-sm text-base placeholder:text-muted-foreground/50 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
      />
    </div>
  );
}
