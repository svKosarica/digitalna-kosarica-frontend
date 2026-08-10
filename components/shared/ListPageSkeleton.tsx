import { Skeleton } from "@/components/ui/skeleton";

interface ListPageSkeletonProps {
  /** How many filter pills the real page renders, so the row matches width. */
  pillCount: number;
}

/**
 * Loading shell for the filtered listing pages (/popular, /top-discounts).
 * Mirrors their layout: heading, pill row, then a grid of card placeholders.
 */
export function ListPageSkeleton({ pillCount }: ListPageSkeletonProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-20 py-6 space-y-6">
      <header className="mb-2">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-5 w-56 rounded-lg mt-2" />
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        {Array.from({ length: pillCount }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>

      {/* Row shells on phones, card shells from sm up — mirrors ProductResults. */}
      <div className="space-y-4 sm:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-4 flex items-center gap-4">
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
        ))}
      </div>

      <div className="hidden sm:grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 justify-items-center">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-64 h-[380px] bg-card rounded-xl p-5 flex flex-col">
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
        ))}
      </div>
    </div>
  );
}
