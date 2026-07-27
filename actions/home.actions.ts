"use server";

import { DiscountItem, DiscountWindow } from "@/types/product.types";

const NO_DISCOUNTS: DiscountItem[] = [];
const NO_POPULAR: DiscountItem[] = [];
const NO_INCREASES: DiscountItem[] = [];

/**
 * These endpoints answer 204 No Content — not 200 [] — when they have nothing
 * to return, and res.ok is true for 204, so the !res.ok guards below miss it.
 * A 204 body is empty, which makes res.json() throw, so read text first.
 */
async function parseItems(res: Response): Promise<DiscountItem[] | null> {
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text) as DiscountItem[];
}

export async function getDiscounts(
  limit: number = 20,
  window?: DiscountWindow
): Promise<DiscountItem[]> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    // Omitted rather than defaulted, so the homepage keeps hitting the exact
    // URL it always has (and the backend applies its own WEEKLY default).
    if (window) params.set("window", window);

    const res = await fetch(
      `${process.env.API_URL}/store/products/highest-discount?${params}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      console.error(
        `Discounts API error: ${res.status} ${res.statusText} (limit ${limit}, window ${window ?? "default"})`
      );
      return NO_DISCOUNTS;
    }

    // Awaited so a malformed body rejects inside the catch, not after returning.
    return (await parseItems(res)) ?? NO_DISCOUNTS;
  } catch (error) {
    console.error("Discounts request failed:", error);
    return NO_DISCOUNTS;
  }
}

export async function getMostPopular(
  limit: number = 20,
  onlyDiscounted: boolean = false
): Promise<DiscountItem[]> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (onlyDiscounted) params.set("onlyDiscounted", "true");

    const res = await fetch(
      `${process.env.API_URL}/store/products/most-popular?${params}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      console.error(
        `Most popular API error: ${res.status} ${res.statusText} (limit ${limit}, onlyDiscounted ${onlyDiscounted})`
      );
      return NO_POPULAR;
    }

    // Awaited so a malformed body rejects inside the catch, not after returning.
    return (await parseItems(res)) ?? NO_POPULAR;
  } catch (error) {
    console.error("Most popular request failed:", error);
    return NO_POPULAR;
  }
}

export async function getHighestPriceIncrease(
  limit: number = 20
): Promise<DiscountItem[]> {
  try {
    const res = await fetch(
      `${process.env.API_URL}/store/products/highest-price-increase?limit=${limit}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      console.error(
        `Price increase API error: ${res.status} ${res.statusText} (limit ${limit})`
      );
      return NO_INCREASES;
    }

    // Awaited so a malformed body rejects inside the catch, not after returning.
    return (await parseItems(res)) ?? NO_INCREASES;
  } catch (error) {
    console.error("Price increase request failed:", error);
    return NO_INCREASES;
  }
}
