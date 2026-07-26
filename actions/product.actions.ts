"use server";

import { DiscountItem, ProductDetail } from "@/types/product.types";

export async function getProduct(id: string): Promise<ProductDetail> {
  const res = await fetch(
    `${process.env.API_URL}/store/products/${id}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch product: ${res.status} ${res.statusText}`,
    );
  }

  return res.json() as Promise<ProductDetail>;
}

export async function getSimilarProducts(
  id: string,
  limit: number = 12,
): Promise<DiscountItem[]> {
  try {
    const res = await fetch(
      `${process.env.API_URL}/store/products/${id}/similar?limit=${limit}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      console.error(`Similar products request failed: ${res.status}`);
      return [];
    }

    const data = (await res.json()) as {
      storeProduct: DiscountItem;
      score: number;
    }[];

    // Unwrap the similarity envelope — each entry is { storeProduct, score }.
    return data.map((entry) => entry.storeProduct);
  } catch (error) {
    console.error("Similar products request failed:", error);
    return [];
  }
}
