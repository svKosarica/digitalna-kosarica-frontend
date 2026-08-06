"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { PriceHistoryEntry } from "@/types/product.types";
import { CARD_DISCOUNT_CHART_NOTE } from "@/components/shared/CardDiscountMark";

const chartConfig = {
  price: {
    label: "Cena",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const PERIODS = [
  { label: "1 mes", months: 1 },
  { label: "3 mes", months: 3 },
  { label: "6 mes", months: 6 },
  { label: "1 leto", months: 12 },
  { label: "Vse", months: null },
] as const;

function formatDate(timestamp: string) {
  const d = new Date(timestamp);
  return d.toLocaleDateString("sl-SI", { day: "numeric", month: "short" });
}

/**
 * Collapses the history to at most one point per calendar day, keeping the
 * latest reading of each day. Stores are scraped several times a day and an
 * intraday swing would otherwise draw a spike the day's closing price never
 * had. Input must be sorted ascending.
 */
function toDailyPoints(sorted: PriceHistoryEntry[]) {
  const byDay = new Map<string, PriceHistoryEntry>();

  for (const entry of sorted) {
    const d = new Date(entry.timestamp);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    // Ascending input, so a later reading overwrites an earlier same-day one.
    byDay.set(key, entry);
  }

  return [...byDay.values()];
}

/**
 * Builds the chart series for the selected period. Reduces the history to one
 * point per day, filters the window client-side, prepends a carry-forward
 * anchor at the window start so the line always spans the window, and extends
 * a lone point into a flat line.
 */
function buildSeries(data: PriceHistoryEntry[], months: number | null) {
  const sorted = data
    .slice()
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  const daily = toDailyPoints(sorted);

  let points: { timestamp: string; price: number; cardDiscount: boolean }[] =
    daily;

  if (months !== null) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const inWindow = daily.filter((p) => new Date(p.timestamp) >= cutoff);
    const before = daily.filter((p) => new Date(p.timestamp) < cutoff);

    // Carry forward the last known reading (or the earliest point if all are
    // inside the window) so the line has a starting anchor at the window edge.
    // The whole reading is carried, not just its price: an anchor built from a
    // card-priced day is still a card price, and copying the price alone would
    // silently redraw it as a regular one.
    const anchor =
      before.length > 0 ? before[before.length - 1] : (inWindow[0] ?? daily[0]);

    points = [
      {
        timestamp: cutoff.toISOString(),
        price: anchor.price,
        cardDiscount: anchor.cardDiscount,
      },
      ...inWindow,
    ];
  }

  const mapped = points.map((entry) => ({
    time: new Date(entry.timestamp).getTime(),
    date: formatDate(entry.timestamp),
    price: entry.price,
    cardDiscount: entry.cardDiscount,
  }));

  // A single point has no segment to draw, so render it as a flat line
  // running to now, keeping the dot marker visible on the original point.
  if (mapped.length === 1) {
    const now = new Date();
    return [mapped[0], { ...mapped[0], time: now.getTime(), date: formatDate(now.toISOString()) }];
  }

  return mapped;
}

interface PriceHistoryChartProps {
  data: PriceHistoryEntry[];
}

export function PriceHistoryChart({ data }: PriceHistoryChartProps) {
  const [months, setMonths] = useState<number | null>(null);

  const chartData = buildSeries(data, months);

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

      <div className="bg-card rounded-2xl p-6 md:p-8 border border-border/10">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={chartData} accessibilityLayer>
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
              tickFormatter={(value: number) => formatDate(new Date(value).toISOString())}
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
              tickFormatter={(value: number) => `${value.toFixed(2)} €`}
              domain={["dataMin - 0.5", "dataMax + 0.5"]}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    formatDate(new Date(payload?.[0]?.payload?.time).toISOString())
                  }
                  formatter={(value, _name, item) => (
                    <>
                      <span className="font-medium text-foreground">
                        {Number(value).toFixed(2)} €
                      </span>
                      <span className="text-muted-foreground">Cena</span>
                      {(item?.payload as { cardDiscount?: boolean } | undefined)
                        ?.cardDiscount ? (
                        <span className="basis-full text-[11px] font-semibold text-primary">
                          {CARD_DISCOUNT_CHART_NOTE}
                        </span>
                      ) : null}
                    </>
                  )}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "var(--chart-1)", strokeWidth: 0 }}
              activeDot={{
                r: 6,
                fill: "var(--chart-1)",
                stroke: "var(--card)",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}
