import type { PriceHistoryEntry } from "@/types/product.types";
import type { ComparisonPricePoint } from "@/types/comparison.types";

/**
 * Turns a product's price history into the points the chart draws.
 *
 * The only import is type-only, so type stripping erases it and this module can
 * be exercised directly with `node`.
 */

export interface PricePoint {
  time: number;
  price: number;
  cardDiscount: boolean;
}

/**
 * Collapses the history to at most one point per calendar day, keeping the
 * latest reading of each day. Stores are scraped several times a day and an
 * intraday swing would otherwise draw a spike the day's closing price never
 * had. Input must be sorted ascending.
 *
 * One exception: the oldest reading in the history is always kept, even when a
 * later reading the same day displaces it. It is the price the chart opens on,
 * and it is the one reading no following day can imply — every other displaced
 * reading is still bracketed by the days either side of it, but nothing sits
 * before the first. Without it a product whose history begins with a same-day
 * change (readings four hours apart across a UTC midnight land on one local
 * day) opens on its *new* price and draws a flat line, hiding the very change
 * the page reports as the old price above the chart.
 */
function toDailyPoints(sorted: PriceHistoryEntry[]) {
  const byDay = new Map<string, PriceHistoryEntry>();

  for (const entry of sorted) {
    const d = new Date(entry.timestamp);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    // Ascending input, so a later reading overwrites an earlier same-day one.
    byDay.set(key, entry);
  }

  const daily = [...byDay.values()];

  // Insertion order, so the first bucket is the oldest day and holds that day's
  // last reading. Identity, not price: an intraday change back to the same
  // price would still be a distinct entry, and re-adding it would draw a
  // redundant dot.
  const oldest = sorted[0];
  return daily[0] === oldest ? daily : [oldest, ...daily];
}

/**
 * Builds the chart series for the selected period. Reduces the history to one
 * point per day, filters the window client-side, prepends a carry-forward
 * anchor at the window start so the line always spans the window, and appends
 * one at `now` so it runs to today — without it the line stops at the last
 * change, reading as if the product had no price since.
 *
 * `now` is a parameter so the output is a function of its inputs alone.
 */
export function buildPriceSeries(
  data: PriceHistoryEntry[],
  months: number | null,
  now: Date = new Date(),
): PricePoint[] {
  if (data.length === 0) return [];

  const sorted = data
    .slice()
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  let points: PricePoint[] = toDailyPoints(sorted).map((entry) => ({
    time: new Date(entry.timestamp).getTime(),
    price: entry.price,
    cardDiscount: entry.cardDiscount,
  }));

  if (months !== null) {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffTime = cutoff.getTime();

    const inWindow = points.filter((p) => p.time >= cutoffTime);
    const before = points.filter((p) => p.time < cutoffTime);

    // Carry the whole reading forward, not just its price: an anchor built from
    // a card-priced day is still a card price, and copying the price alone
    // would silently redraw it as a regular one.
    const anchor = before.length > 0 ? before[before.length - 1] : points[0];

    points = [{ ...anchor, time: cutoffTime }, ...inWindow];
  }

  // The last known price still stands today, so run the line out to now. Guards
  // against a reading stamped in the future, which would otherwise fold the
  // series back on itself.
  const last = points[points.length - 1];
  if (now.getTime() > last.time) {
    points = [...points, { ...last, time: now.getTime() }];
  }

  return points;
}

/**
 * Recharts dataKey for one listing's line. Prefixed because a bare numeric key
 * is ambiguous against the `time` field.
 */
export function seriesKey(storeProductId: number): string {
  return `s${storeProductId}`;
}

/** Companion key carrying that listing's cardDiscount flag at the same point. */
export function cardKey(storeProductId: number): string {
  return `s${storeProductId}__card`;
}

/**
 * One row of the multi-series chart: a timestamp plus, for every listing, its
 * price at that moment (or null before its first reading) and its
 * card-discount flag.
 */
export interface MultiSeriesPoint {
  time: number;
  [key: string]: number | boolean | null;
}

/**
 * Merges every listing's price history onto one shared time axis.
 *
 * Each listing goes through buildPriceSeries first, so it inherits the
 * daily-collapse, the window anchor and the carry-forward-to-now that the
 * single-store chart already relies on — including the reason the oldest
 * reading is always kept. Only the merge is new.
 *
 * Between its own readings a series carries its last price forward, because
 * the price WAS that value: a point exists at every timestamp where any
 * listing changed, and leaving the others null there would break their lines
 * wherever a competitor happened to move. Before a series' first reading it
 * stays null — the store had published no price yet, and 0 would draw a line
 * to the floor.
 *
 * A listing with an empty priceHistory contributes no key at all, so the chart
 * simply draws no line for it rather than a flat zero.
 *
 * `now` is a parameter so the output is a function of its inputs alone.
 */
export function buildMultiStorePriceSeries(
  listings: {
    storeProductId: number;
    priceHistory: ComparisonPricePoint[];
  }[],
  months: number | null,
  now: Date = new Date(),
): MultiSeriesPoint[] {
  // ComparisonPricePoint is structurally a PriceHistoryEntry plus `anchor`, so
  // it feeds buildPriceSeries directly. The anchor flag is not consulted here:
  // a synthetic point draws exactly like a real one, and it is the CALLER's
  // job never to count it as a price change.
  const series = listings
    .map((listing) => ({
      key: seriesKey(listing.storeProductId),
      card: cardKey(listing.storeProductId),
      points: buildPriceSeries(listing.priceHistory, months, now),
    }))
    .filter((s) => s.points.length > 0);

  if (series.length === 0) return [];

  const times = [...new Set(series.flatMap((s) => s.points.map((p) => p.time)))].sort(
    (a, b) => a - b,
  );

  return times.map((time) => {
    const row: MultiSeriesPoint = { time };
    for (const s of series) {
      // The last point at or before `time` — the price that stood then. Linear
      // scan per series per timestamp is fine: at most ~5 series x a few dozen
      // price changes over a year.
      let current: (typeof s.points)[number] | undefined;
      for (const point of s.points) {
        if (point.time > time) break;
        current = point;
      }
      row[s.key] = current ? current.price : null;
      row[s.card] = current ? current.cardDiscount : null;
    }
    return row;
  });
}
