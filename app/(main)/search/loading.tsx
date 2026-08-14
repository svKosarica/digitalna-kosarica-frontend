import { SearchResultsSkeleton } from "@/components/shared/SearchResultsSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-20 py-6 space-y-6">
      <header className="mb-2">
        {/* Mirrors the real header's boxes — h1 line box 36px + mb-1, then a
            24px line — so handing over to the page does not shift the layout. */}
        <Skeleton className="h-9 w-72 rounded-lg mb-1" />
        <div className="h-6 flex items-center">
          <Skeleton className="h-4 w-48 rounded" />
        </div>
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

      {/* No view param is readable here, so this mirrors the page's null case:
          rows on phones, cards from sm up. */}
      <SearchResultsSkeleton view={null} />
    </div>
  );
}
