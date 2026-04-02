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
      <header className="relative bg-sidebar px-6 h-[60px] flex items-center justify-between border-b border-border/20">
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
        <Link href="/basket" className="text-muted-foreground">
          <Image src="/Icon.svg" alt="Košarica" width={20} height={20} />
        </Link>
      </header>
      <main className="flex-1 bg-background">{children}</main>
    </div>
  );
}
