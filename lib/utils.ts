import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { StoreName } from "@/lib/store";
import type { Category, CategoryTreeNode } from "@/types/search.types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Matched as substrings against a lowercased API name, first match winning.
// The API sends "tus" without the diacritic; the accented alias is defensive.
const STORE_ALIASES: Record<string, StoreName> = {
  spar: "spar",
  mercator: "mercator",
  merkator: "mercator",
  hofer: "hofer",
  lidl: "lidl",
  tus: "tus",
  "tuš": "tus",
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

// Slovenian has a dual, so a count has four forms. Intl implements the rule;
// lib/format.ts explains why hand-rolling it off the last two digits goes
// wrong. These are nominative ("2 trgovini"), unlike the locative the results
// header uses ("v 2 trgovinah") — different grammatical case, different helper.
const countRules = new Intl.PluralRules("sl");

const STORE_FORMS = {
  one: "trgovina",
  two: "trgovini",
  few: "trgovine",
  other: "trgovin",
  zero: "trgovin",
  many: "trgovin",
} as const;

const CATEGORY_FORMS = {
  one: "kategorija",
  two: "kategoriji",
  few: "kategorije",
  other: "kategorij",
  zero: "kategorij",
  many: "kategorij",
} as const;

/** "1 trgovina", "2 trgovini", "3 trgovine", "5 trgovin". */
export function storeCountLabel(count: number): string {
  return `${count} ${STORE_FORMS[countRules.select(count)]}`;
}

/** "1 kategorija", "2 kategoriji", "3 kategorije", "5 kategorij". */
export function categoryCountLabel(count: number): string {
  return `${count} ${CATEGORY_FORMS[countRules.select(count)]}`;
}

export function normalizeStoreName(apiName: string): StoreName | undefined {
  const lower = apiName.toLowerCase();
  for (const [alias, store] of Object.entries(STORE_ALIASES)) {
    if (lower.includes(alias)) return store;
  }
  return undefined;
}

/**
 * Turns the flat GET /categories array into a forest rooted at the top-level
 * categories.
 *
 * Depth is whatever the data says. This used to hand back roots plus one level
 * of children, which silently swallowed the drinks leaves the moment the
 * backend nested Vino under Alkoholne pijače under Pijače: they were bucketed
 * under a non-root parent id that nothing ever looked up.
 *
 * API array order is preserved at every level — the category set drifts and
 * the backend already emits it depth-first, heaviest branch first, so never
 * sort or hardcode it. A category whose parentCategoryId matches nothing
 * reachable from a root is dropped rather than rendered as an orphan.
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

  // parent_category carries no constraint against a cycle, and unlike the old
  // single-level lookup this recurses — an A→B→A loop would blow the stack and
  // take the whole page down, so a category already on the current path is
  // treated as absent.
  const onPath = new Set<number>();

  function subtreeOf(parent: Category): CategoryTreeNode {
    onPath.add(parent.id);
    const children = (childrenByParentId.get(parent.id) ?? [])
      .filter((child) => !onPath.has(child.id))
      .map(subtreeOf);
    onPath.delete(parent.id);
    return { category: parent, children };
  }

  return categories
    .filter((category) => category.parentCategoryId == null)
    .map(subtreeOf);
}
