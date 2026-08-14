import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SearchResultsSkeletonProps {
  /**
   * The `view` search param, or null when the visitor has not chosen. Mirrors
   * the real results: with null, both layouts render and CSS picks at `sm`, so
   * the skeleton cannot flash rows where cards are about to land.
   */
  view?: "grid" | "list" | null;
  cardCount?: number;
  rowCount?: number;
}

function CardShell() {
  return (
    <div className="w-64 h-[380px] bg-card rounded-xl p-5 flex flex-col">
      <Skeleton className="aspect-square w-full rounded-lg mb-4" />
      <Skeleton className="h-3 w-20 rounded mb-2" />
      <Skeleton className="h-5 w-full rounded mb-4" />
      <div className="mt-auto flex items-end justify-between">
        <div>
          <Skeleton className="h-3 w-14 rounded mb-1" />
          <Skeleton className="h-7 w-20 rounded" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    </div>
  );
}

function RowShell() {
  return (
    <div className="bg-card rounded-xl p-4 flex items-center gap-4">
      <Skeleton className="w-20 h-20 rounded-lg shrink-0" />
      <div className="grow min-w-0 flex flex-col gap-2">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-5 w-3/4 rounded" />
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-6 w-20 rounded" />
          <Skeleton className="h-7 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Placeholder for the /search result list. Shared by the route's loading.tsx
 * and the in-page Suspense boundary that re-arms on every filter change.
 */
export function SearchResultsSkeleton({
  view = null,
  cardCount = 8,
  rowCount = 6,
}: SearchResultsSkeletonProps) {
  return (
    <>
      {view !== "list" && (
        <div
          className={cn(
            "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 justify-items-center",
            view === null && "hidden sm:grid",
          )}
        >
          {Array.from({ length: cardCount }).map((_, i) => (
            <CardShell key={i} />
          ))}
        </div>
      )}

      {view !== "grid" && (
        <div className={cn("space-y-4", view === null && "sm:hidden")}>
          {Array.from({ length: rowCount }).map((_, i) => (
            <RowShell key={i} />
          ))}
        </div>
      )}
    </>
  );
}
