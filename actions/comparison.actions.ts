"use server";

import {
  buildMultiStoreQuery,
  clampDays,
  NO_MULTI_STORE_PAGE,
} from "@/lib/comparison";
import type {
  MultiStoreProductPage,
  MultiStoreSort,
  ProductComparison,
} from "@/types/comparison.types";

/**
 * The product-level endpoints: one article and what every store charges for it.
 *
 * `{id}` here is product.id, NOT storeProductId. The two are separate identity
 * spaces and both are bare integers, so a mix-up shows a plausible page about
 * the wrong article. product.actions.ts owns the storeProductId side.
 *
 * These endpoints send no CORS headers by design — every call must stay
 * server-side, which is what "use server" guarantees.
 */

/**
 * A list response is documented as always 200, but every other list endpoint
 * in this app answers 204 with an empty body when it has nothing, and res.ok
 * is true for 204 — which makes res.json() throw. Read text first, as
 * home.actions.ts does.
 */
async function parsePage(res: Response): Promise<MultiStoreProductPage | null> {
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text) as MultiStoreProductPage;
}

export async function getMultiStoreProducts(params: {
  page?: number;
  size?: number;
  sort?: MultiStoreSort;
  query?: string;
  categoryIds?: number[];
}): Promise<MultiStoreProductPage> {
  // Clamped in buildMultiStoreQuery, before anything reaches the wire: this
  // API has no error envelope, so an out-of-range size or a 65th categoryId
  // comes back as a bare 500 with no parsed body.
  const search = buildMultiStoreQuery(params);

  try {
    const res = await fetch(
      `${process.env.API_URL}/products/multi-store?${search}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      console.error(
        `Multi-store API error: ${res.status} ${res.statusText} (${search})`,
      );
      return NO_MULTI_STORE_PAGE;
    }

    // Awaited so a malformed body rejects inside the catch, not after returning.
    return (await parsePage(res)) ?? NO_MULTI_STORE_PAGE;
  } catch (error) {
    console.error("Multi-store request failed:", error);
    return NO_MULTI_STORE_PAGE;
  }
}

/**
 * One product with every store's listing and each listing's price history.
 *
 * Throws on failure rather than returning a fallback, so the page can turn it
 * into notFound() — the same contract getProduct has. A 404 means either no
 * such product or every listing behind it has been delisted; both are "gone".
 *
 * Unlike getProduct this does NOT forward the client IP: fetching a store
 * product records a view for the most-popular list, and this endpoint has no
 * such side effect. Forwarding it would imply one.
 */
export async function getProductComparison(
  id: string,
  days: number = 365,
): Promise<ProductComparison> {
  const res = await fetch(
    `${process.env.API_URL}/products/${id}?days=${clampDays(days)}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch product comparison: ${res.status} ${res.statusText}`,
    );
  }

  return res.json() as Promise<ProductComparison>;
}
