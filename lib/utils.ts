import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { StoreName } from "@/lib/store";

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
