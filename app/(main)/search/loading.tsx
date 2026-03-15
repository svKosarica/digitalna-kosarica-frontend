import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      {/* Filter bar skeleton */}
      <div className="flex flex-wrap items-center gap-6">
        <Skeleton className="h-9 w-[200px] rounded-md" />
        <div className="flex items-center gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-20 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-5 w-32 rounded-md" />
      </div>

      {/* Product card skeletons */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 justify-items-center">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-64 rounded-2xl overflow-hidden shadow-lg bg-white">
            <Skeleton className="h-44 w-full rounded-none" />
            <div className="px-4 pt-3 pb-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-7 w-20 mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
