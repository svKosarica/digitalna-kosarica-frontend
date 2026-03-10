"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBasket } from "lucide-react";

const links = [
  { href: "/", label: "Domov" },
  { href: "/about", label: "O Nas" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-6">
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="relative flex flex-col items-center gap-0.5 text-base text-foreground"
          >
            <span className={active ? "font-semibold" : "font-normal"}>
              {label}
            </span>
            {active && (
              <span className="absolute -bottom-1.5 left-0 w-full h-[3px] rounded-lg bg-foreground" />
            )}
          </Link>
        );
      })}
      <Link href="/basket" className="text-foreground">
        <ShoppingBasket size={22} />
      </Link>
    </div>
  );
}
