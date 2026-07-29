"use server";

import type { Category } from "@/types/search.types";

export async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${process.env.API_URL}/categories`, {
      // Liquibase-seeded reference data — ids and names only change with a
      // backend deploy, so cache hard rather than using no-store like search.
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      console.error(`Categories API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const text = await res.text();
    if (!text) return []; // 204 No Content

    return JSON.parse(text) as Category[];
  } catch (error) {
    console.error("Categories request failed:", error);
    return [];
  }
}
