"use server";

import { DiscountItem } from "@/types/product.types";
import { SearchRequest } from "@/types/search.types";

export async function searchProducts(
  request: SearchRequest
): Promise<DiscountItem[]> {
  console.log("[searchProducts] REQUEST:", JSON.stringify(request, null, 2));

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

  const data = await res.json();
  console.log("[searchProducts] RESPONSE (first 2 items):", JSON.stringify(data.slice(0, 2), null, 2));
  return data as DiscountItem[];
}
