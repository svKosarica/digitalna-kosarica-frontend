import type { Metadata } from "next";
import { BadgePercent } from "lucide-react";
import { getDiscounts } from "@/actions/home.actions";
import { FilterPills, type FilterPillOption } from "@/components/shared/FilterPills";
import { ProductResults } from "@/components/shared/ProductResults";
import { productCountLabel } from "@/lib/utils";
import type { DiscountWindow } from "@/types/product.types";

const LIMIT = 50;

const VALID_WINDOWS: DiscountWindow[] = ["CURRENT", "DAILY", "WEEKLY"];

const WINDOW_OPTIONS: FilterPillOption[] = [
  { value: "CURRENT", label: "Trenutne" },
  { value: "DAILY", label: "Dnevne" },
  { value: "WEEKLY", label: "Tedenske" },
];

const SUBTITLES: Record<DiscountWindow, string> = {
  CURRENT: "Vsi izdelki, ki so trenutno v akciji",
  DAILY: "Akcije, ki so se pojavile danes",
  WEEKLY: "Akcije, ki so se pojavile v zadnjih 7 dneh",
};

/**
 * An empty DAILY window is normal — it only has rows once a scrape has run
 * today — so its copy must not read like a failure.
 */
const EMPTY_STATES: Record<DiscountWindow, { title: string; hint?: string }> = {
  CURRENT: { title: "Trenutno ni izdelkov v akciji." },
  DAILY: {
    title: "Danes še ni novih akcij.",
    hint: "Poskusi pozneje ali si oglej tedenske.",
  },
  WEEKLY: { title: "V zadnjem tednu ni bilo novih akcij." },
};

export const metadata: Metadata = {
  title: "Najvišji popusti",
  description: "Izdelki z največjimi popusti v slovenskih trgovinah.",
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TopDiscountsPage({ searchParams }: Props) {
  const params = await searchParams;

  // WEEKLY matches the API's own default for a missing window param.
  const activeWindow: DiscountWindow = VALID_WINDOWS.includes(
    params.window as DiscountWindow,
  )
    ? (params.window as DiscountWindow)
    : "WEEKLY";

  const items = await getDiscounts(LIMIT, activeWindow);
  const empty = EMPTY_STATES[activeWindow];

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <header className="mb-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1 break-words">
          Najvišji popusti
        </h1>
        <p className="text-muted-foreground font-medium">
          {SUBTITLES[activeWindow]}
        </p>
      </header>

      <FilterPills
        param="window"
        options={WINDOW_OPTIONS}
        active={activeWindow}
        ariaLabel="Obdobje popustov"
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <BadgePercent size={48} strokeWidth={1.5} />
          <p className="text-lg">{empty.title}</p>
          {empty.hint && <p className="text-sm">{empty.hint}</p>}
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
