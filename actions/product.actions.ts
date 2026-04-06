"use server";

import { ProductDetail } from "@/types/product.types";

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
