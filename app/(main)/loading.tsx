import { Skeleton } from "@/components/ui/skeleton";

function ListSkeleton() {
  return (
    <>
      <div className="px-4 sm:px-6 pt-8">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-4 w-48 rounded mt-2" />
      </div>

      <div className="flex gap-4 py-6 overflow-x-auto">
        <div className="shrink-0 w-0" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-64 h-[380px] bg-card rounded-xl p-5 flex flex-col"
          >
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
        <div className="shrink-0 w-4" />
      </div>
    </>
  );
}

export default function LoadingPage() {
  return (
    <>
      <section className="relative mx-4 sm:mx-6 mt-6 overflow-hidden rounded-xl bg-secondary p-8 md:p-16 flex flex-col md:flex-row items-center justify-between gap-12">
        <div className="max-w-xl w-full">
          <Skeleton className="h-12 md:h-16 w-3/4 rounded-lg mb-4 md:mb-6" />
          <Skeleton className="h-5 w-full max-w-md rounded mb-2" />
          <Skeleton className="h-5 w-2/3 max-w-md rounded mb-6 md:mb-8" />
          <Skeleton className="h-12 w-48 rounded-lg" />
        </div>
        <Skeleton className="hidden md:block w-full max-w-md aspect-video rounded-2xl" />
      </section>

      <ListSkeleton />
      <ListSkeleton />
      <ListSkeleton />
    </>
  );
}
