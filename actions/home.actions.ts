"use server";

import { DiscountItem } from "@/types/product.types";

export async function getDiscounts(limit: number = 20): Promise<DiscountItem[]> {
  const res = await fetch(
    `${process.env.API_URL}/store/products/highest-discount?limit=${limit}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch discounts: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<DiscountItem[]>;
}
