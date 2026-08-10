"use client";

import { useState } from "react";
import {
  FilterCheckboxRow,
  FilterPopover,
} from "@/components/shared/FilterPopover";
import { STORE_LOGOS } from "@/lib/store";
import { storeCountLabel } from "@/lib/utils";
import { STORE_MAP } from "@/types/search.types";

const ALL_STORE_IDS = Object.keys(STORE_MAP).map(Number);

interface StoreMultiSelectProps {
  /**
   * Ids from the URL, already filtered to ids present in STORE_MAP. Empty means
   * every store, which is how the absent param is spelled.
   */
  selected: number[];
  /** Called on close with a canonical list. Empty means "drop the param". */
  onCommit: (ids: number[]) => void;
}

/**
 * "Everything selected" has two spellings — an empty list and the full list —
 * so both sides of every comparison go through this. The URL uses the empty
 * form; the draft uses the full one, because that is what lets the first
 * uncheck mean "all except this".
 */
function canonical(ids: number[]): number[] {
  if (ids.length === 0 || ids.length === ALL_STORE_IDS.length) return [];
  return [...ids].sort((a, b) => a - b);
}

export function StoreMultiSelect({ selected, onCommit }: StoreMultiSelectProps) {
  const [draft, setDraft] = useState<number[]>(
    selected.length ? selected : ALL_STORE_IDS,
  );

  function handleOpenChange(open: boolean) {
    if (open) {
      // Opening is the sync point, so no effect has to watch the param and a
      // filter reset from a new search cannot leave a stale draft behind.
      setDraft(selected.length ? selected : ALL_STORE_IDS);
      return;
    }
    // One navigation per session of edits, not one per checkbox.
    if (canonical(selected).join(",") !== canonical(draft).join(",")) {
      onCommit(canonical(draft));
    }
  }

  function toggle(id: number) {
    setDraft((current) => {
      if (!current.includes(id)) return [...current, id];
      const next = current.filter((storeId) => storeId !== id);
      // Zero stores is not a state the UI can mean: the API reads storeIds: []
      // as "every store", so unchecking the last box would show more, not less.
      return next.length ? next : ALL_STORE_IDS;
    });
  }

  const allSelected = draft.length === ALL_STORE_IDS.length;

  const label = allSelected
    ? "Vse trgovine"
    : draft.length === 1
      ? STORE_LOGOS[STORE_MAP[draft[0]]].label
      : storeCountLabel(draft.length);

  return (
    <FilterPopover
      label={label}
      triggerClassName="w-full sm:w-[160px]"
      onOpenChange={handleOpenChange}
      header={
        <FilterCheckboxRow
          id="store-all"
          checked={allSelected}
          onToggle={() => setDraft(ALL_STORE_IDS)}
          label="Vse trgovine"
        />
      }
    >
      {ALL_STORE_IDS.map((id) => (
        <FilterCheckboxRow
          key={id}
          id={`store-${id}`}
          checked={draft.includes(id)}
          onToggle={() => toggle(id)}
          label={STORE_LOGOS[STORE_MAP[id]].label}
        />
      ))}
    </FilterPopover>
  );
}
