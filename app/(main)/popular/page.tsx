import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";
import { getMostPopular } from "@/actions/home.actions";
import { FilterPills, type FilterPillOption } from "@/components/shared/FilterPills";
import { ProductResults } from "@/components/shared/ProductResults";
import { productCountLabel } from "@/lib/utils";

const LIMIT = 50;

const FILTER_OPTIONS: FilterPillOption[] = [
  { value: "", label: "Vsi" },
  { value: "true", label: "Z akcijo" },
];

export const metadata: Metadata = {
  title: "Najbolj priljubljeni",
  description:
    "Izdelki, ki si jih obiskovalci Digitalne Košarice najpogosteje ogledajo.",
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PopularPage({ searchParams }: Props) {
  const params = await searchParams;
  // Anything other than "true" means the unfiltered list, so no whitelist needed.
  const onlyDiscounted = params.onlyDiscounted === "true";

  const items = await getMostPopular(LIMIT, onlyDiscounted);

  return (
    <div className="px-4 sm:px-6 lg:px-20 py-6 space-y-6">
      <header className="mb-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1 break-words">
          Najbolj priljubljeni
        </h1>
        <p className="text-muted-foreground font-medium">
          Izdelki, ki si jih obiskovalci najpogosteje ogledajo
        </p>
      </header>

      <FilterPills
        param="onlyDiscounted"
        options={FILTER_OPTIONS}
        active={onlyDiscounted ? "true" : ""}
        ariaLabel="Filter priljubljenih izdelkov"
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <PackageSearch size={48} strokeWidth={1.5} />
          <p className="text-lg">
            {onlyDiscounted
              ? "Med priljubljenimi izdelki trenutno ni akcij."
              : "Trenutno ni priljubljenih izdelkov."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground font-medium">
            {productCountLabel(items.length)}
          </p>
          <ProductResults items={items} />
        </>
      )}
    </div>
  );
}
