import { Skeleton } from "@/components/ui/skeleton";

export default function ComparisonLoading() {
  return (
    <div className="py-6 sm:py-8 space-y-6 sm:space-y-10">
      <div className="px-4 sm:px-6 lg:px-20 space-y-6 sm:space-y-10">
        <Skeleton className="h-9 w-24 rounded-full" />

        <div className="flex flex-col md:flex-row gap-6 md:gap-12">
          <Skeleton className="w-full md:w-[420px] aspect-square max-h-[240px] sm:max-h-none rounded-2xl shrink-0 mx-auto md:mx-0" />
          <div className="flex flex-col justify-center gap-4 grow">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-10 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-9 w-48 rounded" />
            <Skeleton className="h-4 w-64 rounded" />
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-[380px] w-full rounded-2xl" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-8 w-56 rounded-lg" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
