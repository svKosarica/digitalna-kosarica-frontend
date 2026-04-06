"use client";

import Image from "next/image";
import Link from "next/link";
import { SearchBar } from "@/components/shared/SearchBar";
import { useCart } from "@/lib/cart";

export function Header() {
  const { totalItems } = useCart();

  return (
    <header className="relative bg-sidebar px-4 sm:px-6 h-[60px] flex items-center justify-between border-b border-border/20">
      <Link href="/" className="flex items-center">
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

      <div className="flex-1 flex justify-center sm:justify-end px-4">
        <SearchBar />
      </div>

      <Link href="/basket" className="relative text-muted-foreground">
        <Image src="/Icon.svg" alt="Košarica" width={20} height={20} />
        {totalItems > 0 && (
          <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
            {totalItems > 99 ? "99+" : totalItems}
          </span>
        )}
      </Link>
    </header>
  );
}
