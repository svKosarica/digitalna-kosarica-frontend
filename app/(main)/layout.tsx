import { Suspense } from "react";
import { CartProvider } from "@/lib/cart";
import { Header } from "@/components/shared/Header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col">
        <Suspense>
          <Header />
        </Suspense>
        <main className="flex-1 bg-background">{children}</main>

        <footer className="bg-sidebar py-8 px-6 border-t border-border/20">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
            <div className="mb-4 md:mb-0">
              <p className="font-bold text-foreground text-base mb-1">
                Digitalna Košarica
              </p>
              <p className="text-xs uppercase tracking-wider">
                &copy; {new Date().getFullYear()} Digitalna Košarica. Vse
                pravice pridržane.
              </p>
            </div>
            <div className="flex space-x-6 text-xs uppercase tracking-wider font-semibold">
              <a href="#" className="hover:text-primary transition-colors">
                Kontakt
              </a>
            </div>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
