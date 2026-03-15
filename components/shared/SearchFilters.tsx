"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { STORE_MAP } from "@/types/search.types";

const ALL_STORE_IDS = Object.keys(STORE_MAP).map(Number);

export function SearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filter = searchParams.get("filter") ?? "PRICE";
  const order = searchParams.get("order") ?? "DESCENDING";
  const stores = searchParams.get("stores");
  const available = searchParams.get("available") ?? "true";
  const cardDiscount = searchParams.get("cardDiscount") ?? "false";

  const selectedStores: number[] = stores
    ? stores.split(",").map(Number)
    : [];

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.replace(`/search?${params.toString()}`);
    },
    [router, searchParams]
  );

  function handleStoreToggle(storeId: number, checked: boolean) {
    let next: number[];
    if (selectedStores.length === 0) {
      next = checked
        ? [storeId]
        : ALL_STORE_IDS.filter((id) => id !== storeId);
    } else {
      next = checked
        ? [...selectedStores, storeId]
        : selectedStores.filter((id) => id !== storeId);
    }

    const allSelected =
      next.length === ALL_STORE_IDS.length || next.length === 0;
    updateParam("stores", allSelected ? null : next.join(","));
  }

  function isStoreChecked(storeId: number) {
    if (selectedStores.length === 0) return true;
    return selectedStores.includes(storeId);
  }

  return (
    <div className="flex flex-wrap items-center gap-6">
      {/* Filter by */}
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">
          Razvrsti po
        </Label>
        <Select
          value={filter}
          onValueChange={(val) => updateParam("filter", val)}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PRICE">Cena</SelectItem>
            <SelectItem value="PRICE_PER_UNIT">Cena na enoto</SelectItem>
            <SelectItem value="DISCOUNT_PCT">Popust %</SelectItem>
            <SelectItem value="NONE">Brez razvrščanja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort direction */}
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">
          Vrstni red
        </Label>
        <Select
          value={order}
          onValueChange={(val) => updateParam("order", val)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ASCENDING">Naraščajoče</SelectItem>
            <SelectItem value="DESCENDING">Padajoče</SelectItem>
            <SelectItem value="NONE">Brez</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Store checkboxes */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Trgovine</span>
        {ALL_STORE_IDS.map((id) => (
          <label key={id} className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              checked={isStoreChecked(id)}
              onCheckedChange={(checked) =>
                handleStoreToggle(id, checked === true)
              }
            />
            <span className="text-sm capitalize">{STORE_MAP[id]}</span>
          </label>
        ))}
      </div>

      {/* Available only */}
      <label className="flex items-center gap-1.5 cursor-pointer">
        <Checkbox
          checked={available === "true"}
          onCheckedChange={(checked) =>
            updateParam("available", checked === true ? "true" : "false")
          }
        />
        <span className="text-sm">Na zalogi</span>
      </label>

      {/* Card discount */}
      <label className="flex items-center gap-1.5 cursor-pointer">
        <Checkbox
          checked={cardDiscount === "true"}
          onCheckedChange={(checked) =>
            updateParam("cardDiscount", checked === true ? "true" : "false")
          }
        />
        <span className="text-sm">Kartica ugodnosti</span>
      </label>
    </div>
  );
}
