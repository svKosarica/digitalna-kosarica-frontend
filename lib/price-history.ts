import type { PriceHistoryEntry } from "@/types/product.types";

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
