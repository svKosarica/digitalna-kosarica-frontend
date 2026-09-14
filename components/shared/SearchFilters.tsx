"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ArrowDown, ArrowUp, LayoutGrid, List } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { STORE_MAP, VALID_FILTERS, VALID_SORTS } from "@/types/search.types";
import type { Category, FilterOption, SortOption } from "@/types/search.types";
import { CategoryMultiSelect } from "@/components/shared/CategoryMultiSelect";
import { StoreMultiSelect } from "@/components/shared/StoreMultiSelect";
import { cn } from "@/lib/utils";

// border-transparent in the base keeps the button from shifting 1px when the
// active state adds its border.
const TOGGLE_BASE =
  "p-2 rounded-lg border border-transparent transition-colors cursor-pointer";
const TOGGLE_ON = "bg-card text-primary border-primary/30";
const TOGGLE_OFF = "text-muted-foreground/40 hover:text-primary";

// sortOption NONE is not neutral server-side — filter=PRICE with sortOption=NONE
// returns the most expensive rows first — so a field chosen while no direction
// is set must be given one, or "Cena" would quietly mean "priciest first".
const DEFAULT_ORDER: Record<Exclude<FilterOption, "NONE">, SortOption> = {
  PRICE: "ASCENDING",
  PRICE_PER_UNIT: "ASCENDING",
  DISCOUNT_PCT: "DESCENDING",
};

interface SearchFiltersProps {
  /** Flat list from GET /categories. Empty when the endpoint fails or returns 204. */
  categories: Category[];
}

export function SearchFilters({ categories }: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Validated, not just defaulted: ?filter=xyz used to reach the Select as-is
  // and render a blank trigger.
  const filterParam = searchParams.get("filter");
  const filter: FilterOption = VALID_FILTERS.includes(filterParam as FilterOption)
    ? (filterParam as FilterOption)
    : "NONE";

  const orderParam = searchParams.get("order");
  const order: SortOption = VALID_SORTS.includes(orderParam as SortOption)
    ? (orderParam as SortOption)
    : "NONE";

  const storesParam = searchParams.get("stores");
  // Ids absent from STORE_MAP are dropped here, which also swallows the NaN
  // from ?stores=abc, so the popover never has to render an id it cannot name.
  const selectedStores = storesParam
    ? storesParam.split(",").map(Number).filter((id) => id in STORE_MAP)
    : [];

  const available = searchParams.get("available") ?? "true";
  const cardDiscount = searchParams.get("cardDiscount") ?? "true";
  // Null means "not chosen": the toggle's highlight then follows CSS at the
  // same breakpoint the results do, so neither can flash against the other.
  const viewParamRaw = searchParams.get("view");
  const view =
    viewParamRaw === "grid" || viewParamRaw === "list" ? viewParamRaw : null;


  const categoriesParam = searchParams.get("categories");
  // Not validated against `categories` here: that list is [] during a
  // categories-API outage, and validating against it would wipe a legitimate
  // filter. CategoryMultiSelect drops unknown ids when it opens instead.
  const selectedCategories = categoriesParam
    ? categoriesParam
        .split(",")
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0)
    : [];

  const updateParams = useCallback(
    (entries: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(entries)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      // Any filter change invalidates the current page offset — a user on page 4
      // who narrows the results would otherwise land on an empty page 4.
      // `view` is presentation-only, so it keeps your place.
      if (Object.keys(entries).some((key) => key !== "page" && key !== "view")) {
        params.delete("page");
      }
      router.replace(`/search?${params.toString()}`);
    },
    [router, searchParams],
  );

  const updateParam = useCallback(
    (key: string, value: string | null) => updateParams({ [key]: value }),
    [updateParams],
  );

  function handleFilterChange(val: string) {
    const next = val as FilterOption;
    if (next === "NONE") {
      // The API ignores sortOption without a field, and a stale value would
      // leave a direction pill lit while both are disabled.
      updateParams({ filter: "NONE", order: null });
      return;
    }
    updateParams({
      filter: next,
      ...(order === "NONE" ? { order: DEFAULT_ORDER[next] } : {}),
    });
  }

  return (
    <div className="bg-secondary p-3 sm:p-4 rounded-xl border border-border/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <StoreMultiSelect
          selected={selectedStores}
          onCommit={(ids) =>
            updateParam("stores", ids.length ? ids.join(",") : null)
          }
        />

        <CategoryMultiSelect
          categories={categories}
          selected={selectedCategories}
          onCommit={(ids) =>
            updateParam("categories", ids.length ? ids.join(",") : null)
          }
        />

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

        {/* Sort row.
            min-w-0 on the row and on the Select is what keeps this inside the
            toolbar on a narrow phone: without it the Select's intrinsic width
            plus the direction and view controls overflowed the rounded
            background, pushing the grid/list icons outside it. */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 hidden sm:inline">
            Razvrsti
          </span>
          <Select value={filter} onValueChange={handleFilterChange}>
            <SelectTrigger className="flex-1 min-w-0 sm:flex-none sm:w-[170px] bg-card border-border text-foreground font-bold text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="bg-card border-border">
              <SelectItem value="PRICE" className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">Cena</SelectItem>
              <SelectItem value="PRICE_PER_UNIT" className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">Cena na enoto</SelectItem>
              <SelectItem value="DISCOUNT_PCT" className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">Popust %</SelectItem>
              <SelectItem value="NONE" className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">Brez razvrščanja</SelectItem>
            </SelectContent>
          </Select>

          {/* Arrows rather than "Naraš."/"Pad.": the two text labels cost about
              120px, which is what pushed the view toggle out of the toolbar on a
              phone. An arrow carries the same meaning in ~28px. aria-label and
              title keep the wording available to screen readers and on hover. */}
          <div className="flex items-center gap-0.5 bg-card p-1 rounded-lg border border-border shrink-0">
            {/* Inert while nothing is sorted: the API ignores sortOption without
                a field, and a live-looking button that does nothing is worse
                than a visibly disabled one. */}
            <button
              type="button"
              disabled={filter === "NONE"}
              onClick={() => updateParam("order", "ASCENDING")}
              aria-label="Naraščajoče"
              title="Naraščajoče"
              className={cn(
                "p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none",
                order === "ASCENDING"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              <ArrowUp className="size-4" />
            </button>
            <button
              type="button"
              disabled={filter === "NONE"}
              onClick={() => updateParam("order", "DESCENDING")}
              aria-label="Padajoče"
              title="Padajoče"
              className={cn(
                "p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none",
                order === "DESCENDING"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              <ArrowDown className="size-4" />
            </button>
          </div>

          {/* View toggle — pushed right, inline with sort on mobile.
              shrink-0 so it keeps its full width and the Select gives way
              instead; it is the element that was being forced outside. */}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => updateParam("view", "grid")}
              aria-label="Mrežni prikaz"
              aria-pressed={view === "grid"}
              className={cn(
                TOGGLE_BASE,
                view === "grid" && TOGGLE_ON,
                view === "list" && TOGGLE_OFF,
                // Unchosen: inactive on phones, active from sm up — the
                // breakpoint the results themselves switch at.
                view === null && [
                  TOGGLE_OFF,
                  "sm:bg-card sm:text-primary sm:border-primary/30",
                ],
              )}
            >
              <LayoutGrid className="size-4 sm:size-5" />
            </button>
            <button
              type="button"
              onClick={() => updateParam("view", "list")}
              aria-label="Seznamski prikaz"
              aria-pressed={view === "list"}
              className={cn(
                TOGGLE_BASE,
                view === "list" && TOGGLE_ON,
                view === "grid" && TOGGLE_OFF,
                view === null && [
                  TOGGLE_ON,
                  "sm:bg-transparent sm:text-muted-foreground/40 sm:border-transparent sm:hover:text-primary",
                ],
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
