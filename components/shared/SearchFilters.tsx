"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { LayoutGrid, List } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { STORE_MAP } from "@/types/search.types";
import { cn } from "@/lib/utils";

const ALL_STORE_IDS = Object.keys(STORE_MAP).map(Number);

export function SearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filter = searchParams.get("filter") ?? "PRICE";
  const order = searchParams.get("order") ?? "DESCENDING";
  const stores = searchParams.get("stores");
  const available = searchParams.get("available") ?? "true";
  const cardDiscount = searchParams.get("cardDiscount") ?? "false";
  const view = searchParams.get("view") ?? "grid";

  const selectedStores: number[] = stores
    ? stores.split(",").map(Number)
    : [];

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.replace(`/search?${params.toString()}`);
    },
    [router, searchParams],
  );

  const allStoresSelected =
    selectedStores.length === 0 || selectedStores.length === ALL_STORE_IDS.length;

  function handleStoreChange(val: string) {
    if (val === "all") {
      updateParam("stores", null);
    } else {
      updateParam("stores", val);
    }
  }

  return (
    <div className="bg-secondary p-4 rounded-xl border border-border/30">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Select
            value={allStoresSelected ? "all" : selectedStores.join(",")}
            onValueChange={handleStoreChange}
          >
            <SelectTrigger className="w-[160px] bg-card border-border text-foreground font-bold text-sm">
              <SelectValue placeholder="Vse trgovine" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="bg-card border-border">
              <SelectItem value="all" className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">Vse trgovine</SelectItem>
              {ALL_STORE_IDS.map((id) => (
                <SelectItem key={id} value={String(id)} className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">
                  <span className="capitalize">{STORE_MAP[id]}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 px-2">
            <Switch
              id="discounts"
              checked={cardDiscount === "true"}
              onCheckedChange={(checked) =>
                updateParam("cardDiscount", checked ? "true" : "false")
              }
            />
            <Label htmlFor="discounts" className="text-sm font-bold text-foreground cursor-pointer">
              Zvestobni popusti
            </Label>
          </div>

          <div className="flex items-center gap-2 px-2">
            <Switch
              id="in-stock"
              checked={available === "true"}
              onCheckedChange={(checked) =>
                updateParam("available", checked ? "true" : "false")
              }
            />
            <Label htmlFor="in-stock" className="text-sm font-bold text-foreground cursor-pointer">
              Na zalogi
            </Label>
          </div>

          <div className="h-8 w-px bg-border/40 mx-2 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
              Razvrsti
            </span>
            <Select
              value={filter}
              onValueChange={(val) => updateParam("filter", val)}
            >
              <SelectTrigger className="w-[170px] bg-card border-border text-foreground font-bold text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="bg-card border-border">
                <SelectItem value="PRICE" className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">Cena</SelectItem>
                <SelectItem value="PRICE_PER_UNIT" className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">Cena na enoto</SelectItem>
                <SelectItem value="DISCOUNT_PCT" className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">Popust %</SelectItem>
                <SelectItem value="NONE" className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">Brez razvrščanja</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-0.5 bg-card p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => updateParam("order", "ASCENDING")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer",
                order === "ASCENDING"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              ASC
            </button>
            <button
              type="button"
              onClick={() => updateParam("order", "DESCENDING")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer",
                order === "DESCENDING"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              DESC
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => updateParam("view", "grid")}
            className={cn(
              "p-2 rounded-lg transition-colors cursor-pointer",
              view === "grid"
                ? "bg-card text-primary border border-primary/30"
                : "text-muted-foreground/40 hover:text-primary",
            )}
          >
            <LayoutGrid className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => updateParam("view", "list")}
            className={cn(
              "p-2 rounded-lg transition-colors cursor-pointer",
              view === "list"
                ? "bg-card text-primary border border-primary/30"
                : "text-muted-foreground/40 hover:text-primary",
            )}
          >
            <List className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
