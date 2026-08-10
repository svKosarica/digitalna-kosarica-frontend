import { Skeleton } from "@/components/ui/skeleton";

export default function ProductLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-20 py-8 space-y-10">
      <Skeleton className="h-9 w-24 rounded-full" />

      <section className="flex flex-col md:flex-row gap-8 md:gap-12">
        <Skeleton className="w-full md:w-[420px] aspect-square shrink-0 rounded-2xl" />

        <div className="flex flex-col justify-center gap-4 w-full">
          <div>
            <Skeleton className="h-3 w-24 rounded mb-3" />
            <Skeleton className="h-10 w-3/4 rounded-lg mb-1" />
            <Skeleton className="h-10 w-1/2 rounded-lg" />
          </div>

          <div className="flex items-baseline gap-3 mt-2">
            <Skeleton className="h-9 w-28 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>

          <div className="flex gap-3 mt-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-32 rounded-full" />
          </div>

          <div className="flex gap-3 mt-4">
            <Skeleton className="h-12 w-44 rounded-full" />
            <Skeleton className="h-12 w-40 rounded-full" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
      </section>
    </div>
  );
}
