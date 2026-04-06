"use server";

import { DiscountItem } from "@/types/product.types";
import { SearchRequest } from "@/types/search.types";

export async function searchProducts(
  request: SearchRequest
): Promise<DiscountItem[]> {
  const res = await fetch(
    `${process.env.API_URL}/store/products/all`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to search products: ${res.status} ${res.statusText}`
    );
  }

  const text = await res.text();
  if (!text) return [];

  const data = JSON.parse(text);
  return (Array.isArray(data) ? data : []) as DiscountItem[];
}
