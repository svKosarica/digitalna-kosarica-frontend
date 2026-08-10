# Card-Discount Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show, in Slovenian, on every surface that renders a price, when that price is only available with the store's loyalty card.

**Architecture:** `cardDiscount: boolean` already arrives from the API on every `DiscountItem` and every `PriceHistoryEntry`, so no API or response-type work is needed — this is prop-threading plus one new shared component. A single `CardDiscountMark` owns the icon, the tooltip, the accessibility wiring, and all three Slovenian strings, so the copy exists in exactly one file. The only type change anywhere is one optional field on the client-side `CartItem`.

**Tech Stack:** Next.js 16 App Router (server components), React 19, Tailwind v4, Radix primitives via shadcn (`components/ui/`), `lucide-react` icons, Recharts via `components/ui/chart.tsx`, `pnpm`.

**Spec:** `docs/superpowers/specs/2026-08-06-card-discount-indicator-design.md`. Read it before Task 1.

## Global Constraints

- **Work only on the `development` branch.** Never create, switch to, or commit on another branch. Verify with `git branch --show-current` before the first commit.
- **No test files.** This repo has none and adds none. Every task is verified in Chrome against `pnpm dev` on `http://localhost:3000`. This overrides the usual write-a-failing-test-first cycle.
- **`npx tsc --noEmit` must exit 0** before every commit. It is clean at baseline (verified 2026-08-06).
- **`npx eslint app components lib types` reports exactly 2 errors at baseline**, both pre-existing `react-hooks/set-state-in-effect`: `components/shared/SearchBar.tsx:16` and `lib/cart.tsx:71`. **The gate is that this count does not increase** — never "lint passes". Task 4 modifies `lib/cart.tsx`; do not touch its `useEffect` at line 70-73 and the count stays at 2.
- **All user-facing copy is Slovenian.** Never introduce an English string into the UI.
- **Never write a card-discount string inline.** Import `CARD_DISCOUNT_LABEL`, `CARD_DISCOUNT_CHART_NOTE`, or `CARD_DISCOUNT_TOTAL_NOTE` from `components/shared/CardDiscountMark`. The existing detail-page pill reads "Zvestobni popus" — a typo — precisely because the string was written inline.
- **`cardDiscount === false` renders nothing.** No greyed-out icon, no "redna cena" counter-label, anywhere.
- **`components/ui/tooltip.tsx`'s `Tooltip` already wraps `TooltipProvider` internally** (see `components/ui/tooltip.tsx:21-29`). Do not add another `TooltipProvider` — `Tooltip` + `TooltipTrigger` + `TooltipContent` is the complete set.
- The dev server is at `http://localhost:3000`. Start it with `pnpm dev` and leave it running across all four tasks; Next.js hot-reloads every change below.
- **Finding test data:** `http://localhost:3000/search?cardDiscount=true` uses the existing server-side filter and returns *only* card-discounted products — every row there must show the indicator. Plain `http://localhost:3000/search` returns a mix; Hofer listings are the reliable negative case (Hofer runs no loyalty card).

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `components/shared/CardDiscountMark.tsx` | **New.** Owns the icon+tooltip mark, the labelled badge, and all three Slovenian strings. | 1 |
| `app/(main)/product/[product_id]/page.tsx` | Detail page: swaps its inline typo'd pill for the badge; later passes the flag into the cart. | 1, 4 |
| `components/shared/ProductCard.tsx` | Grid card: accepts and renders the flag; later writes it to the cart. | 2, 4 |
| `components/shared/ProductCardList.tsx` | List row (mobile + `sm+`): same. | 2, 4 |
| `components/shared/ProductResults.tsx` | Prop builder for `/popular`, `/top-discounts`. | 2 |
| `app/(main)/search/page.tsx` | Prop builder for `/search`. | 2 |
| `components/shared/ProductScrollSection.tsx` | Inline props for the home-page rails and "Sorodni izdelki". | 2 |
| `components/shared/PriceHistoryChart.tsx` | Carries the per-point flag through `buildSeries` into the tooltip. | 3 |
| `lib/cart.tsx` | `CartItem` gains one optional field. | 4 |
| `components/shared/BasketItemCard.tsx` | Basket row: icon beside the line total. | 4 |
| `app/(main)/basket/page.tsx` | Summary note under the grand total. | 4 |

The three prop builders are **deliberately not merged.** They differ on purpose — `search/page.tsx` hides a negative `discountPct` while `ProductResults.tsx` flips the badge to its "increase" variant — and both carry comments explaining why. Do not refactor them.

---

### Task 1: The shared mark, and the detail-page badge

Creates the component and puts it to work in the one place that already had a (broken) indicator. Verifiable on its own: the detail page stops saying "Zvestobni popus".

**Files:**
- Create: `components/shared/CardDiscountMark.tsx`
- Modify: `app/(main)/product/[product_id]/page.tsx:138-142`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `CardDiscountMark({ variant?: "icon" | "badge", iconClassName?: string, className?: string })` — a named (not default) export. Also the named string constants `CARD_DISCOUNT_LABEL`, `CARD_DISCOUNT_CHART_NOTE`, `CARD_DISCOUNT_TOTAL_NOTE`. Tasks 2, 3 and 4 all import from this module.

- [ ] **Step 1: Create the component**

Create `components/shared/CardDiscountMark.tsx` with exactly this content:

```tsx
"use client";

import { CreditCard } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Tooltip text, badge text, and aria-label on the mark itself. */
export const CARD_DISCOUNT_LABEL = "Cena s kartico ugodnosti";

/** Chart tooltip line. Shorter: the tooltip already says "Cena" above it. */
export const CARD_DISCOUNT_CHART_NOTE = "S kartico ugodnosti";

/** Basket summary note under the grand total. */
export const CARD_DISCOUNT_TOTAL_NOTE =
  "Seštevek vključuje cene s kartico ugodnosti.";

interface CardDiscountMarkProps {
  /**
   * "icon" is a bare card glyph with a tooltip, for the price rows on cards,
   * list rows and basket lines, where there is no room for a label. "badge"
   * is the labelled pill the detail page shows beside the availability chip.
   */
  variant?: "icon" | "badge";
  /** Tailwind size for the glyph in the "icon" variant. Defaults to size-4. */
  iconClassName?: string;
  className?: string;
}

/**
 * Marks a price as conditional on the store's loyalty card.
 *
 * Renders nothing on its own account — callers guard on the listing's
 * `cardDiscount`, because a "no loyalty card needed" marker would be noise on
 * the majority of rows.
 */
export function CardDiscountMark({
  variant = "icon",
  iconClassName,
  className,
}: CardDiscountMarkProps) {
  if (variant === "badge") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-secondary text-foreground",
          className,
        )}
      >
        <CreditCard className="size-3.5 shrink-0" aria-hidden="true" />
        {CARD_DISCOUNT_LABEL}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A span, not a button: this renders inside the card's <Link>, and a
            span never swallows the navigation, so no call site needs a
            preventDefault. tabIndex keeps it reachable by keyboard, which is
            the only way besides hover to open a Radix tooltip. */}
        <span
          role="img"
          tabIndex={0}
          aria-label={CARD_DISCOUNT_LABEL}
          className={cn("inline-flex text-primary cursor-help", className)}
        >
          <CreditCard
            className={cn("size-4", iconClassName)}
            aria-hidden="true"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{CARD_DISCOUNT_LABEL}</TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 2: Replace the detail page's typo'd pill**

In `app/(main)/product/[product_id]/page.tsx`, find this block at lines 138-142:

```tsx
              {cardDiscount && (
                <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-secondary text-foreground">
                  Zvestobni popus
                </span>
              )}
```

Replace it with:

```tsx
              {cardDiscount && <CardDiscountMark variant="badge" />}
```

- [ ] **Step 3: Add the import**

In the same file, after the existing import on line 12 (`import { AddToCartButton } from "@/components/shared/AddToCartButton";`), add:

```tsx
import { CardDiscountMark } from "@/components/shared/CardDiscountMark";
```

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit
npx eslint app components lib types
```

Expected: `tsc` exits 0 with no output. `eslint` reports exactly 2 errors (`SearchBar.tsx:16`, `lib/cart.tsx:71`) — the unchanged baseline.

- [ ] **Step 5: Verify in Chrome**

1. Open `http://localhost:3000/search?cardDiscount=true` and click into the first product.
2. Beside the green "Na zalogi" chip there must be a pill reading **"Cena s kartico ugodnosti"** with a small card glyph, and no text is cut off.
3. The old "Zvestobni popus" must appear nowhere on the page.
4. Open a Hofer product from plain `http://localhost:3000/search` — no pill at all beside "Na zalogi".

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # must print: development
git add components/shared/CardDiscountMark.tsx "app/(main)/product/[product_id]/page.tsx"
git commit -m "feat: add CardDiscountMark and fix the detail page badge typo"
```

---

### Task 2: Listing surfaces

Threads the flag through both card components and all three prop builders. One deliverable: every listing page marks card prices.

**Files:**
- Modify: `components/shared/ProductCard.tsx:17-36, 38-53, 177-187`
- Modify: `components/shared/ProductCardList.tsx:11-30, 32-47, 146-165, 197-216`
- Modify: `components/shared/ProductResults.tsx:24-43`
- Modify: `app/(main)/search/page.tsx:24-41`
- Modify: `components/shared/ProductScrollSection.tsx:118-139`

**Interfaces:**
- Consumes: `CardDiscountMark` from Task 1.
- Produces: `ProductCardProps` and `ProductCardListProps` each gain `cardDiscount?: boolean`, defaulting to `false`. Task 4 adds cart writes to these same two files.

- [ ] **Step 1: Add the prop to `ProductCard`**

In `components/shared/ProductCard.tsx`, in the `ProductCardProps` interface, after `stores?: StoreName[];` (line 34) add:

```tsx
  /** True when this price only applies with the store's loyalty card. */
  cardDiscount?: boolean;
```

In the destructuring parameter list, after `stores = [],` (line 51) add:

```tsx
  cardDiscount = false,
```

Add the import after line 7 (`import { ProductImage } ...`):

```tsx
import { CardDiscountMark } from "@/components/shared/CardDiscountMark";
```

- [ ] **Step 2: Render it in `ProductCard`'s price row**

In the same file, find the price row at lines 177-187 and add one line before the closing `</div>`:

```tsx
          <div className="flex items-center gap-1">
            <p className="text-2xl font-bold text-foreground">
              {price} {currency}
            </p>
            {priceDir === "up" && (
              <ArrowUp className="size-4 text-red-500" strokeWidth={3} aria-label="Cena narasla" />
            )}
            {priceDir === "down" && (
              <ArrowDown className="size-4 text-green-600" strokeWidth={3} aria-label="Cena padla" />
            )}
            {cardDiscount && <CardDiscountMark />}
          </div>
```

Nothing here wraps onto a new line, so the card's fixed `h-[380px]` is unaffected.

- [ ] **Step 3: Add the prop to `ProductCardList`**

In `components/shared/ProductCardList.tsx`, in `ProductCardListProps`, after `stores?: StoreName[];` (line 28) add:

```tsx
  /** True when this price only applies with the store's loyalty card. */
  cardDiscount?: boolean;
```

In the destructuring list, after `stores = [],` (line 45) add:

```tsx
  cardDiscount = false,
```

Add the import after line 7:

```tsx
import { CardDiscountMark } from "@/components/shared/CardDiscountMark";
```

- [ ] **Step 4: Render it in both `ProductCardList` price rows**

The mobile row at lines 146-165 — add one line after the `oldPrice` block, before the closing `</div>`:

```tsx
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-lg font-bold text-foreground">
              {price} {currency}
            </span>
            {priceDir === "up" && (
              <ArrowUp className="size-3.5 self-center text-red-500" strokeWidth={3} aria-label="Cena narasla" />
            )}
            {priceDir === "down" && (
              <ArrowDown className="size-3.5 self-center text-green-600" strokeWidth={3} aria-label="Cena padla" />
            )}
            {oldPrice && (
              <span
                className={`text-xs font-semibold text-accent-foreground ${
                  isIncrease ? "" : "line-through"
                }`}
              >
                {oldPrice} {currency}
              </span>
            )}
            {cardDiscount && (
              <CardDiscountMark iconClassName="size-3.5" className="self-center" />
            )}
          </div>
```

The `sm+` row at lines 197-216 — same treatment, full size glyph:

```tsx
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-foreground">
              {price} {currency}
            </span>
            {priceDir === "up" && (
              <ArrowUp className="size-4 self-center text-red-500" strokeWidth={3} aria-label="Cena narasla" />
            )}
            {priceDir === "down" && (
              <ArrowDown className="size-4 self-center text-green-600" strokeWidth={3} aria-label="Cena padla" />
            )}
            {oldPrice && (
              <span
                className={`text-sm font-semibold text-accent-foreground ${
                  isIncrease ? "" : "line-through"
                }`}
              >
                {oldPrice} {currency}
              </span>
            )}
            {cardDiscount && <CardDiscountMark className="self-center" />}
          </div>
```

`self-center` matches how the arrows already opt out of the row's `items-baseline`.

- [ ] **Step 5: Feed the flag from all three prop builders**

In `components/shared/ProductResults.tsx`, inside the object returned by `cardProps`, after the `discountPct` line (line 38) add:

```tsx
    cardDiscount: item.cardDiscount,
```

In `app/(main)/search/page.tsx`, inside its `cardProps`, after the `discountPct` block (lines 38-39) add the same line:

```tsx
    cardDiscount: item.cardDiscount,
```

In `components/shared/ProductScrollSection.tsx`, in the inline `<ProductCard ... />` JSX, after `badgeVariant={badgeVariant}` (line 133) add:

```tsx
              cardDiscount={item.cardDiscount}
```

No import is needed in any of these three — they pass data, they do not render the mark.

- [ ] **Step 6: Typecheck and lint**

```bash
npx tsc --noEmit
npx eslint app components lib types
```

Expected: `tsc` exits 0. `eslint` still reports exactly 2 errors.

- [ ] **Step 7: Verify in Chrome**

1. `http://localhost:3000/search?cardDiscount=true` — **every** grid card shows the card glyph immediately right of its price. Hover one: the tooltip reads "Cena s kartico ugodnosti".
2. Press `Tab` until the glyph takes focus — the tooltip must open on focus alone, without a mouse.
3. Click the glyph — it must navigate to the product detail page, not swallow the click.
4. Switch to list view (the list icon in the filter bar) — glyph present in the `sm+` row.
5. Narrow the window below `640px` — glyph present in the dense mobile row, slightly smaller, vertically centred against the price.
6. `http://localhost:3000/` — the home-page rails show the glyph on card-priced items.
7. `http://localhost:3000/popular` and `/top-discounts` — same.
8. Confirm a Hofer row anywhere shows no glyph.
9. Confirm no card grew taller: the grid rows must still be even.

- [ ] **Step 8: Commit**

```bash
git branch --show-current   # must print: development
git add components/shared/ProductCard.tsx components/shared/ProductCardList.tsx components/shared/ProductResults.tsx components/shared/ProductScrollSection.tsx "app/(main)/search/page.tsx"
git commit -m "feat: mark card-discount prices on product cards and list rows"
```

---

### Task 3: Price-history chart tooltip

The per-point flag already arrives from the API but `buildSeries` discards it. Three edits in one file.

**Files:**
- Modify: `components/shared/PriceHistoryChart.tsx:65-108, 168-177`

**Interfaces:**
- Consumes: `CARD_DISCOUNT_CHART_NOTE` from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Carry the flag through `buildSeries`**

In `components/shared/PriceHistoryChart.tsx`, replace lines 75-98 (from `let points` through the end of the `mapped` assignment) with:

```tsx
  let points: { timestamp: string; price: number; cardDiscount: boolean }[] =
    daily;

  if (months !== null) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const inWindow = daily.filter((p) => new Date(p.timestamp) >= cutoff);
    const before = daily.filter((p) => new Date(p.timestamp) < cutoff);

    // Carry forward the last known reading (or the earliest point if all are
    // inside the window) so the line has a starting anchor at the window edge.
    // The whole reading is carried, not just its price: an anchor built from a
    // card-priced day is still a card price, and copying the price alone would
    // silently redraw it as a regular one.
    const anchor =
      before.length > 0 ? before[before.length - 1] : (inWindow[0] ?? daily[0]);

    points = [
      {
        timestamp: cutoff.toISOString(),
        price: anchor.price,
        cardDiscount: anchor.cardDiscount,
      },
      ...inWindow,
    ];
  }

  const mapped = points.map((entry) => ({
    time: new Date(entry.timestamp).getTime(),
    date: formatDate(entry.timestamp),
    price: entry.price,
    cardDiscount: entry.cardDiscount,
  }));
```

The single-point flat-line case below at lines 102-105 already spreads `{...mapped[0]}`, so it carries the flag with no change.

- [ ] **Step 2: Add the note to the tooltip**

In the same file, replace the `<ChartTooltip>` block at lines 168-177 with:

```tsx
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    formatDate(new Date(payload?.[0]?.payload?.time).toISOString())
                  }
                  formatter={(value, _name, item) => (
                    <>
                      <span className="font-medium text-foreground">
                        {Number(value).toFixed(2)} €
                      </span>
                      <span className="text-muted-foreground">Cena</span>
                      {(item?.payload as { cardDiscount?: boolean } | undefined)
                        ?.cardDiscount ? (
                        <span className="basis-full text-[11px] font-semibold text-primary">
                          {CARD_DISCOUNT_CHART_NOTE}
                        </span>
                      ) : null}
                    </>
                  )}
                />
              }
            />
```

The row this renders into is `flex w-full flex-wrap items-stretch gap-2` (`components/ui/chart.tsx:211`), so `basis-full` on the third child is what drops the note onto its own line — and only when the flag is set.

- [ ] **Step 3: Add the import**

After line 18 (`import type { PriceHistoryEntry } ...`) add:

```tsx
import { CARD_DISCOUNT_CHART_NOTE } from "@/components/shared/CardDiscountMark";
```

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit
npx eslint app components lib types
```

Expected: `tsc` exits 0. `eslint` still reports exactly 2 errors.

- [ ] **Step 5: Verify in Chrome**

1. From `http://localhost:3000/search?cardDiscount=true`, open a product whose "Zgodovina cen" chart has several points.
2. Hover a point — the tooltip shows the date, then `X,XX €  Cena`, then **"S kartico ugodnosti"** on its own line beneath.
3. Hover a point on a product from plain `/search` that is not card-priced — the third line must be absent, and the tooltip must not have grown a blank row.
4. Click "1 mes". If the product was card-priced before that window opened, the leftmost anchor point must still report "S kartico ugodnosti" — this is the carry-forward fix.
5. Click through "3 mes", "6 mes", "1 leto", "Vse" — no crash, the line still spans each window.
6. Confirm the line, the dots and the axes look exactly as before: no legend, no second dot colour, no shading.

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # must print: development
git add components/shared/PriceHistoryChart.tsx
git commit -m "feat: flag card-discount points in the price history tooltip"
```

---

### Task 4: Basket

Persists the flag with the cart and warns that the total may not be reachable at the till.

**Files:**
- Modify: `lib/cart.tsx:16-31`
- Modify: `components/shared/ProductCard.tsx:68-86`
- Modify: `components/shared/ProductCardList.tsx:62-80`
- Modify: `app/(main)/product/[product_id]/page.tsx:147-162`
- Modify: `components/shared/BasketItemCard.tsx:79-90`
- Modify: `app/(main)/basket/page.tsx:5, 133-138`

**Interfaces:**
- Consumes: `CardDiscountMark` and `CARD_DISCOUNT_TOTAL_NOTE` from Task 1; the `cardDiscount` props added to both card components in Task 2.
- Produces: `CartItem` gains `cardDiscount?: boolean`. `AddToCartButton` needs **no** change — it is typed `Omit<CartItem, "quantity">` and forwards whatever object it is handed.

- [ ] **Step 1: Add the optional field to `CartItem`**

In `lib/cart.tsx`, inside the `CartItem` interface, after the `size?: string;` field and its comment (line 30) add:

```tsx
  /**
   * True when the stored price only applies with the store's loyalty card.
   * Optional: carts persisted before this shipped have no flag, and undefined
   * is falsy, so they render nothing and need no migration.
   */
  cardDiscount?: boolean;
```

Do not touch the `useEffect` at lines 70-73 — it carries one of the two baseline lint errors.

- [ ] **Step 2: Write the flag from `ProductCard`**

In `components/shared/ProductCard.tsx`, in `handleAddToCart`, add one line to the `addItem` object after `size,` (line 82):

```tsx
    addItem({
      id,
      productName,
      brandName,
      imageUrl,
      price: parseFloat(price),
      oldPrice: oldPrice ? parseFloat(oldPrice) : undefined,
      discountPct,
      storeName: stores[0],
      size,
      cardDiscount,
    });
```

- [ ] **Step 3: Write the flag from `ProductCardList`**

In `components/shared/ProductCardList.tsx`, the identical addition in its `handleAddToCart` after `size,` (line 76):

```tsx
    addItem({
      id,
      productName,
      brandName,
      imageUrl,
      price: parseFloat(price),
      oldPrice: oldPrice ? parseFloat(oldPrice) : undefined,
      discountPct,
      storeName: stores[0],
      size,
      cardDiscount,
    });
```

- [ ] **Step 4: Write the flag from the detail page**

In `app/(main)/product/[product_id]/page.tsx`, in the `item` object passed to `<AddToCartButton>`, after `size: size ?? undefined,` (line 160) add:

```tsx
                    cardDiscount,
```

`cardDiscount` is already destructured off the response at line 39, so no other change is needed here.

- [ ] **Step 5: Show the icon on the basket row**

In `components/shared/BasketItemCard.tsx`, replace the price block at lines 79-90 with:

```tsx
            <div className="flex items-baseline gap-1.5 sm:flex-col sm:items-end sm:gap-0">
              <span className="flex items-center gap-1.5 text-base sm:text-lg font-bold text-foreground whitespace-nowrap">
                {lineTotal.toFixed(2)} &euro;
                {item.cardDiscount && (
                  <CardDiscountMark iconClassName="size-3.5" />
                )}
              </span>
              {item.quantity > 1 && (
                <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                  {/* "/ izdelek", not "/ kos": this is the per-cart-item price,
                      not the API's price-per-piece now shown beside it. */}
                  {item.price.toFixed(2)} &euro; / izdelek
                </span>
              )}
            </div>
```

Wrapping the total in a `flex items-center` span keeps the glyph beside the number in both the mobile row layout and the `sm+` column layout.

Add the import after line 6 (`import { ProductImage } ...`):

```tsx
import { CardDiscountMark } from "@/components/shared/CardDiscountMark";
```

- [ ] **Step 6: Add the summary note**

In `app/(main)/basket/page.tsx`, immediately after the `grandTotal` `useMemo` (line 41) add:

```tsx
  // A plain expression, not a useMemo: one pass over a hand-sized cart.
  const hasCardDiscount = items.some((i) => i.cardDiscount);
```

Then replace the "Skupaj" block at lines 133-138 with:

```tsx
            <div className="mt-6 pt-6 border-t border-border/30 flex items-center justify-between">
              <span className="text-foreground font-semibold">Skupaj</span>
              <span className="text-2xl font-extrabold text-primary">
                {grandTotal.toFixed(2)} &euro;
              </span>
            </div>

            {/* Under the grand total rather than per store: the point is that
                the number as a whole may not be reachable at the till. */}
            {hasCardDiscount && (
              <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <CreditCard className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                {CARD_DISCOUNT_TOTAL_NOTE}
              </p>
            )}
```

Change the lucide import on line 5 to add `CreditCard`:

```tsx
import { ShoppingCart, Trash2, Download, CreditCard } from "lucide-react";
```

And add after line 8 (`import { BasketItemCard } ...`):

```tsx
import { CARD_DISCOUNT_TOTAL_NOTE } from "@/components/shared/CardDiscountMark";
```

The CSV export at lines 10-23 is **not** changed — altering the column set would break a file format users may already be consuming.

- [ ] **Step 7: Typecheck and lint**

```bash
npx tsc --noEmit
npx eslint app components lib types
```

Expected: `tsc` exits 0. `eslint` reports exactly 2 errors — still `SearchBar.tsx:17` and `lib/cart.tsx:71`, no new ones from the `lib/cart.tsx` edit.

- [ ] **Step 8: Verify in Chrome**

1. Empty the basket first (`Izprazni košarico`), so stale localStorage entries do not confuse the result.
2. From `http://localhost:3000/search?cardDiscount=true`, add one product to the basket via the grid card's `+` button.
3. Open `http://localhost:3000/basket` — the row shows the glyph beside its line total, and the note **"Seštevek vključuje cene s kartico ugodnosti."** sits under "Skupaj" with a small card glyph.
4. Increase that item's quantity to 2 — the glyph stays beside the (now larger) total and the `/ izdelek` line appears beneath, unchanged.
5. Empty the basket, then add a Hofer product from plain `/search`. The row shows **no** glyph and the note is **absent**.
6. Add a card-priced item on top of it — the note appears, because one item is enough.
7. Add a product from a detail page's "Dodaj v Košarico" button and from the mobile list row's "V Košarico" button — both must carry the flag too.
8. Reload `/basket` — the flag survives the localStorage round trip.
9. Click `Izvozi seznam` — the CSV downloads and still has its original five columns.

- [ ] **Step 9: Commit**

```bash
git branch --show-current   # must print: development
git add lib/cart.tsx components/shared/ProductCard.tsx components/shared/ProductCardList.tsx components/shared/BasketItemCard.tsx "app/(main)/basket/page.tsx" "app/(main)/product/[product_id]/page.tsx"
git commit -m "feat: carry card discounts into the basket and flag the total"
```

---

## Final check

- [ ] **Full production build**

```bash
pnpm build
```

Expected: completes with no type errors and no new warnings. This is the only step that exercises the server components under production conditions.

- [ ] **Confirm the branch and the log**

```bash
git branch --show-current   # development
git log --oneline -5
```

Four feature commits on `development`, nothing on any other branch.
