"use client";

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
import type { PriceHistoryEntry } from "@/types/product.types";

const chartConfig = {
  price: {
    label: "Cena",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

function formatDate(timestamp: string) {
  const d = new Date(timestamp);
  return d.toLocaleDateString("sl-SI", { day: "numeric", month: "short" });
}

interface PriceHistoryChartProps {
  data: PriceHistoryEntry[];
}

export function PriceHistoryChart({ data }: PriceHistoryChartProps) {
  const chartData = data
    .slice()
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    .map((entry) => ({
      date: formatDate(entry.timestamp),
      price: entry.price,
    }));

  return (
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
  );
}
