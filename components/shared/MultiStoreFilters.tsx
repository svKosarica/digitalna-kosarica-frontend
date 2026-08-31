"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryMultiSelect } from "@/components/shared/CategoryMultiSelect";
import { cn } from "@/lib/utils";
import {
  DEFAULT_MULTI_STORE_SORT,
  VALID_MULTI_STORE_SORTS,
  type MultiStoreSort,
} from "@/types/comparison.types";
import type { Category } from "@/types/search.types";

// Same classes SearchFilters uses; border-transparent in the base keeps the
// button from shifting 1px when the active state adds its border.
const TOGGLE_BASE =
  "p-2 rounded-lg border border-transparent transition-colors cursor-pointer";
const TOGGLE_ON = "bg-card text-primary border-primary/30";
const TOGGLE_OFF = "text-muted-foreground/40 hover:text-primary";

/**
 * Benefit-led labels, not field names: each sort has ONE baked-in direction, so
 * "Cena" alone would quietly mean "cheapest first" with no way to say so.
 */
export const SORT_LABELS: Record<MultiStoreSort, string> = {
  SAVINGS_PCT: "Največji prihranek",
  STORE_COUNT: "V največ trgovinah",
  MIN_PRICE: "Najcenejši",
  NAME: "Po abecedi",
};

export const SEARCH_PLACEHOLDER = "Išči med izdelki v več trgovinah…";

interface MultiStoreFiltersProps {
  /** Flat list from GET /categories. Empty when the endpoint fails or 204s. */
  categories: Category[];
}

/**
 * Exactly the controls GET /products/multi-store accepts, and no others.
 *
 * There is deliberately no store filter, availability toggle or card-discount
 * toggle: the endpoint accepts none of them, and applying them client-side
 * would filter only the 50 rows on screen while the header count and the
 * pagination kept describing the whole result — a filter that lies.
 */
export function MultiStoreFilters({ categories }: MultiStoreFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sortParam = searchParams.get("sort");
  const sort: MultiStoreSort = VALID_MULTI_STORE_SORTS.includes(
    sortParam as MultiStoreSort,
  )
    ? (sortParam as MultiStoreSort)
    : DEFAULT_MULTI_STORE_SORT;

  const categoriesParam = searchParams.get("categories");
  const selectedCategories = categoriesParam
    ? categoriesParam
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
    : [];

  const viewParamRaw = searchParams.get("view");
  const view = viewParamRaw === "grid" || viewParamRaw === "list" ? viewParamRaw : null;

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);

  // Resyncs the field when the URL changes from OUTSIDE this component — a
  // back/forward navigation, or the empty state's clear-filters link.
  //
  // Adjusted during render rather than in an effect. An effect would setState on
  // every searchParams change, costing a cascading second render, which is what
  // react-hooks/set-state-in-effect flags; this is React's documented
  // alternative for resyncing state to an external value. Comparing the STRING,
  // not the searchParams object, matters — that object can be a fresh instance
  // each render and would loop.
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  /**
   * `resetPage` is false only for `view`, which re-renders from data already on
   * the page. Every other control changes which rows exist, so the offset is
   * stale and must go — otherwise narrowing a 165-page result while on page 120
   * lands on an empty page.
   */
  function commit(
    changes: Record<string, string | null>,
    resetPage: boolean = true,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    if (resetPage) params.delete("page");
    const qs = params.toString();
    // replace, not push: filter changes should not each become a back-button stop.
    router.replace(qs ? `/primerjava?${qs}` : "/primerjava");
  }

  return (
    <div className="space-y-4">
      {/* Its own input rather than the header SearchBar, which hardcodes
          /search and clears itself off that route — it cannot serve this page. */}
      <div className="relative max-w-xl">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit({ q: query.trim() || null });
          }}
          onBlur={() => {
            const current = searchParams.get("q") ?? "";
            if (query.trim() !== current) commit({ q: query.trim() || null });
          }}
          placeholder={SEARCH_PLACEHOLDER}
          aria-label={SEARCH_PLACEHOLDER}
          className="pl-9"
        />
      </div>

      <div className="bg-secondary p-4 rounded-xl border border-border/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <CategoryMultiSelect
              categories={categories}
              selected={selectedCategories}
              onCommit={(ids) =>
                commit({ categories: ids.length ? ids.join(",") : null })
              }
            />

            {/* No direction control beside it: each option has exactly one
                useful direction, and the endpoint has no `direction` param. */}
            <Select
              value={sort}
              onValueChange={(value) => commit({ sort: value })}
            >
              {/* Colours copied from SearchFilters' sort Select so the two
                  toolbars read as one component: bare shadcn defaults made this
                  dropdown lighter than /search's. */}
              <SelectTrigger
                className="flex-1 min-w-0 sm:flex-none sm:w-[190px] bg-card border-border text-foreground font-bold text-sm"
                aria-label="Razvrsti"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={4}
                className="bg-card border-border"
              >
                {VALID_MULTI_STORE_SORTS.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    className="font-semibold text-foreground focus:bg-secondary focus:text-foreground"
                  >
                    {SORT_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => commit({ view: "grid" }, false)}
              aria-label="Mrežni prikaz"
              aria-pressed={view === "grid"}
              className={cn(
                TOGGLE_BASE,
                view === "grid" && TOGGLE_ON,
                view === "list" && TOGGLE_OFF,
                // Unchosen (arriving from the home rail's "Več izdelkov", which
                // sets no ?view): inactive on phones, active from sm up — the
                // breakpoint the results themselves switch at. A flat
                // `view === "grid" ? ON : OFF` left BOTH icons dark on arrival,
                // even though the grid is what renders. Mirrors SearchFilters.
                view === null && [
                  TOGGLE_OFF,
                  "sm:bg-card sm:text-primary sm:border-primary/30",
                ],
              )}
            >
              <LayoutGrid className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => commit({ view: "list" }, false)}
              aria-label="Seznamski prikaz"
              aria-pressed={view === "list"}
              className={cn(
                TOGGLE_BASE,
                view === "list" && TOGGLE_ON,
                view === "grid" && TOGGLE_OFF,
                // The inverse of the grid button: rows are what CSS renders
                // below sm, so this reads active there and inactive above.
                view === null && [
                  TOGGLE_ON,
                  "sm:bg-transparent sm:text-muted-foreground/40 sm:border-transparent sm:hover:text-primary",
                ],
              )}
            >
              <List className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
