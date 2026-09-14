import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { getMultiStoreProducts } from "@/actions/comparison.actions";
import { getCategories } from "@/actions/category.actions";
import { MultiStoreFilters } from "@/components/shared/MultiStoreFilters";
import { MultiStoreResults } from "@/components/shared/MultiStoreResults";
import { MultiStoreResultsSkeleton } from "@/components/shared/MultiStoreResultsSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { productCountLabel } from "@/lib/utils";
import {
  DEFAULT_MULTI_STORE_SORT,
  VALID_MULTI_STORE_SORTS,
  type MultiStoreProductPage,
  type MultiStoreSort,
} from "@/types/comparison.types";

const PAGE_SIZE = 50;

// Module-local, not exported: Next validates a page module's export surface,
// and an unrecognised named export can fail the build. Nothing outside this
// file needs them — the home rail writes its own copy in app/(main)/page.tsx.
const PAGE_TITLE = "Isti izdelek, več cen";

/**
 * Three empty states, not one.
 *
 * This corpus is 8238 articles across 165 pages — most articles
 * are carried by a single store and never appear here — so a category filter
 * empties the page routinely. A generic "ni rezultatov" would read as a bug.
 */
const EMPTY_QUERY = (query: string) =>
  `Ni rezultatov za „${query}" med izdelki, ki jih prodaja več trgovin.`;
const EMPTY_CATEGORY =
  "V izbranih kategorijah ni izdelkov, ki bi jih prodajalo več trgovin.";
const EMPTY_NONE =
  "Trenutno ni izdelkov, ki bi jih prodajalo več trgovin.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description:
    "Izdelki, ki jih prodaja več trgovin — primerjajte ceno pri vsaki od njih.",
};

/**
 * The count, split out so it can sit behind its own Suspense boundary: it lives
 * in the header, above the filters, which must stay mounted.
 */
async function ResultsCount({
  promise,
}: {
  promise: Promise<MultiStoreProductPage>;
}) {
  const { allItems } = await promise;

  if (allItems === 0) {
    return (
      <p className="text-muted-foreground font-medium">{productCountLabel(0)}</p>
    );
  }

  return (
    <p className="text-muted-foreground font-medium">
      {productCountLabel(allItems)} v več trgovinah
    </p>
  );
}

async function Results({
  promise,
  query,
  hasCategoryFilter,
  viewParam,
}: {
  promise: Promise<MultiStoreProductPage>;
  query: string;
  hasCategoryFilter: boolean;
  viewParam: "grid" | "list" | null;
}) {
  const response = await promise;

  if (response.products.length === 0) {
    const message = query
      ? EMPTY_QUERY(query)
      : hasCategoryFilter
        ? EMPTY_CATEGORY
        : EMPTY_NONE;

    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 text-center px-4">
        <PackageSearch size={48} strokeWidth={1.5} />
        <p className="text-lg max-w-md">{message}</p>
        {(query || hasCategoryFilter) && (
          <Link
            href="/primerjava"
            className="mt-2 text-sm font-semibold text-primary hover:underline"
          >
            Počisti filtre
          </Link>
        )}
      </div>
    );
  }

  return (
    <MultiStoreResults
      items={response.products}
      currentPage={response.currentPage}
      totalPages={response.numberOfPages}
      viewParam={viewParam}
    />
  );
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PrimerjavaPage({ searchParams }: Props) {
  const params = await searchParams;

  const query = typeof params.q === "string" ? params.q.trim() : "";

  // Validated, not just defaulted: ?sort=xyz reaching the Select renders a
  // blank trigger, which is how the same bug shipped on /search once.
  const sort: MultiStoreSort = VALID_MULTI_STORE_SORTS.includes(
    params.sort as MultiStoreSort,
  )
    ? (params.sort as MultiStoreSort)
    : DEFAULT_MULTI_STORE_SORT;

  // The positive-integer test rejects the NaN from ?categories=abc, the 0 from
  // a hand-edited URL, and non-integers/Infinity.
  const categoryIds =
    typeof params.categories === "string"
      ? params.categories
          .split(",")
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
      : [];

  const currentPage = Math.max(
    0,
    parseInt(typeof params.page === "string" ? params.page : "0", 10) || 0,
  );

  const viewParam =
    params.view === "grid" || params.view === "list" ? params.view : null;

  // Deliberately not awaited: the two boundaries below await it, so the header
  // and filters stream immediately. getMultiStoreProducts swallows its own
  // errors and resolves to an empty page, so this floating promise can never
  // become an unhandled rejection.
  const responsePromise = getMultiStoreProducts({
    page: currentPage,
    size: PAGE_SIZE,
    sort,
    query,
    // undefined, not [] — omitted means "every category" server-side, while an
    // empty array on the wire would mean the opposite of a filter.
    categoryIds: categoryIds.length ? categoryIds : undefined,
  });

  const categories = await getCategories();

  // Changing this key remounts both boundaries, which is what makes the
  // skeletons reappear on a filter change: router.replace() is a same-route
  // navigation, so loading.tsx does not re-run and an already-mounted boundary
  // would keep showing stale rows for the whole request. `view` is excluded on
  // purpose — it re-renders from data already on the page and must not flash.
  const resultsKey = JSON.stringify([query, sort, categoryIds, currentPage]);

  return (
    <div className="px-4 sm:px-6 lg:px-20 py-6 space-y-6">
      <header className="mb-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1 break-words">
          {PAGE_TITLE}
        </h1>
        {/* h-6 wrapper, not a bare h-5 bar: the real <p> line box is 24px, and a
            shorter placeholder pulls the filter row up 4px when the count lands. */}
        <Suspense
          key={resultsKey}
          fallback={
            <div className="h-6 flex items-center">
              <Skeleton className="h-4 w-48 rounded" />
            </div>
          }
        >
          <ResultsCount promise={responsePromise} />
        </Suspense>
      </header>

      <MultiStoreFilters categories={categories} />

      <Suspense
        key={resultsKey}
        fallback={<MultiStoreResultsSkeleton view={viewParam} />}
      >
        <Results
          promise={responsePromise}
          query={query}
          hasCategoryFilter={categoryIds.length > 0}
          viewParam={viewParam}
        />
      </Suspense>
    </div>
  );
}
