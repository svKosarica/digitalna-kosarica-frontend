"use server";

import { DiscountItem } from "@/types/product.types";

const NO_DISCOUNTS: DiscountItem[] = [];

export async function getDiscounts(limit: number = 20): Promise<DiscountItem[]> {
  try {
    const res = await fetch(
      `${process.env.API_URL}/store/products/highest-discount?limit=${limit}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      console.error(
        `Discounts API error: ${res.status} ${res.statusText} (limit ${limit})`
      );
      return NO_DISCOUNTS;
    }

    // Awaited so a malformed body rejects inside the catch, not after returning.
    return (await res.json()) as DiscountItem[];
  } catch (error) {
    console.error("Discounts request failed:", error);
    return NO_DISCOUNTS;
  }
}
