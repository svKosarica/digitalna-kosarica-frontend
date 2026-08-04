"use client";

import { useState } from "react";
import {
  FilterCheckboxRow,
  FilterPopover,
} from "@/components/shared/FilterPopover";
import { buildCategoryTree, categoryCountLabel } from "@/lib/utils";
import { ALL_CATEGORIES_LABEL } from "@/types/search.types";
import type { Category } from "@/types/search.types";

interface CategoryMultiSelectProps {
  /** Flat list from GET /categories. Empty when the endpoint fails or 204s. */
  categories: Category[];
  /** Ids from the URL, in wire form: a parent id where a parent is rolled up. */
  selected: number[];
  /** Called on close. Empty means "drop the param". */
  onCommit: (ids: number[]) => void;
}

function sorted(ids: number[]): number[] {
  return [...ids].sort((a, b) => a - b);
}

/**
 * Two-level category filter whose parent rows are the rollups.
 *
 * The draft holds ids exactly as they go on the wire: a parent id when that
 * parent is rolled up, child ids otherwise. That is possible because a parent
 * id already matches its children server-side — [2,21] and [2] return the same
 * rows — so a rollup never needs its children listed alongside it.
 */
export function CategoryMultiSelect({
  categories,
  selected,
  onCommit,
}: CategoryMultiSelectProps) {
  const tree = buildCategoryTree(categories);
  const knownIds = new Set(categories.map((category) => category.id));

  // An id this build cannot name — a stale bookmark, or one the API dropped —
  // is rendered nowhere, so carrying it in the draft would silently re-commit a
  // filter the visitor can neither see nor clear.
  const syncFromUrl = () => selected.filter((id) => knownIds.has(id));

  const [draft, setDraft] = useState<number[]>(syncFromUrl);

  function handleOpenChange(open: boolean) {
    if (open) {
      setDraft(syncFromUrl());
      return;
    }
    // Compared against the raw param, not the filtered draft, so a stale id
    // counts as a difference and gets dropped on the first commit.
    if (sorted(selected).join(",") !== sorted(draft).join(",")) {
      onCommit(sorted(draft));
    }
  }

  function toggleParent(parent: Category, children: Category[]) {
    setDraft((current) => {
      const childIds = children.map((child) => child.id);
      const isOn =
        current.includes(parent.id) ||
        childIds.some((id) => current.includes(id));
      const without = current.filter(
        (id) => id !== parent.id && !childIds.includes(id),
      );
      // Rolling up drops the children: the parent id already covers them, so
      // keeping both would be redundant, never additive.
      return isOn ? without : [...without, parent.id];
    });
  }

  function toggleChild(
    parent: Category,
    children: Category[],
    child: Category,
  ) {
    setDraft((current) => {
      if (current.includes(parent.id)) {
        // Expand the rollup to the remaining siblings. This is the one place the
        // filter narrows further than asked: products filed on the parent with
        // no subcategory drop out — 991 of 4915 for Pijače — and no combination
        // of child ids can express "parent minus one child". The visible result
        // count changing is the only signal available.
        return [
          ...current.filter((id) => id !== parent.id),
          ...children
            .filter((sibling) => sibling.id !== child.id)
            .map((sibling) => sibling.id),
        ];
      }
      return current.includes(child.id)
        ? current.filter((id) => id !== child.id)
        : [...current, child.id];
    });
  }

  function parentState(
    parent: Category,
    children: Category[],
  ): boolean | "indeterminate" {
    if (draft.includes(parent.id)) return true;
    return children.some((child) => draft.includes(child.id))
      ? "indeterminate"
      : false;
  }

  const label =
    draft.length === 0
      ? ALL_CATEGORIES_LABEL
      : draft.length === 1
        ? (categories.find((category) => category.id === draft[0])?.name ??
          ALL_CATEGORIES_LABEL)
        : categoryCountLabel(draft.length);

  return (
    <FilterPopover
      label={label}
      triggerClassName="w-full sm:w-[180px]"
      contentClassName="w-72"
      onOpenChange={handleOpenChange}
      header={
        <FilterCheckboxRow
          id="category-all"
          checked={draft.length === 0}
          onToggle={() => setDraft([])}
          label={ALL_CATEGORIES_LABEL}
        />
      }
    >
      {tree.map(({ parent, children }) => (
        <div key={parent.id}>
          <FilterCheckboxRow
            id={`category-${parent.id}`}
            checked={parentState(parent, children)}
            onToggle={() => toggleParent(parent, children)}
            label={parent.name}
          />
          {children.map((child) => (
            <FilterCheckboxRow
              key={child.id}
              id={`category-${child.id}`}
              checked={draft.includes(parent.id) || draft.includes(child.id)}
              onToggle={() => toggleChild(parent, children, child)}
              label={child.name}
              className="pl-6"
            />
          ))}
        </div>
      ))}
    </FilterPopover>
  );
}
