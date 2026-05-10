"use server";

import type { SearchResponse } from "@/types/product.types";
import type { SearchRequest } from "@/types/search.types";

const EMPTY_RESPONSE: SearchResponse = {
  products: [],
  currentPage: 0,
  numberOfPages: 0,
  currentItems: 0,
  allItems: 0,
};

export async function searchProducts(
  request: SearchRequest
): Promise<SearchResponse> {
  try {
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
      console.error(
        `Search API error: ${res.status} ${res.statusText} for query "${request.query}"`
      );
      return EMPTY_RESPONSE;
    }

    const text = await res.text();
    if (!text) return EMPTY_RESPONSE;

    return JSON.parse(text) as SearchResponse;
  } catch (error) {
    console.error("Search request failed:", error);
    return EMPTY_RESPONSE;
  }
}
