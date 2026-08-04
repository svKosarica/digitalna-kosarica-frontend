"use client";

import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface FilterPopoverProps {
  /** Rendered in the trigger, e.g. "Vse trgovine" / "Spar" / "2 trgovini". */
  label: string;
  /** Trigger width, matching the Select triggers beside it. */
  triggerClassName?: string;
  /** Popover width, e.g. "w-72". */
  contentClassName?: string;
  /** Pinned above the scroll area — the "Vse …" reset row. */
  header: React.ReactNode;
  /** The scrolling checkbox list. */
  children: React.ReactNode;
  onOpenChange: (open: boolean) => void;
}

/**
 * Presentational shell for a multi-select filter. Holds no selection state:
 * the caller owns the draft and commits it when onOpenChange reports a close.
 */
export function FilterPopover({
  label,
  triggerClassName,
  contentClassName,
  header,
  children,
  onOpenChange,
}: FilterPopoverProps) {
  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger
        className={cn(
          "flex h-9 items-center justify-between gap-2 rounded-md border border-border bg-card px-3 text-sm font-bold text-foreground cursor-pointer",
          triggerClassName,
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      {/* p-0 replaces PopoverContent's own p-4 so the pinned header sits flush
          above the scroll area. The max-h clamp lives on the content rather
          than the scroller so the header counts towards it; min() keeps the
          viewport clamp a bare max-h would lose. cn is twMerge, so the width
          and padding override rather than layer. */}
      <PopoverContent
        align="start"
        className={cn(
          "flex flex-col p-0 w-64 max-h-[min(380px,var(--radix-popover-content-available-height))] max-w-[calc(100vw-2rem)] bg-card border-border",
          contentClassName,
        )}
      >
        <div className="shrink-0 border-b border-border/50 p-2">{header}</div>
        <div className="overflow-y-auto p-2">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

interface FilterCheckboxRowProps {
  /** Must be unique on the page — it wires the Label to the Checkbox. */
  id: string;
  checked: boolean | "indeterminate";
  onToggle: () => void;
  label: string;
  /** Extra row classes, e.g. "pl-6" for a subcategory. */
  className?: string;
}

/**
 * Checkbox plus its label as one row.
 *
 * Separate elements wired by id rather than a wrapping <label>, matching how
 * the switches in SearchFilters are already built. Radix's Checkbox root is a
 * <button>, which is a labelable element, so htmlFor forwards clicks to it.
 */
export function FilterCheckboxRow({
  id,
  checked,
  onToggle,
  label,
  className,
}: FilterCheckboxRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary",
        className,
      )}
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      <Label
        htmlFor={id}
        className="flex-1 cursor-pointer text-sm font-semibold text-foreground"
      >
        {label}
      </Label>
    </div>
  );
}
