"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { CARD_DISCOUNT_CHART_NOTE } from "@/components/shared/CardDiscountMark";
import { formatEurAmount } from "@/lib/format";
import {
  buildMultiStorePriceSeries,
  cardKey,
  seriesKey,
} from "@/lib/price-history";
import { seriesVariants } from "@/lib/comparison";
import { STORE_LOGOS } from "@/lib/store";
import { cn, normalizeStoreName } from "@/lib/utils";
import type { ProductComparisonListing } from "@/types/comparison.types";

/**
 * No "Vse" option, unlike the single-store chart.
 *
 * `days` on GET /api/v1/products/{id} caps at 365 and the page requests the
 * maximum, so "1 leto" IS everything the API will give. A button promising
 * more than the data holds would be a lie, and there is no wider window to
 * fetch. `months: null` means "do not filter" — the whole fetched window.
 */
const PERIODS = [
  { label: "1 mes", months: 1 },
  { label: "3 mes", months: 3 },
  { label: "6 mes", months: 6 },
  { label: "1 leto", months: null },
] as const;

const DASH = "6 4";

function formatDate(time: number) {
  return new Date(time).toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "short",
  });
}

interface Series {
  key: string;
  cardFlagKey: string;
  storeProductId: number;
  /** "Lidl", or "Lidl (2)" for a store's second listing. */
  label: string;
  color: string;
  dashed: boolean;
  logoUrl: string | null;
}

interface MultiStorePriceChartProps {
  listings: ProductComparisonListing[];
}

/**
 * One step line per LISTING, coloured by store.
 *
 * A separate component from PriceHistoryChart rather than a mode on it:
 * that one takes a single PriceHistoryEntry[] and ships on /product/[id],
 * whose behaviour must not change.
 *
 * Three decisions worth not undoing:
 *
 *  - `stepAfter`, never a smoothed line. The price was flat between two
 *    readings, not sliding — the log records changes only.
 *  - One line per listing, not per store. ~7% of listings are within-store
 *    duplicates with different prices; collapsing them would hide a published
 *    price, which is exactly what the API refuses to do. A store's second
 *    listing shares its colour and is dashed.
 *  - The key is storeProductId. `store.id` is NOT unique across listings.
 */
export function MultiStorePriceChart({ listings }: MultiStorePriceChartProps) {
  const [months, setMonths] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const series: Series[] = useMemo(
    () =>
      seriesVariants(
        listings.map((listing) => ({
          storeProductId: listing.storeProductId,
          storeId: listing.store.id,
          storeName: listing.store.name,
        })),
      ).map((entry) => {
        const name = normalizeStoreName(entry.storeName);
        const info = name ? STORE_LOGOS[name] : undefined;
        return {
          key: seriesKey(entry.storeProductId),
          cardFlagKey: cardKey(entry.storeProductId),
          storeProductId: entry.storeProductId,
          // A store the app does not know still gets a line, labelled with
          // whatever the API called it — better than an unlabelled line.
          label:
            (info?.label ?? entry.storeName) +
            (entry.occurrence > 1 ? ` (${entry.occurrence})` : ""),
          color: info?.lineColor ?? "var(--muted-foreground)",
          dashed: entry.dashed,
          logoUrl: info?.logoUrl ?? null,
        };
      }),
    [listings],
  );

  const data = useMemo(
    () => buildMultiStorePriceSeries(listings, months),
    [listings, months],
  );

  // ChartContainer generates the CSS vars its children reference from this.
  const config: ChartConfig = useMemo(
    () =>
      Object.fromEntries(
        series.map((s) => [s.key, { label: s.label, color: s.color }]),
      ),
    [series],
  );

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Every listing had an empty priceHistory. Not a zero line — no chart.
  if (data.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-8 sm:p-12 border border-border/10 flex items-center justify-center">
        <p className="text-muted-foreground text-center">
          Za ta izdelek še ni podatkov o zgodovini cen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setMonths(p.months)}
            className={cn(
              "px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer",
              months === p.months
                ? "bg-primary text-primary-foreground hover:bg-primary/85"
                : "bg-secondary text-foreground hover:bg-primary/15 hover:text-primary",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Our own legend rather than Recharts' <Legend>: it carries store logos,
          shows the dash style that distinguishes a duplicate listing, and
          toggles a line off — with 5 step lines the chart needs that. */}
      <div className="flex flex-wrap gap-2">
        {series.map((s) => {
          const isHidden = hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              aria-pressed={!isHidden}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer",
                isHidden
                  ? "border-border/40 text-muted-foreground/60 bg-transparent"
                  : "border-border/40 text-foreground bg-card",
              )}
            >
              {s.logoUrl && (
                <Image
                  src={s.logoUrl}
                  alt=""
                  width={16}
                  height={16}
                  className={cn("size-4 object-contain", isHidden && "opacity-40")}
                />
              )}
              {/* The swatch shows the dash style too, so a duplicate listing is
                  identifiable in the legend and not only on the chart. */}
              <span
                aria-hidden
                className="w-4 h-0.5 shrink-0"
                style={{
                  backgroundColor: isHidden ? "var(--border)" : s.color,
                  backgroundImage: s.dashed
                    ? `repeating-linear-gradient(to right, ${
                        isHidden ? "var(--border)" : s.color
                      } 0 4px, transparent 4px 7px)`
                    : undefined,
                }}
              />
              <span className={cn(isHidden && "line-through")}>{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-card rounded-2xl p-6 md:p-8 border border-border/10">
        <ChartContainer config={config} className="h-[300px] w-full">
          <LineChart data={data} accessibilityLayer>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              opacity={0.4}
            />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value: number) => formatDate(value)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              stroke="var(--muted-foreground)"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              stroke="var(--muted-foreground)"
              tickFormatter={(value: number) => `${formatEurAmount(value)} €`}
              domain={["dataMin - 0.5", "dataMax + 0.5"]}
            />
            <ChartTooltip content={<MultiStoreTooltip series={series} />} />
            {series
              .filter((s) => !hidden.has(s.key))
              .map((s) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  type="stepAfter"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? DASH : undefined}
                  dot={false}
                  activeDot={{ r: 4 }}
                  // A series is null before its first reading and at timestamps
                  // where only OTHER stores moved; without this a line would
                  // break every time a competitor changed price.
                  connectNulls
                />
              ))}
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  label?: number;
  payload?: { dataKey?: string | number; value?: number }[];
  series: Series[];
}

/**
 * Custom tooltip rather than ChartTooltipContent: it sorts the stores by price
 * at the hovered date, so the cheapest reads first — the whole point of the
 * page — which the shared component does not do.
 */
function MultiStoreTooltip({ active, label, payload, series }: TooltipProps) {
  if (!active || !payload?.length || label == null) return null;

  const rows = payload
    .map((entry) => {
      const match = series.find((s) => s.key === entry.dataKey);
      if (!match || typeof entry.value !== "number") return null;
      // Carry the series key AND its card-flag key through. Re-resolving the
      // series further down by `label` would be a string join with no
      // uniqueness guarantee: two listings whose raw store.name strings match
      // produce identical labels (occurrence is counted per storeId, so it does
      // not separate them), and find() would return the first — attaching the
      // card badge and the React key to the wrong listing.
      return {
        key: match.key,
        cardFlagKey: match.cardFlagKey,
        label: match.label,
        color: match.color,
        value: entry.value,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.value - b.value);

  if (rows.length === 0) return null;

  // Card-discount flags ride the same row as the prices, keyed per listing.
  const point = payload[0] as unknown as { payload?: Record<string, unknown> };
  const flags = point.payload ?? {};

  return (
    <div className="rounded-lg border border-border/40 bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-foreground">{formatDate(label)}</p>
      <div className="space-y-1">
        {rows.map((row) => {
          const carded = flags[row.cardFlagKey] === true;
          return (
            <div key={row.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: row.color }}
              />
              <span className="text-muted-foreground">{row.label}</span>
              <span className="ml-auto font-medium text-foreground">
                {formatEurAmount(row.value)} €
              </span>
              {carded && (
                <span className="text-primary">{CARD_DISCOUNT_CHART_NOTE}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
