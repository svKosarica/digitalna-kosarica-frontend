"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface FilterPillOption {
  /** Value written to the URL. An empty string removes the param entirely. */
  value: string;
  label: string;
}

interface FilterPillsProps {
  /** Search param this group controls, e.g. "window" or "onlyDiscounted". */
  param: string;
  options: FilterPillOption[];
  /** Currently active value, resolved by the server page from the URL. */
  active: string;
  ariaLabel: string;
}

/**
 * Segmented pill group that drives a single URL search param.
 *
 * The path comes from usePathname() rather than a hardcoded string, so the same
 * component works on any route — unlike SearchFilters/Pagination, which hardcode
 * "/search" and can't be reused elsewhere.
 */
export function FilterPills({
  param,
  options,
  active,
  ariaLabel,
}: FilterPillsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(value: string) {
    if (value === active) return;

    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(param, value);
    } else {
      params.delete(param);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex items-center gap-2 flex-wrap"
    >
      {options.map((option) => {
        const isActive = option.value === active;
        return (
          <button
            key={option.value || "all"}
            type="button"
            onClick={() => select(option.value)}
            aria-pressed={isActive}
            className={cn(
              "px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/70",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
