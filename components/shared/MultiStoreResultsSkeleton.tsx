import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MultiStoreResultsSkeletonProps {
  /** Mirrors the real results: null renders both and lets CSS pick at `sm`. */
  view?: "grid" | "list" | null;
  cardCount?: number;
  rowCount?: number;
}

/**
 * Matches MultiStoreProductCard's box model, not ProductCard's: there is no
 * round button in the bottom-right, and the price block spans the card, so
 * reusing SearchResultsSkeleton would settle into a different layout than the
 * one that lands.
 */
function CardShell() {
  return (
    <div className="w-64 h-[380px] bg-card rounded-xl p-5 flex flex-col">
      <Skeleton className="aspect-square w-full rounded-lg mb-4" />
      <Skeleton className="h-3 w-20 rounded mb-2" />
      <Skeleton className="h-5 w-full rounded mb-4" />
      <div className="mt-auto space-y-1.5">
        <Skeleton className="h-7 w-28 rounded" />
        <Skeleton className="h-3 w-36 rounded" />
      </div>
    </div>
  );
}

function RowShell() {
  return (
    <div className="bg-card rounded-xl p-4 flex items-center gap-4">
      <Skeleton className="w-20 h-20 sm:w-28 sm:h-28 rounded-lg shrink-0" />
      <div className="grow min-w-0 flex flex-col gap-2">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="h-3 w-32 rounded sm:hidden" />
      </div>
      <div className="hidden sm:flex flex-col items-end gap-2 shrink-0 min-w-[200px]">
        <Skeleton className="h-8 w-28 rounded" />
        <Skeleton className="h-3 w-36 rounded" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
    </div>
  );
}

export function MultiStoreResultsSkeleton({
  view = null,
  cardCount = 12,
  rowCount = 6,
}: MultiStoreResultsSkeletonProps) {
  return (
    <>
      {view !== "list" && (
        <div
          className={cn(
            "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 justify-items-center",
            view === null && "hidden sm:grid",
          )}
        >
          {Array.from({ length: cardCount }, (_, i) => (
            <CardShell key={i} />
          ))}
        </div>
      )}

      {view !== "grid" && (
        <div className={cn("space-y-4", view === null && "sm:hidden")}>
          {Array.from({ length: rowCount }, (_, i) => (
            <RowShell key={i} />
          ))}
        </div>
      )}
    </>
  );
}
