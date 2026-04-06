import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <header className="mb-2">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-5 w-48 rounded-lg mt-2" />
      </header>

      <div className="bg-secondary p-4 rounded-xl border border-border/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-9 w-[160px] rounded-md" />
            <Skeleton className="h-5 w-32 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <div className="h-8 w-px bg-border/40 mx-2 hidden sm:block" />
            <Skeleton className="h-9 w-[170px] rounded-md" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 justify-items-center">
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
