"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  hasNextPage: boolean;
}

function getPageNumbers(current: number, hasNext: boolean): (number | "ellipsis")[] {
  const pages = new Set<number>();

  pages.add(0);

  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 0) pages.add(i);
  }

  if (hasNext) pages.add(current + 1);

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

export function Pagination({ currentPage, hasNextPage }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page === 0) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }
      router.replace(`/search?${params.toString()}`);
    },
    [router, searchParams],
  );

  const hasPrev = currentPage > 0;
  const pages = getPageNumbers(currentPage, hasNextPage);

  if (!hasPrev && !hasNextPage) return null;

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
        disabled={!hasNextPage}
        onClick={() => goToPage(currentPage + 1)}
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-full transition-colors cursor-pointer",
          hasNextPage
            ? "bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground"
            : "bg-secondary text-muted-foreground opacity-50 pointer-events-none",
        )}
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
