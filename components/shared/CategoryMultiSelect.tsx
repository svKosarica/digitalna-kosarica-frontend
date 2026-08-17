"use client";

import { useState } from "react";
import {
  FilterCheckboxRow,
  FilterPopover,
} from "@/components/shared/FilterPopover";
import { buildCategoryTree, categoryCountLabel } from "@/lib/utils";
import { ALL_CATEGORIES_LABEL } from "@/types/search.types";
import type { Category, CategoryTreeNode } from "@/types/search.types";

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

/** One rendered row: the category, how deep it sits, and its root-to-node path. */
interface CategoryRow {
  category: Category;
  depth: number;
  /** Ids from the root down to and including this category. */
  path: number[];
}

/**
 * Flattens the forest into render order — a category immediately followed by its
 * own subtree, which is the order the API already sends.
 */
function toRows(tree: CategoryTreeNode[]): CategoryRow[] {
  const rows: CategoryRow[] = [];

  function walk(nodes: CategoryTreeNode[], depth: number, ancestors: number[]) {
    for (const node of nodes) {
      const path = [...ancestors, node.category.id];
      rows.push({ category: node.category, depth, path });
      walk(node.children, depth + 1, path);
    }
  }

  walk(tree, 0, []);
  return rows;
}

function indexById(tree: CategoryTreeNode[]): Map<number, CategoryTreeNode> {
  const byId = new Map<number, CategoryTreeNode>();

  function walk(nodes: CategoryTreeNode[]) {
    for (const node of nodes) {
      byId.set(node.category.id, node);
      walk(node.children);
    }
  }

  walk(tree);
  return byId;
}

/** Every id beneath this node, at any depth. */
function descendantIds(node: CategoryTreeNode | undefined): number[] {
  if (!node) return [];
  return node.children.flatMap((child) => [
    child.category.id,
    ...descendantIds(child),
  ]);
}

// Indent per level. Clamped rather than multiplied so a branch deeper than the
// drinks one cannot push labels off the 288px popover; past this depth siblings
// share an indent, which reads worse than truncating.
const INDENT_BY_DEPTH = ["", "pl-6", "pl-10", "pl-14"] as const;

function indentClass(depth: number): string {
  return INDENT_BY_DEPTH[Math.min(depth, INDENT_BY_DEPTH.length - 1)];
}

/**
 * Category filter over a tree of any depth, where every row is a rollup of its
 * own subtree.
 *
 * The draft holds ids exactly as they go on the wire: the highest rolled-up id
 * of a branch, never that id alongside its own descendants. That is possible
 * because an id already matches its whole subtree server-side — [4,22,41] and
 * [4] return the same rows — so a rollup never needs its descendants listed.
 * Toggling maintains that invariant, which is why at most one ancestor of any
 * row can be in the draft.
 */
export function CategoryMultiSelect({
  categories,
  selected,
  onCommit,
}: CategoryMultiSelectProps) {
  const tree = buildCategoryTree(categories);
  const rows = toRows(tree);
  const nodesById = indexById(tree);

  // Reachable in the tree, not merely present in the flat list: a category
  // orphaned by a parentCategoryId pointing nowhere is rendered nowhere, so
  // carrying it in the draft would silently re-commit a filter the visitor can
  // neither see nor clear.
  const renderableIds = new Set(rows.map((row) => row.category.id));

  const syncFromUrl = () => selected.filter((id) => renderableIds.has(id));

  const [draft, setDraft] = useState<number[]>(syncFromUrl);
  const inDraft = new Set(draft);

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

  /** The rolled-up ancestor covering this row, if any. */
  function coveringAncestor(
    row: CategoryRow,
    held: Set<number>,
  ): number | undefined {
    return row.path.slice(0, -1).find((id) => held.has(id));
  }

  function toggle(row: CategoryRow) {
    const id = row.category.id;
    const descendants = descendantIds(nodesById.get(id));

    // Every decision below reads `current` rather than the render-time draft:
    // two toggles batched into one commit would otherwise both compute against
    // the pre-batch state and the second would discard the first.
    setDraft((current) => {
      const currentSet = new Set(current);
      const covering = coveringAncestor(row, currentSet);

      if (covering !== undefined) {
        // Expand the rollup along the path from that ancestor down to this row,
        // keeping every branch it passes. This is the one place the filter
        // narrows further than asked: products filed on a passed-over ancestor
        // with no subcategory drop out — 991 of 4915 for Pijače — and no set of
        // ids can express "ancestor minus one descendant". The visible result
        // count changing is the only signal available.
        const chain = row.path.slice(row.path.indexOf(covering));
        const siblings = chain.slice(0, -1).flatMap((stepId, index) =>
          (nodesById.get(stepId)?.children ?? [])
            .map((child) => child.category.id)
            .filter((childId) => childId !== chain[index + 1]),
        );
        return [...current.filter((held) => held !== covering), ...siblings];
      }

      const descendantSet = new Set(descendants);
      const isOn =
        currentSet.has(id) || descendants.some((d) => currentSet.has(d));
      const without = current.filter(
        (held) => held !== id && !descendantSet.has(held),
      );
      // Rolling up drops the descendants: this id already covers them, so
      // keeping both would be redundant, never additive.
      return isOn ? without : [...without, id];
    });
  }

  function rowState(row: CategoryRow): boolean | "indeterminate" {
    if (
      inDraft.has(row.category.id) ||
      coveringAncestor(row, inDraft) !== undefined
    ) {
      return true;
    }
    return descendantIds(nodesById.get(row.category.id)).some((id) =>
      inDraft.has(id),
    )
      ? "indeterminate"
      : false;
  }

  const label =
    draft.length === 0
      ? ALL_CATEGORIES_LABEL
      : draft.length === 1
        ? (nodesById.get(draft[0])?.category.name ?? ALL_CATEGORIES_LABEL)
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
      {rows.map((row) => (
        <FilterCheckboxRow
          key={row.category.id}
          id={`category-${row.category.id}`}
          checked={rowState(row)}
          onToggle={() => toggle(row)}
          label={row.category.name}
          className={indentClass(row.depth)}
        />
      ))}
    </FilterPopover>
  );
}
