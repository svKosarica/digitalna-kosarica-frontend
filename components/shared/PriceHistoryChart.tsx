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
import { formatEurAmount } from "@/lib/format";
import { buildPriceSeries } from "@/lib/price-history";
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

interface PriceHistoryChartProps {
  data: PriceHistoryEntry[];
}

export function PriceHistoryChart({ data }: PriceHistoryChartProps) {
  const [months, setMonths] = useState<number | null>(null);

  const chartData = buildPriceSeries(data, months);

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
              tickFormatter={(value: number) => `${formatEurAmount(value)} €`}
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
                        {formatEurAmount(Number(value))} €
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
