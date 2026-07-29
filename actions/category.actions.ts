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

    const parsed = JSON.parse(text);
    // `as Category[]` alone is compile-time only — a 200 whose body is `null`
    // or an error object would otherwise escape as a non-array and crash
    // buildCategoryTree downstream.
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Categories request failed:", error);
    return [];
  }
}
