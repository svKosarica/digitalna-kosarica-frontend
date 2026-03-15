import { MobileMenu } from "@/components/shared/MobileMenu";
import { NavLinks } from "@/components/shared/NavLinks";
import { SearchBar } from "@/components/shared/SearchBar";
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
          <SearchBar />

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
      <main className="flex-1 bg-background">{children}</main>
    </div>
  );
}
