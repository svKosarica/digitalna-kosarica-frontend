import { MobileMenu } from "@/components/shared/MobileMenu";
import { NavLinks } from "@/components/shared/NavLinks";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="relative bg-primary rounded-b-lg px-6 h-[60px] flex items-center justify-between">
        {/* Logo + title */}
        <Link href="/" className="flex items-center gap-1">
          <Image
            src="/images/logo_kosarica.png"
            alt="Digitalna Košarica"
            width={36}
            height={36}
          />
          <span className="ml-1 hidden sm:inline text-base font-bold text-foreground">
            Digitalna Košarica
          </span>
        </Link>

        <div className="flex items-center gap-10">
          {/* Search — always visible, responsive width */}
          <div className="relative w-48 sm:w-64 md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 pointer-events-none" />
            <Input
              type="text"
              placeholder="Kaj iščeš?"
              className="pl-9 bg-background border-border rounded-lg text-base placeholder:text-foreground/50"
            />
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center">
            <NavLinks />
          </div>

          {/* Mobile: sheet menu */}
          <div className="md:hidden">
            <MobileMenu />
          </div>
        </div>
      </header>
      <main className="flex-1 bg-slate-50">{children}</main>
    </div>
  );
}
