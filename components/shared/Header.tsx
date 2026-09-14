"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleStar, TrendingDown } from "lucide-react";
import { CartPopover } from "@/components/shared/CartPopover";
import { SearchBar } from "@/components/shared/SearchBar";
import { cn } from "@/lib/utils";

// p-2 around a 20px icon gives a 36px hit area without visually bulking the
// row, so the gap between icons stays small.
const ICON_LINK =
  "inline-flex items-center justify-center p-2 rounded-full transition-colors active:scale-95";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-sidebar px-4 sm:px-6 lg:px-20 h-[60px] flex items-center justify-between border-b border-border/20">
      <Link href="/" className="flex items-center shrink-0">
        <Image
          src="/images/logo_kosarica.png"
          alt="Digitalna Košarica"
          width={36}
          height={36}
          className="sm:hidden"
        />
        <span className="hidden sm:inline text-primary font-black text-xl">
          Digitalna Košarica
        </span>
      </Link>

      {/* min-w-0 lets the search field shrink below its content width instead of
          pushing the icons off-screen on narrow phones. */}
      <div className="flex-1 min-w-0 flex justify-center sm:justify-end px-2 sm:px-4">
        <SearchBar />
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
        <Link
          href="/top-discounts"
          aria-label="Najvišji popusti"
          title="Najvišji popusti"
          aria-current={pathname === "/top-discounts" ? "page" : undefined}
          className={cn(
            ICON_LINK,
            pathname === "/top-discounts"
              ? "text-green-600 bg-green-600/10"
              : "text-green-600/70 hover:text-green-600",
          )}
        >
          <TrendingDown className="size-5" />
        </Link>

        <Link
          href="/popular"
          aria-label="Najbolj priljubljeni"
          title="Najbolj priljubljeni"
          aria-current={pathname === "/popular" ? "page" : undefined}
          className={cn(
            ICON_LINK,
            pathname === "/popular"
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-primary",
          )}
        >
          <CircleStar className="size-5" />
        </Link>

        {/* Opens a peek at the cart rather than navigating; "Poglej košarico"
            inside it is the way to /basket. The chrome is passed down so this
            button keeps matching the two nav icons beside it. */}
        <CartPopover
          className={cn(
            ICON_LINK,
            pathname === "/basket"
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-primary",
          )}
        />
      </div>
    </header>
  );
}
