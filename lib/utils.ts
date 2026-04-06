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

export function normalizeStoreName(apiName: string): StoreName | undefined {
  const lower = apiName.toLowerCase();
  for (const [alias, store] of Object.entries(STORE_ALIASES)) {
    if (lower.includes(alias)) return store;
  }
  return undefined;
}
