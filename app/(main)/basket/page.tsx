"use client";

import { useMemo } from "react";
import Image from "next/image";
import { ShoppingCart, Trash2, Download } from "lucide-react";
import { useCart } from "@/lib/cart";
import { STORE_LOGOS, type StoreName } from "@/lib/store";
import { BasketItemCard } from "@/components/shared/BasketItemCard";

function exportCSV(items: { productName: string; storeName: string; price: number; quantity: number }[]) {
  const header = "Izdelek,Trgovina,Cena,Količina,Skupaj";
  const rows = items.map(
    (i) => `"${i.productName}","${i.storeName}",${i.price.toFixed(2)},${i.quantity},${(i.price * i.quantity).toFixed(2)}`,
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kosarca.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function BasketPage() {
  const { items, updateQuantity, removeItem, clearCart } = useCart();

  const storeTotals = useMemo(() => {
    const map = new Map<StoreName, number>();
    for (const item of items) {
      map.set(item.storeName, (map.get(item.storeName) ?? 0) + item.price * item.quantity);
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => a.total - b.total);
  }, [items]);

  const grandTotal = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items],
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 gap-4 text-center">
        <ShoppingCart className="size-16 text-muted-foreground" strokeWidth={1.5} />
        <h1 className="text-2xl font-bold text-foreground">Košarica je prazna</h1>
        <p className="text-muted-foreground max-w-sm">
          Vaša košarica je trenutno prazna. Poiščite izdelke in jih dodajte.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-1">
            Moja Košarica
          </h1>
          <p className="text-muted-foreground text-lg">
            Primerjajte cene v realnem času med vašimi lokalnimi trgovinami.
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={clearCart}
            className="flex flex-1 md:flex-none items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl border border-border/30 bg-secondary text-foreground font-semibold text-xs sm:text-sm hover:bg-border/20 transition-colors cursor-pointer"
          >
            <Trash2 className="size-4" />
            <span className="hidden sm:inline">Izprazni košarico</span>
            <span className="sm:hidden">Izprazni</span>
          </button>
          <button
            type="button"
            onClick={() =>
              exportCSV(
                items.map((i) => ({
                  productName: i.productName,
                  storeName: STORE_LOGOS[i.storeName]?.label ?? i.storeName,
                  price: i.price,
                  quantity: i.quantity,
                })),
              )
            }
            className="flex flex-1 md:flex-none items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs sm:text-sm hover:bg-primary/90 transition-all active:scale-95 cursor-pointer"
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Izvozi seznam</span>
            <span className="sm:hidden">Izvozi</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="order-1 lg:order-2 lg:col-span-4">
          <div className="bg-secondary rounded-2xl p-4 sm:p-8 lg:sticky lg:top-20">
            <h2 className="text-xl font-bold text-foreground mb-6">
              Skupna cena po trgovinah
            </h2>
            <div className="space-y-4">
              {storeTotals.map(({ name, total }) => {
                const logo = STORE_LOGOS[name];
                return (
                  <div
                    key={name}
                    className="flex items-center justify-between p-4 rounded-xl bg-card shadow-sm border border-transparent"
                  >
                    <div className="flex items-center gap-3">
                      {logo && (
                        <div className="w-10 h-10 rounded-full bg-card border border-border/20 flex items-center justify-center p-1 overflow-hidden">
                          <Image
                            src={logo.logoUrl}
                            alt={logo.label}
                            width={28}
                            height={28}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <span className="font-bold text-foreground">{logo?.label ?? name}</span>
                    </div>
                    <span className="text-xl font-extrabold text-foreground">
                      {total.toFixed(2)} &euro;
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-border/30 flex items-center justify-between">
              <span className="text-foreground font-semibold">Skupaj</span>
              <span className="text-2xl font-extrabold text-primary">
                {grandTotal.toFixed(2)} &euro;
              </span>
            </div>
          </div>
        </div>

        <div className="order-2 lg:order-1 lg:col-span-8 space-y-3 sm:space-y-4">
          {items.map((item) => (
            <BasketItemCard
              key={`${item.id}-${item.storeName}`}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
