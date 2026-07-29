import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { StoreName } from "@/lib/store";
import type { Category, CategoryTreeNode } from "@/types/search.types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STORE_ALIASES: Record<string, StoreName> = {
  spar: "spar",
  mercator: "mercator",
  merkator: "mercator",
  hofer: "hofer",
  lidl: "lidl",
};

/**
 * Slovenian has four count forms, keyed off the last two digits:
 * 1 izdelek, 2 izdelka, 3-4 izdelki, 5+ izdelkov.
 */
export function productCountLabel(count: number): string {
  const rest = Math.abs(count) % 100;
  if (rest === 1) return `${count} izdelek`;
  if (rest === 2) return `${count} izdelka`;
  if (rest === 3 || rest === 4) return `${count} izdelki`;
  return `${count} izdelkov`;
}

export function normalizeStoreName(apiName: string): StoreName | undefined {
  const lower = apiName.toLowerCase();
  for (const [alias, store] of Object.entries(STORE_ALIASES)) {
    if (lower.includes(alias)) return store;
  }
  return undefined;
}

/**
 * Turns the flat GET /categories array into one entry per top-level category.
 *
 * API array order is preserved at both levels — the category set drifts, so
 * never sort or hardcode it. A child whose parentCategoryId matches no
 * top-level category is dropped rather than rendered as an orphan. The tree is
 * exactly two levels deep; the backend asserts this.
 *
 * A top-level category arrives with parentCategoryId === null. Both checks
 * below use loose equality so an omitted field (parentCategoryId undefined —
 * e.g. if the backend ever stops serializing explicit nulls) still counts as
 * a root; with strict equality every root would be bucketed as a child of
 * `undefined` instead, and the dropdown would silently render only "Vse
 * kategorije".
 */
export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const childrenByParentId = new Map<number, Category[]>();

  for (const category of categories) {
    if (category.parentCategoryId == null) continue;
    const siblings = childrenByParentId.get(category.parentCategoryId);
    if (siblings) {
      siblings.push(category);
    } else {
      childrenByParentId.set(category.parentCategoryId, [category]);
    }
  }

  return categories
    .filter((category) => category.parentCategoryId == null)
    .map((parent) => ({
      parent,
      children: childrenByParentId.get(parent.id) ?? [],
    }));
}
