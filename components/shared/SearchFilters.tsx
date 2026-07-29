"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
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
  const viewParam = searchParams.get("view");
  const view = viewParam ?? "list";

  useEffect(() => {
    if (viewParam) return;
    const isDesktop = window.matchMedia("(min-width: 640px)").matches;
    const defaultView = isDesktop ? "grid" : "list";
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", defaultView);
    router.replace(`/search?${params.toString()}`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Any filter change invalidates the current page offset — a user on page 4
      // who narrows the results would otherwise land on an empty page 4.
      // `view` is presentation-only, so it keeps your place.
      if (key !== "page" && key !== "view") {
        params.delete("page");
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
    <div className="bg-secondary p-3 sm:p-4 rounded-xl border border-border/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        {/* Store select */}
        <Select
          value={allStoresSelected ? "all" : selectedStores.join(",")}
          onValueChange={handleStoreChange}
        >
          <SelectTrigger className="w-full sm:w-[160px] bg-card border-border text-foreground font-bold text-sm">
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

        {/* Switches row */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="discounts"
              checked={cardDiscount === "true"}
              onCheckedChange={(checked) =>
                updateParam("cardDiscount", checked ? "true" : "false")
              }
            />
            <Label htmlFor="discounts" className="text-xs sm:text-sm font-bold text-foreground cursor-pointer">
              Zvestobni popusti
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="in-stock"
              checked={available === "true"}
              onCheckedChange={(checked) =>
                updateParam("available", checked ? "true" : "false")
              }
            />
            <Label htmlFor="in-stock" className="text-xs sm:text-sm font-bold text-foreground cursor-pointer">
              Na zalogi
            </Label>
          </div>
        </div>

        <div className="h-px w-full bg-border/30 sm:h-8 sm:w-px sm:bg-border/40" />

        {/* Sort row */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 hidden sm:inline">
            Razvrsti
          </span>
          <Select
            value={filter}
            onValueChange={(val) => updateParam("filter", val)}
          >
            <SelectTrigger className="flex-1 sm:flex-none sm:w-[170px] bg-card border-border text-foreground font-bold text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="bg-card border-border">
              <SelectItem value="PRICE" className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">Cena</SelectItem>
              <SelectItem value="PRICE_PER_UNIT" className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">Cena na enoto</SelectItem>
              <SelectItem value="DISCOUNT_PCT" className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">Popust %</SelectItem>
              <SelectItem value="NONE" className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">Brez razvrščanja</SelectItem>
            </SelectContent>
          </Select>

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
              Naraš.
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
              Pad.
            </button>
          </div>

          {/* View toggle — pushed right, inline with sort on mobile */}
          <div className="ml-auto flex items-center gap-1">
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
              <LayoutGrid className="size-4 sm:size-5" />
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
              <List className="size-4 sm:size-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
