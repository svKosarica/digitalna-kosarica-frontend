/**
 * Shared chrome for the grid/list view toggle.
 *
 * One copy, because /search and /primerjava render the same control in the same
 * toolbar shell and had drifted: two identical sets of these constants, but
 * different icon sizes and different toolbar padding either side of them.
 *
 * border-transparent in the base keeps the button from shifting 1px when the
 * active state adds its border.
 */
export const TOGGLE_BASE =
  "p-2 rounded-lg border border-transparent transition-colors cursor-pointer";
export const TOGGLE_ON = "bg-card text-primary border-primary/30";
export const TOGGLE_OFF = "text-muted-foreground/40 hover:text-primary";

/**
 * The "visitor has not chosen" state. Both toolbars follow the results, which
 * switch from rows to cards at `sm`, so the lit icon has to switch there too —
 * a flat `view === "grid" ? ON : OFF` left both icons dark on arrival.
 */
export const TOGGLE_GRID_UNSET = [
  TOGGLE_OFF,
  "sm:bg-card sm:text-primary sm:border-primary/30",
];
export const TOGGLE_LIST_UNSET = [
  TOGGLE_ON,
  "sm:bg-transparent sm:text-muted-foreground/40 sm:border-transparent sm:hover:text-primary",
];

/** The toolbar shell both filter bars sit in. */
export const FILTER_BAR =
  "bg-secondary p-3 sm:p-4 rounded-xl border border-border/30";
