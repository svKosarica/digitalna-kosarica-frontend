"use client";

import { useState } from "react";
import {
  FilterCheckboxRow,
  FilterPopover,
} from "@/components/shared/FilterPopover";
import { STORE_LOGOS } from "@/lib/store";
import { storeCountLabel } from "@/lib/utils";
import { ALL_STORES_LABEL, STORE_MAP } from "@/types/search.types";

const ALL_STORE_IDS = Object.keys(STORE_MAP).map(Number);

interface StoreMultiSelectProps {
  /**
   * Ids from the URL, already filtered to ids present in STORE_MAP. Empty means
   * every store, which is how the absent param is spelled.
   */
  selected: number[];
  /** Called on close with a sorted list. Empty means "drop the param". */
  onCommit: (ids: number[]) => void;
}

function sorted(ids: number[]): number[] {
  return [...ids].sort((a, b) => a - b);
}

/**
 * Store filter over a flat list, where checking a row means "include this one".
 *
 * Additive, like CategoryMultiSelect: an empty draft means every store, and the
 * draft holds ids in the exact form they go on the wire. That is the same
 * spelling the URL param and the API already use — storeIds: [] is read as
 * "every store" — so no state here needs translating on the way out, and the
 * two filters in the toolbar answer a click the same way.
 *
 * The cost is that excluding a single store means checking the other four. The
 * subtractive alternative bought that one gesture at the price of a draft whose
 * "all" was spelled differently from the URL's, and of unchecking the last box
 * silently re-selecting every store — zero stores being a state the API cannot
 * express.
 */
export function StoreMultiSelect({ selected, onCommit }: StoreMultiSelectProps) {
  const [draft, setDraft] = useState<number[]>(selected);

  function handleOpenChange(open: boolean) {
    if (open) {
      // Opening is the sync point, so no effect has to watch the param and a
      // filter reset from a new search cannot leave a stale draft behind.
      setDraft(selected);
      return;
    }
    // One navigation per session of edits, not one per checkbox.
    if (sorted(selected).join(",") !== sorted(draft).join(",")) {
      onCommit(sorted(draft));
    }
  }

  function toggle(id: number) {
    // Reads `current` rather than the render-time draft so two toggles batched
    // into one commit cannot have the second discard the first.
    setDraft((current) =>
      current.includes(id)
        ? current.filter((storeId) => storeId !== id)
        : [...current, id],
    );
  }

  const label =
    draft.length === 0
      ? ALL_STORES_LABEL
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
          checked={draft.length === 0}
          onToggle={() => setDraft([])}
          label={ALL_STORES_LABEL}
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
