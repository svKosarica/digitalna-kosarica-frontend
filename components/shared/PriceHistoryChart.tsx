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
 * Builds the chart series for the selected period. Filters the full history
 * client-side, prepends a carry-forward anchor at the window start so the line
 * always spans the window, and duplicates a lone point into a flat line.
 */
function buildSeries(data: PriceHistoryEntry[], months: number | null) {
  const sorted = data
    .slice()
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  let points: { timestamp: string; price: number }[] = sorted;

  if (months !== null) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const inWindow = sorted.filter((p) => new Date(p.timestamp) >= cutoff);
    const before = sorted.filter((p) => new Date(p.timestamp) < cutoff);

    // Carry forward the last known price (or the earliest point if all are
    // inside the window) so the line has a starting anchor at the window edge.
    const anchorPrice =
      before.length > 0
        ? before[before.length - 1].price
        : (inWindow[0]?.price ?? sorted[0].price);

    points = [{ timestamp: cutoff.toISOString(), price: anchorPrice }, ...inWindow];
  }

  const mapped = points.map((entry) => ({
    date: formatDate(entry.timestamp),
    price: entry.price,
  }));

  // A single point has no segment to draw, so render it as a flat line by
  // duplicating it while keeping the dot marker visible.
  if (mapped.length === 1) {
    return [mapped[0], { ...mapped[0] }];
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
              dataKey="date"
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
                  formatter={(value) => [`${Number(value).toFixed(2)} €`, "Cena"]}
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
