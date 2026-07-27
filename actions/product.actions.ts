"use server";

import { headers } from "next/headers";
import { DiscountItem, ProductDetail } from "@/types/product.types";

/**
 * Fetching a product is what records a view, and the backend deduplicates views
 * per client IP for 30 minutes. Without forwarding the real IP every view looks
 * like it came from this server, collapsing all users into a single bucket and
 * starving the most-popular list of data.
 *
 * Returns {} rather than throwing: headers() throws outside a request scope, and
 * the product page turns any throw from getProduct into notFound().
 */
async function clientIpHeaders(): Promise<HeadersInit> {
  try {
    const incoming = await headers();
    const ip = incoming.get("x-forwarded-for") ?? incoming.get("x-real-ip");
    return ip ? { "X-Forwarded-For": ip } : {};
  } catch {
    return {};
  }
}

export async function getProduct(id: string): Promise<ProductDetail> {
  const res = await fetch(
    `${process.env.API_URL}/store/products/${id}`,
    { cache: "no-store", headers: await clientIpHeaders() },
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
