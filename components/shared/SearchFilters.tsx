"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { LayoutGrid, List } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ALL_CATEGORIES_LABEL, STORE_MAP } from "@/types/search.types";
import type { Category } from "@/types/search.types";
import { buildCategoryTree, cn } from "@/lib/utils";

const ALL_STORE_IDS = Object.keys(STORE_MAP).map(Number);

const ITEM_CLASS =
  "font-semibold text-foreground focus:bg-secondary focus:text-foreground";

interface SearchFiltersProps {
  /** Flat list from GET /categories. Empty when the endpoint fails or returns 204. */
  categories: Category[];
}

export function SearchFilters({ categories }: SearchFiltersProps) {
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

  const categoryTree = buildCategoryTree(categories);

  // Assumes a single known id — a comma list (?categories=2,6) still filters
  // results but falls back to the placeholder here, and same during a
  // categories-API outage ([]). Both are deliberate v1 tradeoffs; revisit this
  // derivation when multi-select lands.
  const categoryParam = searchParams.get("categories");
  const isKnownCategory =
    categoryParam !== null &&
    categories.some((category) => String(category.id) === categoryParam);

  // Three states, and the empty string matters. No param -> "all", so "Vse
  // kategorije" carries the checkmark. A known id -> that id. An unknown id
  // (stale bookmark) -> "", which is the only value Radix treats as "show the
  // placeholder"; passing the raw unknown id renders a blank trigger, and
  // coercing it to "all" would strand the user because Radix does not fire
  // onValueChange when re-selecting the current value. From "" , picking
  // "Vse kategorije" IS a change, so it fires and clears the param.
  const selectedCategory =
    categoryParam === null ? "all" : isKnownCategory ? categoryParam : "";

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

  function handleCategoryChange(val: string) {
    updateParam("categories", val === "all" ? null : val);
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

        {/* Category select */}
        <Select value={selectedCategory} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-full sm:w-[180px] bg-card border-border text-foreground font-bold text-sm">
            <SelectValue placeholder={ALL_CATEGORIES_LABEL} />
          </SelectTrigger>
          <SelectContent
            position="popper"
            sideOffset={4}
            // `cn` is twMerge, so this max-h REPLACES SelectContent's own
            // max-h-(--radix-select-content-available-height) rather than
            // layering over it. min() keeps the viewport clamp; a bare
            // max-h-[320px] would overflow a short viewport.
            className="bg-card border-border max-h-[min(320px,var(--radix-select-content-available-height))] max-w-[calc(100vw-2rem)]"
          >
            <SelectItem value="all" className={ITEM_CLASS}>
              {ALL_CATEGORIES_LABEL}
            </SelectItem>
            {categoryTree.map(({ parent, children }) =>
              children.length === 0 ? (
                <SelectItem key={parent.id} value={String(parent.id)} className={ITEM_CLASS}>
                  {parent.name}
                </SelectItem>
              ) : (
                <SelectGroup key={parent.id}>
                  {/* Supplies the group's accessible name — without it a screen
                      reader hears a flat list and pl-6 is pure decoration. */}
                  <SelectLabel className="text-muted-foreground">{parent.name}</SelectLabel>
                  {/* The rollup, spelled out. Suffix form avoids declining the
                      name ("Vse v Meso" would be ungrammatical Slovenian). */}
                  <SelectItem
                    value={String(parent.id)}
                    className={cn(ITEM_CLASS, "pl-6")}
                  >
                    {parent.name} - vse
                  </SelectItem>
                  {children.map((child) => (
                    <SelectItem
                      key={child.id}
                      value={String(child.id)}
                      className={cn(ITEM_CLASS, "pl-6")}
                    >
                      {child.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ),
            )}
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
