"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Home, Info, Menu, ShoppingBasket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Domov", icon: Home },
  { href: "/about", label: "O Nas", icon: Info },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="text-foreground p-1">
          <Menu size={24} />
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-72 p-0 flex flex-col bg-background">
        {/* Header */}
        <SheetHeader className="bg-primary px-6 py-5">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo_kosarica.png"
              alt="Digitalna Košarica"
              width={32}
              height={32}
            />
            <SheetTitle className="text-foreground text-base font-bold">
              Digitalna Košarica
            </SheetTitle>
          </div>
        </SheetHeader>

        {/* Nav links */}
        <nav className="flex flex-col flex-1 px-4 py-6 gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base transition-colors ${
                  active
                    ? "bg-primary font-semibold text-foreground"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer — basket */}
        <div className="px-4 pb-6 border-t border-border pt-4">
          <Link
            href="/basket"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base transition-colors ${
              pathname === "/basket"
                ? "bg-primary font-semibold text-foreground"
                : "text-foreground/70 hover:bg-muted hover:text-foreground"
            }`}
          >
            <ShoppingBasket size={18} />
            Košarica
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
