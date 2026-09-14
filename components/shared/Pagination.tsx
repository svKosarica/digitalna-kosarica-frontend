"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i);
  }

  const pages = new Set<number>();

  pages.add(0);
  pages.add(total - 1);

  for (let i = current - 3; i <= current + 3; i++) {
    if (i >= 0 && i < total) pages.add(i);
  }

  const sorted = [...pages].sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(sorted[i]);
  }

  return result;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const goToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page === 0) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }
      // The current route, not a literal: this component is mounted on /search
      // AND on /primerjava, and hardcoding one of them sends the other's readers
      // to a different page's results while still looking like it worked.
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, searchParams, pathname],
  );

  if (totalPages <= 1) return null;

  const hasPrev = currentPage > 0;
  const hasNext = currentPage < totalPages - 1;
  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div className="mt-12 flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={!hasPrev}
        onClick={() => goToPage(currentPage - 1)}
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-full transition-colors cursor-pointer",
          hasPrev
            ? "bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground"
            : "bg-secondary text-muted-foreground opacity-50 pointer-events-none",
        )}
      >
        <ChevronLeft className="size-5" />
      </button>

      {pages.map((item, idx) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground/40 font-bold">
            ...
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => goToPage(item)}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-full font-bold transition-colors cursor-pointer",
              item === currentPage
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-secondary",
            )}
          >
            {item + 1}
          </button>
        ),
      )}

      <button
        type="button"
        disabled={!hasNext}
        onClick={() => goToPage(currentPage + 1)}
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-full transition-colors cursor-pointer",
          hasNext
            ? "bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground"
            : "bg-secondary text-muted-foreground opacity-50 pointer-events-none",
        )}
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
