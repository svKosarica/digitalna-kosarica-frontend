import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { StoreName } from "@/components/shared/ProductCard"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const KNOWN_STORES: StoreName[] = ["spar", "mercator", "hofer", "lidl"];

export function normalizeStoreName(apiName: string): StoreName | undefined {
  const lower = apiName.toLowerCase();
  return KNOWN_STORES.find((s) => lower.startsWith(s));
}
