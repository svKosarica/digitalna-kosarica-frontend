# Search Filters Multi-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/search` browsable without a query, multi-select on stores and categories, default to no sorting, stop the grid/list flash, add Tuš, and show a placeholder whenever a product image is missing *or* fails to load.

**Architecture:** Everything stays URL-driven — the server page reads search params and renders; client components only write params. The two new multi-selects hold a local draft and write the URL once, on popover close. The grid/list decision moves from a client effect that rewrote the URL to CSS that needs no JS at all, matching the technique `ProductResults.tsx` already uses.

**Tech Stack:** Next.js 16 App Router (server components + server actions), React 19, Tailwind v4, Radix primitives via shadcn (`components/ui/`), `lucide-react` icons, `pnpm`.

**Spec:** `docs/superpowers/specs/2026-08-04-search-filters-multiselect-design.md`. Read it before Task 1 — it records the API probes each decision rests on.

## Global Constraints

- **No test files.** This repo has none and adds none. Every task is verified in Chrome against `pnpm dev` on `http://localhost:3000`. This overrides the usual write-a-failing-test-first cycle.
- **`npx tsc --noEmit` must exit 0** before every commit. It is clean at baseline.
- **`pnpm lint` fails at baseline** with 4 errors and 2 warnings, all pre-existing: `components/shared/SearchBar.tsx:17` and `lib/cart.tsx:71` (`react-hooks/set-state-in-effect`), `stories/Page.tsx:39` ×2 (`react/no-unescaped-entities`), plus warnings in `eslint.config.mjs:2` and `proxy.ts:4`. **The gate is that this count does not increase** — never "lint passes". Use `npx eslint app components lib types` to check the code that matters; it reports only the two `set-state-in-effect` errors.
- **All user-facing copy is Slovenian.** Never introduce English strings into the UI.
- **Slovenian counts have four forms** (it has a dual). Always use `Intl.PluralRules("sl")`, never a switch on the last two digits. `lib/format.ts:16-23` is the pattern to follow.
- **Never send `storeIds: []` or `categoryIds: []` to the API.** Both read as "everything", so an empty array silently means the opposite of a filter. Omit the field or send the full id list.
- **`sortOption: "NONE"` is not neutral** — the API treats it as descending. Never present a chosen sort field without an explicit direction.
- **A parent `categoryId` already matches its children.** `[2,21]` and `[2]` return identical results. Never send both.
- The dev server is at `http://localhost:3000`. Start it with `pnpm dev` and leave it running across tasks; Next.js hot-reloads every change below.

---

### Task 1: Tuš (storeId 5)

Adds store 5 end to end. `ALL_STORE_IDS` is derived from `STORE_MAP` in both `search/page.tsx:72` and `SearchFilters.tsx:21`, so registering the id is all it takes for Tuš products to start arriving.

**Files:**
- Modify: `lib/store.ts:1-8`
- Modify: `types/search.types.ts:18-23`
- Modify: `lib/utils.ts:10-16`
- Modify: `next.config.ts:5-26`
- Modify: `components/shared/SearchFilters.tsx:124-128` (interim label fix)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `StoreName` gains the `"tus"` member. `STORE_MAP: Record<number, StoreName>` (was `Record<number, string>`) — Tasks 6 and 7 rely on the tightened type so `STORE_LOGOS[STORE_MAP[id]]` type-checks. `STORE_LOGOS.tus = { label: "Tuš", logoUrl: "/images/tus.png" }`.

- [ ] **Step 1: Add `tus` to the store registry**

Replace the whole of `lib/store.ts`:

```ts
export type StoreName = "spar" | "mercator" | "hofer" | "lidl" | "tus";

export const STORE_LOGOS: Record<StoreName, { label: string; logoUrl: string }> = {
  spar:     { label: "Spar",     logoUrl: "/images/spar.png"     },
  mercator: { label: "Mercator", logoUrl: "/images/mercator.png" },
  hofer:    { label: "Hofer",    logoUrl: "/images/hofer.png"    },
  lidl:     { label: "Lidl",     logoUrl: "/images/lidl.png"     },
  tus:      { label: "Tuš",      logoUrl: "/images/tus.png"      },
};
```

`public/images/tus.png` already exists — do not create it.

- [ ] **Step 2: Register id 5 and tighten `STORE_MAP`**

In `types/search.types.ts`, add the import at the top of the file (it currently has none):

```ts
import type { StoreName } from "@/lib/store";
```

then replace the `STORE_MAP` declaration:

```ts
/** Wire ids for the stores the API serves. `Object.keys` order defines filter order. */
export const STORE_MAP: Record<number, StoreName> = {
  1: "spar",
  2: "lidl",
  3: "mercator",
  4: "hofer",
  5: "tus",
};
```

The value type changes from `string` to `StoreName` so it can index `STORE_LOGOS`. `lib/store.ts` imports nothing, so this introduces no cycle.

- [ ] **Step 3: Teach `normalizeStoreName` about Tuš**

In `lib/utils.ts`, replace the `STORE_ALIASES` declaration:

```ts
// Matched as substrings against a lowercased API name, first match winning.
// The API sends "tus" without the diacritic; the accented alias is defensive.
const STORE_ALIASES: Record<string, StoreName> = {
  spar: "spar",
  mercator: "mercator",
  merkator: "mercator",
  hofer: "hofer",
  lidl: "lidl",
  tus: "tus",
  "tuš": "tus",
};
```

- [ ] **Step 4: Allow Tuš's image host**

In `next.config.ts`, add a fifth entry to `images.remotePatterns`, after the `dm.emea.cms.aldi.cx` block:

```ts
      {
        protocol: "https",
        hostname: "hitrinakup.com",
      },
```

This is load-bearing: `next/image` **throws** on an unconfigured hostname in development, so without it every results page containing a Tuš product errors instead of degrading. Tuš images look like `https://hitrinakup.com/remote_images/items_images/3838800025544.jpg`.

- [ ] **Step 5: Restart the dev server**

`next.config.ts` is read at boot and is **not** hot-reloaded. Stop `pnpm dev` and start it again, or Step 8 will fail with "hostname is not configured".

- [ ] **Step 6: Fix the interim store label**

The store dropdown renders `STORE_MAP`'s raw value through a `capitalize` class, which would print "Tus". Task 6 replaces this control entirely, but every commit should be shippable. In `components/shared/SearchFilters.tsx`, add `STORE_LOGOS` to the imports:

```tsx
import { STORE_LOGOS } from "@/lib/store";
```

and replace the store `SelectItem` map:

```tsx
            {ALL_STORE_IDS.map((id) => (
              <SelectItem key={id} value={String(id)} className="font-semibold text-foreground focus:bg-secondary focus:text-foreground">
                {STORE_LOGOS[STORE_MAP[id]].label}
              </SelectItem>
            ))}
```

The `<span className="capitalize">` wrapper goes away with it.

- [ ] **Step 7: Typecheck and lint**

```bash
npx tsc --noEmit && npx eslint app components lib types
```

Expected: `tsc` silent, exit 0. `eslint` reports exactly the 2 pre-existing `set-state-in-effect` errors (`SearchBar.tsx:17`, `lib/cart.tsx:71`) and nothing new.

- [ ] **Step 8: Verify in Chrome**

Open `http://localhost:3000/search?q=mleko`. Confirm:
1. The page renders without an error overlay.
2. At least one result carries the round green Tuš logo (there are 66 Tuš listings for `mleko`).
3. Those results show a real product photo, not the placeholder icon — that proves the `hitrinakup.com` pattern took effect.
4. The store dropdown lists six rows: `Vse trgovine`, `Spar`, `Lidl`, `Mercator`, `Hofer`, `Tuš` — with the correct **š**.
5. Selecting `Tuš` narrows the results to Tuš only and puts `?stores=5` in the URL.

- [ ] **Step 9: Commit**

```bash
git add lib/store.ts types/search.types.ts lib/utils.ts next.config.ts components/shared/SearchFilters.tsx
git commit -m "feat: add Tuš as storeId 5

Registers store 5 and its hitrinakup.com image host. next/image throws
on an unconfigured hostname in dev, so the remotePattern has to land in
the same commit as the id or every results page with a Tuš product
errors out.

Store labels now come from STORE_LOGOS rather than capitalizing
STORE_MAP's raw value, which would have printed \"Tus\"."
```

---

### Task 2: `ProductImage` — one owner for the placeholder

The `ImageIcon` fallback already exists at all four call sites, but only the two card components pass `onError`. `BasketItemCard.tsx:31` and `product/[product_id]/page.tsx:58` test `imageUrl` for truthiness alone, so a URL that 404s renders a broken image there. Roughly half of Lidl's `imgproxy-retcat.assets.schwarz` URLs 404 in production.

**Files:**
- Create: `components/shared/ProductImage.tsx`
- Modify: `components/shared/ProductCard.tsx:3-6,16-22,36-54,90-102`
- Modify: `components/shared/ProductCardList.tsx:3-6,10-16,30-48,85-97`
- Modify: `components/shared/BasketItemCard.tsx:3-5,29-41`
- Modify: `app/(main)/product/[product_id]/page.tsx:2-3,57-69`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `ProductImage` — a named export (not default), signature below. Later tasks do not use it.

- [ ] **Step 1: Create the component**

Create `components/shared/ProductImage.tsx`:

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  /** Empty string, null and undefined all mean "no image". */
  src: string | null | undefined;
  alt: string;
  /** Required: every call site renders at a different width. */
  sizes: string;
  /** Classes for the <Image> itself — object-fit, padding, hover transform. */
  className?: string;
  /** Fallback icon size, e.g. "size-12". */
  iconClassName?: string;
  priority?: boolean;
}

/**
 * A product image that degrades to an icon.
 *
 * Two failure modes, both live in production: the listing carries no imageUrl
 * at all (~1.4% of rows), or a store's CDN 404s a URL it still advertises
 * (about half the Lidl .../si/1/... paths). A truthiness check catches only the
 * first, which is why onError is not optional here.
 *
 * Renders the image or the icon and nothing else — never the positioned
 * wrapper, which differs at all four call sites and stays with the caller.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  className,
  iconClassName,
  priority,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <ImageIcon className={cn("text-border", iconClassName)} aria-hidden />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}
```

- [ ] **Step 2: Adopt it in `ProductCard`**

In `components/shared/ProductCard.tsx`:

Drop `ImageIcon` from the lucide import (keep `ArrowDown`, `ArrowUp`, `Check`, `Plus`) and add:

```tsx
import { ProductImage } from "@/components/shared/ProductImage";
```

Keep the `Image` import — store logos still use it.

Change the prop so the alt text defaults to the product name instead of generic English. Replace the `imageAlt?: string;` line in the interface with:

```tsx
  /** Overrides the alt text, which defaults to the product name. */
  imageAlt?: string;
```

In the destructured params, replace `imageAlt = "Product image",` with `imageAlt,`.

Delete the `imgError` state and the `hasImage` derivation:

```tsx
  const [imgError, setImgError] = useState(false);   // delete this line
  const hasImage = !!imageUrl && !imgError;          // delete this line
```

`useState` is still needed for `added`, so keep the import. Then replace the whole `{hasImage ? (…) : (…)}` block with:

```tsx
        <ProductImage
          src={imageUrl}
          alt={imageAlt ?? productName}
          sizes="(max-width: 640px) 50vw, 240px"
          className="w-4/5 h-4/5 object-contain transition-transform duration-500 group-hover:scale-110"
          iconClassName="size-12"
        />
```

- [ ] **Step 3: Adopt it in `ProductCardList`**

In `components/shared/ProductCardList.tsx`, make the same four edits: drop `ImageIcon` from the lucide import (keep `ArrowDown`, `ArrowUp`, `Check`), add the `ProductImage` import, change `imageAlt = "Product image",` to `imageAlt,` with the same doc comment, and delete the `imgError` / `hasImage` lines. Then replace the `{hasImage ? (…) : (…)}` block with:

```tsx
        <ProductImage
          src={imageUrl}
          alt={imageAlt ?? productName}
          sizes="112px"
          className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
          iconClassName="size-10"
        />
```

- [ ] **Step 4: Adopt it in `BasketItemCard`**

In `components/shared/BasketItemCard.tsx`, drop `ImageIcon` from the lucide import (keep `Minus`, `Plus`), add the `ProductImage` import, keep the `Image` import for the store logo, and replace the `{item.imageUrl ? (…) : (…)}` block with:

```tsx
          <ProductImage
            src={item.imageUrl}
            alt={item.productName}
            sizes="80px"
            className="object-contain p-1.5 sm:p-2"
            iconClassName="size-6 sm:size-8"
          />
```

This is one of the two call sites gaining the `onError` path.

- [ ] **Step 5: Adopt it in the detail page**

In `app/(main)/product/[product_id]/page.tsx`, drop `ImageIcon` from the lucide import (keep `ExternalLink`), add the `ProductImage` import, keep the `Image` import for the store logo, and replace the `{product.imageUrl ? (…) : (…)}` block with:

```tsx
          <ProductImage
            src={product.imageUrl}
            alt={product.title || product.name}
            sizes="(max-width: 768px) 240px, 420px"
            className="object-contain p-6 sm:p-8"
            iconClassName="size-14 sm:size-20"
            priority
          />
```

This page is a server component; `ProductImage` is a client leaf inside it, which is fine and needs no `"use client"` here.

- [ ] **Step 6: Typecheck and lint**

```bash
npx tsc --noEmit && npx eslint app components lib types
```

Expected: `tsc` exit 0. `eslint` still reports only the 2 pre-existing errors.

- [ ] **Step 7: Verify in Chrome**

Find a listing whose image 404s — search `kruh` and look for a Lidl result with a `.../si/1/...` image URL, or use DevTools to block `imgproxy-retcat.assets.schwarz` under Network → request blocking. Then confirm the placeholder icon (not a broken-image glyph) appears in all four places:
1. `/search?q=kruh&view=grid` — a card.
2. `/search?q=kruh&view=list` — a row.
3. That product's `/product/<id>` page.
4. Add it to the basket, open `/basket` — the thumbnail.

Also confirm a product **with** a working image still renders it in all four, and that the hover zoom still works on cards.

- [ ] **Step 8: Commit**

```bash
git add components/shared/ProductImage.tsx components/shared/ProductCard.tsx components/shared/ProductCardList.tsx components/shared/BasketItemCard.tsx "app/(main)/product/[product_id]/page.tsx"
git commit -m "fix: show the placeholder when an image fails, not just when it is absent

The basket and the detail page checked imageUrl for truthiness only, so a
URL the store still advertises but 404s rendered a broken image. About
half of Lidl's .../si/1/... paths do exactly that.

One ProductImage now owns the null check, the onError path and the icon
styling, so the four call sites cannot drift apart again. Card alt text
also stops being the generic English \"Product image\"."
```

---

### Task 3: Hero CTA and browse mode

`/search` stops short-circuiting when `q` is absent, so the home page's "Primerjaj cene" can link straight into a discount-sorted browse view. The backend accepts `query: ""` and returns all 5153 listings.

**Files:**
- Modify: `app/(main)/page.tsx:1-8,28`
- Delete: `components/shared/HeroFocusButton.tsx`
- Modify: `app/(main)/search/page.tsx:48-59,112-137`
- Modify: `components/shared/SearchBar.tsx:3,13,21-33,50,56`
- Modify: `app/globals.css:148-158`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: `/search` renders results with no `q` param. Task 4 edits the same result-rendering block in `search/page.tsx`, and Task 4 also edits `SearchBar.handleKeyDown` — leave that function's body alone here.

- [ ] **Step 1: Replace the hero button with a link**

In `app/(main)/page.tsx`, delete the `HeroFocusButton` import and add:

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
```

Replace `<HeroFocusButton />` with:

```tsx
          <Link
            href="/search?filter=DISCOUNT_PCT&order=DESCENDING"
            className="bg-primary text-primary-foreground px-6 py-3 md:px-8 md:py-4 rounded-lg font-semibold tracking-wide shadow-lg hover:shadow-xl transition-all active:scale-95 inline-flex items-center gap-2 cursor-pointer text-sm md:text-base"
          >
            Primerjaj cene
            <ArrowRight className="size-5" />
          </Link>
```

Note `inline-flex`, not the original `flex`. A `<button>` is inline-block by default so `flex` sized it to its content; an `<a>` with `flex` becomes block-level and would stretch to the full width of the `max-w-xl` column.

- [ ] **Step 2: Delete the old button**

```bash
rm components/shared/HeroFocusButton.tsx
```

This was the only dispatcher of the `focus-search` event — Steps 5 and 6 remove the listener and the animation it drove.

- [ ] **Step 3: Let `/search` render without a query**

In `app/(main)/search/page.tsx`, delete the early return in full — the `if (!query) { … }` block spanning lines 52-59 — along with the now-unused `SearchX` usage inside it (`SearchX` is still needed for the no-results state, so keep the import).

Then make the header adapt. Replace the `<h1>` and the guard around it:

```tsx
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1 break-words">
          {query ? <>Rezultati za &ldquo;{query}&rdquo;</> : "Vsi izdelki"}
        </h1>
```

The count line below it and the uncategorised-products note are unchanged.

- [ ] **Step 4: Fix the no-results copy for browse mode**

Still in `app/(main)/search/page.tsx`, the empty state hardcodes the query and would read `Ni rezultatov za “”`. Replace that `<p>`:

```tsx
          <p className="text-lg">
            {query ? <>Ni rezultatov za &ldquo;{query}&rdquo;.</> : "Ni rezultatov."}
          </p>
```

- [ ] **Step 5: Remove the dead `focus-search` listener**

In `components/shared/SearchBar.tsx`, delete the entire second `useEffect` (lines 21-33, the one declaring `onFocusSearch`), the `onAnimationEnd` prop on the `Input` (line 56), the `ref={inputRef}` prop (line 50), and the `inputRef` declaration (line 13). Then drop `useRef` from the React import:

```tsx
import { useState, useEffect } from "react";
```

Keep the first `useEffect` — the one that clears the query when `pathname !== "/search"`. Its `react-hooks/set-state-in-effect` error at line 17 is one of the 4 pre-existing lint errors and stays.

- [ ] **Step 6: Remove the dead animation**

In `app/globals.css`, delete the `@keyframes search-pop { … }` block and the `@utility animate-search-pop { … }` block that follows it (lines 148-158, between `@keyframes shimmer` and `@keyframes cart-bump`). Leave both neighbours intact.

- [ ] **Step 7: Typecheck and lint**

```bash
npx tsc --noEmit && npx eslint app components lib types
```

Expected: `tsc` exit 0. `eslint` still reports only the 2 pre-existing errors — `SearchBar.tsx:17` survives Step 5.

- [ ] **Step 8: Verify in Chrome**

1. `http://localhost:3000` — the "Primerjaj cene" button is sized to its text, not full-width, and hovering shows `/search?filter=DISCOUNT_PCT&order=DESCENDING` in the status bar.
2. Click it. The page is headed **Vsi izdelki**, the count line reads about `5153 izdelkov`, the filter bar is present, and the first cards carry large discount badges (the top ones are near -80%).
3. Navigate to `/search` bare, with no params at all — still "Vsi izdelki" with results, no "Vnesi iskalni pojem" prompt.
4. `/search?q=mleko` still reads `Rezultati za "mleko"`.
5. `/search?q=zzzzqqq` reads `Ni rezultatov za "zzzzqqq".`; add `&stores=1` to a browse URL with an impossible category to confirm the bare `Ni rezultatov.` form, e.g. `/search?categories=999999`.
6. Type a term in the header search field and press Enter — it still navigates. The pop animation is gone; that is intended.

- [ ] **Step 9: Commit**

```bash
git add -A "app/(main)/page.tsx" "app/(main)/search/page.tsx" components/shared/SearchBar.tsx app/globals.css components/shared/HeroFocusButton.tsx
git commit -m "feat: make Primerjaj cene browse the discounts

/search no longer short-circuits on a missing q — the API accepts an
empty query and returns all 5153 listings — so the hero button links to
a discount-sorted browse view instead of focusing the search field.

That made HeroFocusButton the only focus-search dispatcher redundant,
and with it SearchBar's listener and the search-pop animation."
```

---

### Task 4: The view-mode flash and the grid→list revert

Two bugs, one cause: the mount effect at `SearchFilters.tsx:43-50` rewrites the URL with `view=grid` on desktop when the param is missing. The server had already rendered `list`, hence a second of rows; and because the component does not remount on a same-route navigation, the effect never re-fired after a second search, stranding the user on the server default.

**Files:**
- Modify: `app/(main)/search/page.tsx:109,131-150`
- Modify: `components/shared/SearchFilters.tsx:4,40-50,260-286`
- Modify: `components/shared/SearchBar.tsx:35-39`

**Interfaces:**
- Consumes: Task 3's edits to the same result-rendering block in `search/page.tsx`.
- Produces: `view` is a three-state value — `"grid" | "list" | null` — in both the page and `SearchFilters`. Task 5 edits `SearchFilters`' sort controls, which sit in the same JSX block as the view toggle.

- [ ] **Step 1: Make `view` three-state on the server**

In `app/(main)/search/page.tsx`, add `cn` to the `lib/utils` import:

```tsx
import { cn, normalizeStoreName, productCountLabel } from "@/lib/utils";
```

Replace the `viewMode` line:

```tsx
  // Three states, and null is the interesting one: it means "the visitor has
  // not chosen", which the server cannot resolve because it does not know the
  // viewport. Rather than guess and correct on the client — which is what the
  // deleted mount effect did, and why results flashed as rows — both layouts
  // render and CSS picks, exactly as ProductResults does on /popular.
  const viewParam =
    params.view === "grid" || params.view === "list" ? params.view : null;
```

- [ ] **Step 2: Render one layout or both**

Still in `app/(main)/search/page.tsx`, replace the whole `viewMode === "grid" ? (…) : (…)` ternary — both branches — with two independent blocks:

```tsx
      ) : (
        <>
          {viewParam !== "list" && (
            <div
              className={cn(
                "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 justify-items-center",
                viewParam === null && "hidden sm:grid",
              )}
            >
              {results.map((item) => (
                <ProductCard key={item.id} {...cardProps(item)} />
              ))}
            </div>
          )}

          {viewParam !== "grid" && (
            <div className={cn("space-y-4", viewParam === null && "sm:hidden")}>
              {results.map((item) => (
                <ProductCardList key={item.id} {...cardProps(item)} />
              ))}
            </div>
          )}
        </>
      )}
```

`cn` is `twMerge`, so `"grid grid-cols-[…] gap-4 …"` plus `"hidden sm:grid"` resolves to `hidden sm:grid` while keeping the `grid-cols` and `gap` utilities — `grid` and `hidden` conflict on display and the later one wins, and `sm:grid` is a separate variant.

When `viewParam` is null both trees render, which is 100 cards for 50 results. `ProductResults.tsx:46-53` already accepts this cost on two other routes and its comment explains why it is worth it: hidden card images are lazy, so they cost DOM but no requests.

- [ ] **Step 3: Delete the mount effect**

In `components/shared/SearchFilters.tsx`, delete the entire `useEffect` at lines 43-50 — including its `// eslint-disable-line react-hooks/exhaustive-deps` comment — and drop `useEffect` from the React import:

```tsx
import { useCallback } from "react";
```

Then replace **both** of the two existing `view` lines — `const viewParam = searchParams.get("view");` and `const view = viewParam ?? "list";` — with:

```tsx
  // Null means "not chosen": the toggle's highlight then follows CSS at the
  // same breakpoint the results do, so neither can flash against the other.
  const viewParamRaw = searchParams.get("view");
  const view = viewParamRaw === "grid" || viewParamRaw === "list" ? viewParamRaw : null;
```

`viewParam` is gone, so nothing else in the file may reference it.

- [ ] **Step 4: Make the toggle's highlight follow the same rule**

Still in `components/shared/SearchFilters.tsx`, add these module-level constants next to `ITEM_CLASS`:

```tsx
// border-transparent in the base keeps the button from shifting 1px when the
// active state adds its border.
const TOGGLE_BASE =
  "p-2 rounded-lg border border-transparent transition-colors cursor-pointer";
const TOGGLE_ON = "bg-card text-primary border-primary/30";
const TOGGLE_OFF = "text-muted-foreground/40 hover:text-primary";
```

Replace both view-toggle buttons:

```tsx
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => updateParam("view", "grid")}
              aria-label="Mrežni prikaz"
              aria-pressed={view === "grid"}
              className={cn(
                TOGGLE_BASE,
                view === "grid" && TOGGLE_ON,
                view === "list" && TOGGLE_OFF,
                // Unchosen: inactive on phones, active from sm up — the
                // breakpoint the results themselves switch at.
                view === null && [
                  TOGGLE_OFF,
                  "sm:bg-card sm:text-primary sm:border-primary/30",
                ],
              )}
            >
              <LayoutGrid className="size-4 sm:size-5" />
            </button>
            <button
              type="button"
              onClick={() => updateParam("view", "list")}
              aria-label="Seznamski prikaz"
              aria-pressed={view === "list"}
              className={cn(
                TOGGLE_BASE,
                view === "list" && TOGGLE_ON,
                view === "grid" && TOGGLE_OFF,
                view === null && [
                  TOGGLE_ON,
                  "sm:bg-transparent sm:text-muted-foreground/40 sm:border-transparent sm:hover:text-primary",
                ],
              )}
            >
              <List className="size-4 sm:size-5" />
            </button>
          </div>
```

The buttons had no accessible name before — they are icon-only — so `aria-label` and `aria-pressed` are added while the classes are being rewritten.

- [ ] **Step 5: Carry the current params into a new search**

In `components/shared/SearchBar.tsx`, replace `handleKeyDown`:

```tsx
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || !query.trim()) return;

    // Only inherit params when they are already search params. From /popular or
    // /top-discounts, useSearchParams() holds that page's state, and copying it
    // would leak ?onlyDiscounted=true or ?window=WEEKLY into a search URL.
    const params =
      pathname === "/search"
        ? new URLSearchParams(searchParams.toString())
        : new URLSearchParams();

    params.set("q", query.trim());
    // A new term invalidates the offset; everything else is a standing choice.
    params.delete("page");
    router.push(`/search?${params.toString()}`);
  }
```

`pathname` and `searchParams` are already in scope from lines 10-11.

- [ ] **Step 6: Typecheck and lint**

```bash
npx tsc --noEmit && npx eslint app components lib types
```

Expected: `tsc` exit 0. `eslint` still reports only the 2 pre-existing errors — deleting the effect also removes its `exhaustive-deps` disable comment, which was suppressing nothing else.

- [ ] **Step 7: Verify the flash is gone**

In a desktop-width window, hard-reload `http://localhost:3000/search?q=mleko` (no `view` param) several times. Confirm:
1. The **first** paint is the card grid. No rows appear at any point.
2. The URL still has no `view` param afterwards — nothing rewrote it.
3. The grid icon in the toggle reads as active, the list icon as inactive.

Throttle the network to Slow 3G in DevTools and reload again — a race that only shows under latency is exactly what the old effect produced.

- [ ] **Step 8: Verify grid survives a second search**

1. On `/search?q=mleko`, click the grid icon. URL gains `view=grid`.
2. Type `kruh` in the header field, press Enter.
3. Confirm the results are **still a grid**, the URL is `/search?q=kruh&view=grid`, and no `page` param survived.
4. Repeat with the list icon selected — a second search stays a list.
5. From `/popular?onlyDiscounted=true`, search a term and confirm the URL is `/search?q=…` with **no** `onlyDiscounted`.

- [ ] **Step 9: Verify the mobile default**

Resize below 640px (or use device emulation). On `/search?q=mleko` with no `view` param, confirm rows render, the list icon reads as active, and crossing the 640px boundary flips both the layout and the highlight together with no reload.

- [ ] **Step 10: Commit**

```bash
git add "app/(main)/search/page.tsx" components/shared/SearchFilters.tsx components/shared/SearchBar.tsx
git commit -m "fix: stop the results flashing as rows before becoming cards

A mount effect rewrote the URL with view=grid whenever the param was
missing, so the server's list default painted first. With no param the
page now renders both layouts and lets CSS choose, which is what
ProductResults already does on /popular and /top-discounts.

Same effect caused grid to revert to list on a second search: it never
re-fired, because the component does not remount on a same-route
navigation. SearchBar now carries every param but page."
```

---

### Task 5: Razvrsti defaults to "Brez razvrščanja"

The default sort becomes `NONE`/`NONE`. Because `sortOption: "NONE"` reads as *descending* server-side rather than unsorted, the direction pills need guarding or the control will lie about what it is showing.

**Files:**
- Modify: `types/search.types.ts` (add exported whitelists)
- Modify: `app/(main)/search/page.tsx:10-11,61-70`
- Modify: `components/shared/SearchFilters.tsx:17-18,35-36,77-94,214-258`

**Interfaces:**
- Consumes: Task 4's `view` three-state in `SearchFilters` and the `TOGGLE_*` constants.
- Produces: `VALID_FILTERS: FilterOption[]` and `VALID_SORTS: SortOption[]`, exported from `types/search.types.ts`. `updateParams(entries: Record<string, string | null>)` in `SearchFilters`, with `updateParam(key, value)` kept as a wrapper — Tasks 6 and 7 call `updateParam`.

- [ ] **Step 1: Export the whitelists from one place**

`search/page.tsx:61-62` declares these inline and `SearchFilters` needs the same lists to validate its own reads. In `types/search.types.ts`, add below the `SortOption` declaration:

```ts
/** Every accepted value, for validating URL params. Shared so the page and the
 *  filter bar cannot disagree about what a valid sort is. */
export const VALID_FILTERS: FilterOption[] = [
  "PRICE",
  "PRICE_PER_UNIT",
  "DISCOUNT_PCT",
  "NONE",
];

export const VALID_SORTS: SortOption[] = ["ASCENDING", "DESCENDING", "NONE"];
```

- [ ] **Step 2: Default the server to no sorting**

In `app/(main)/search/page.tsx`, import the whitelists:

```tsx
import { STORE_MAP, VALID_FILTERS, VALID_SORTS } from "@/types/search.types";
```

Delete the two local `const VALID_FILTERS` / `const VALID_SORTS` declarations, then change both fallbacks:

```tsx
  const filter = VALID_FILTERS.includes(params.filter as FilterOption)
    ? (params.filter as FilterOption)
    : "NONE";

  const order = VALID_SORTS.includes(params.order as SortOption)
    ? (params.order as SortOption)
    : "NONE";
```

- [ ] **Step 3: Default and validate in the filter bar**

In `components/shared/SearchFilters.tsx`, extend the types import:

```tsx
import { ALL_CATEGORIES_LABEL, STORE_MAP, VALID_FILTERS, VALID_SORTS } from "@/types/search.types";
import type { Category, FilterOption, SortOption } from "@/types/search.types";
```

Replace the `filter` and `order` derivations. They were unvalidated, so `?filter=xyz` rendered a blank trigger:

```tsx
  const filterParam = searchParams.get("filter");
  const filter: FilterOption = VALID_FILTERS.includes(filterParam as FilterOption)
    ? (filterParam as FilterOption)
    : "NONE";

  const orderParam = searchParams.get("order");
  const order: SortOption = VALID_SORTS.includes(orderParam as SortOption)
    ? (orderParam as SortOption)
    : "NONE";
```

- [ ] **Step 4: Allow multi-key URL updates**

Choosing a sort field has to set a direction in the same navigation. Replace `updateParam` with:

```tsx
  const updateParams = useCallback(
    (entries: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(entries)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      // Any filter change invalidates the current page offset — a user on page 4
      // who narrows the results would otherwise land on an empty page 4.
      // `view` is presentation-only, so it keeps your place.
      if (Object.keys(entries).some((key) => key !== "page" && key !== "view")) {
        params.delete("page");
      }
      router.replace(`/search?${params.toString()}`);
    },
    [router, searchParams],
  );

  const updateParam = useCallback(
    (key: string, value: string | null) => updateParams({ [key]: value }),
    [updateParams],
  );
```

- [ ] **Step 5: Give a freshly chosen sort field a direction**

Still in `components/shared/SearchFilters.tsx`, add at module level:

```tsx
// sortOption NONE is not neutral server-side — filter=PRICE with sortOption=NONE
// returns the most expensive rows first — so a field chosen while no direction
// is set must be given one, or "Cena" would quietly mean "priciest first".
const DEFAULT_ORDER: Record<Exclude<FilterOption, "NONE">, SortOption> = {
  PRICE: "ASCENDING",
  PRICE_PER_UNIT: "ASCENDING",
  DISCOUNT_PCT: "DESCENDING",
};
```

and this handler alongside `handleStoreChange`:

```tsx
  function handleFilterChange(val: string) {
    const next = val as FilterOption;
    if (next === "NONE") {
      // The API ignores sortOption without a field, and a stale value would
      // leave a direction pill lit while both are disabled.
      updateParams({ filter: "NONE", order: null });
      return;
    }
    updateParams({
      filter: next,
      ...(order === "NONE" ? { order: DEFAULT_ORDER[next] } : {}),
    });
  }
```

Point the sort `Select` at it:

```tsx
          <Select value={filter} onValueChange={handleFilterChange}>
```

- [ ] **Step 6: Disable the direction pills while nothing is sorted**

Still in `components/shared/SearchFilters.tsx`, replace both direction buttons:

```tsx
          <div className="flex items-center gap-0.5 bg-card p-1 rounded-lg border border-border">
            <button
              type="button"
              disabled={filter === "NONE"}
              onClick={() => updateParam("order", "ASCENDING")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none",
                order === "ASCENDING"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              Naraš.
            </button>
            <button
              type="button"
              disabled={filter === "NONE"}
              onClick={() => updateParam("order", "DESCENDING")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none",
                order === "DESCENDING"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              Pad.
            </button>
          </div>
```

`disabled:opacity-40 disabled:pointer-events-none` matches the carousel arrows at `ProductScrollSection.tsx:90`.

- [ ] **Step 7: Typecheck and lint**

```bash
npx tsc --noEmit && npx eslint app components lib types
```

Expected: `tsc` exit 0 — `DEFAULT_ORDER` is keyed by `Exclude<FilterOption, "NONE">` and `next` is narrowed by the early return, so `DEFAULT_ORDER[next]` type-checks. `eslint` still reports only the 2 pre-existing errors.

- [ ] **Step 8: Verify in Chrome**

1. Search `mleko` from the header on a fresh URL. The Razvrsti trigger reads **Brez razvrščanja**; both `Naraš.` and `Pad.` are dimmed and unclickable; neither is highlighted.
2. Choose **Cena**. The URL becomes `…&filter=PRICE&order=ASCENDING`, `Naraš.` lights up, and the first prices are the cheap ones (around 0,44 €) — **not** 56,90 €. That is the whole point of this task.
3. Choose **Popust %**. `Pad.` lights up and the biggest discounts come first.
4. Choose **Cena na enoto**. `Naraš.` lights up.
5. With Cena + Naraš. active, choose **Brez razvrščanja**: the pills go dim and unlit, and `order` disappears from the URL while `filter=NONE` remains.
6. Switch from Cena/Naraš. to Popust % and confirm the direction is **preserved** as ascending rather than reset — `DEFAULT_ORDER` only fills in when no direction is set.
7. Load `/search?q=mleko&filter=xyz` and confirm the trigger reads "Brez razvrščanja" rather than rendering blank.
8. The hero button still lands on Popust % + Pad., since it sets both params explicitly.

- [ ] **Step 9: Commit**

```bash
git add types/search.types.ts "app/(main)/search/page.tsx" components/shared/SearchFilters.tsx
git commit -m "feat: default Razvrsti to Brez razvrščanja

Also guards the direction pills, because sortOption NONE is not neutral
on the wire: filter=PRICE with sortOption=NONE returns the most
expensive rows first. So the pills are disabled while no field is
chosen, and choosing a field fills in a sensible direction — ascending
for price and price-per-unit, descending for discount.

Both whitelists move to types/search.types.ts so the page and the filter
bar cannot disagree, which also makes ?filter=xyz fall back instead of
rendering a blank trigger."
```

---

### Task 6: Store multi-select

Introduces the popover shell, the Slovenian count helpers, and the flat store list. Categories follow in Task 7 and reuse the shell.

**Files:**
- Modify: `lib/utils.ts` (add count helpers)
- Create: `components/shared/FilterPopover.tsx`
- Create: `components/shared/StoreMultiSelect.tsx`
- Modify: `components/shared/SearchFilters.tsx:21,37,52-54,96-105,114-130`
- Modify: `app/(main)/search/page.tsx:72-75`

**Interfaces:**
- Consumes: `STORE_MAP: Record<number, StoreName>` and `STORE_LOGOS.tus` from Task 1; `updateParam` from Task 5.
- Produces:
  - `storeCountLabel(count: number): string` and `categoryCountLabel(count: number): string` in `lib/utils.ts` — Task 7 uses the second.
  - `FilterPopover` and `FilterCheckboxRow`, both named exports of `components/shared/FilterPopover.tsx`, with the props below — Task 7 uses both.
  - `StoreMultiSelect({ selected: number[], onCommit: (ids: number[]) => void })`.

- [ ] **Step 1: Add the count helpers**

In `lib/utils.ts`, add below `productCountLabel`:

```ts
// Slovenian has a dual, so a count has four forms. Intl implements the rule;
// lib/format.ts explains why hand-rolling it off the last two digits goes
// wrong. These are nominative ("2 trgovini"), unlike the locative the results
// header uses ("v 2 trgovinah") — different grammatical case, different helper.
const countRules = new Intl.PluralRules("sl");

const STORE_FORMS = {
  one: "trgovina",
  two: "trgovini",
  few: "trgovine",
  other: "trgovin",
  zero: "trgovin",
  many: "trgovin",
} as const;

const CATEGORY_FORMS = {
  one: "kategorija",
  two: "kategoriji",
  few: "kategorije",
  other: "kategorij",
  zero: "kategorij",
  many: "kategorij",
} as const;

/** "1 trgovina", "2 trgovini", "3 trgovine", "5 trgovin". */
export function storeCountLabel(count: number): string {
  return `${count} ${STORE_FORMS[countRules.select(count)]}`;
}

/** "1 kategorija", "2 kategoriji", "3 kategorije", "5 kategorij". */
export function categoryCountLabel(count: number): string {
  return `${count} ${CATEGORY_FORMS[countRules.select(count)]}`;
}
```

`productCountLabel` above is the older hand-rolled kind. Leave it alone — rewriting it is not this plan's job.

- [ ] **Step 2: Create the popover shell**

Create `components/shared/FilterPopover.tsx`:

```tsx
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
  /** Popover width, e.g. "w-56". */
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
      {/* p-0 replaces PopoverContent's own p-4 so the pinned header can sit
          flush above the scroll area. The max-h clamp lives on the content
          rather than the scroller so the header counts towards it; min() keeps
          the viewport clamp, which a bare max-h would lose. cn is twMerge, so
          the width and padding override rather than layer. */}
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
 * Separate elements wired by id rather than a wrapping <label>: Radix's
 * Checkbox root renders a <button>, which a native label does not forward
 * clicks to. Radix's Label does forward them, and this mirrors how the
 * switches in SearchFilters are already built.
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
```

- [ ] **Step 3: Create the store multi-select**

Create `components/shared/StoreMultiSelect.tsx`:

```tsx
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
    const before = canonical(selected).join(",");
    const after = canonical(draft).join(",");
    // One navigation per session of edits, not one per checkbox.
    if (before !== after) onCommit(canonical(draft));
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
```

- [ ] **Step 4: Swap it into the filter bar**

In `components/shared/SearchFilters.tsx`:

Add the import:

```tsx
import { StoreMultiSelect } from "@/components/shared/StoreMultiSelect";
```

Replace the `stores` param read and the `selectedStores` derivation (the old `const stores = searchParams.get("stores")` line and the `selectedStores` block) with:

```tsx
  const storesParam = searchParams.get("stores");
  // Ids absent from STORE_MAP are dropped here, which also swallows the NaN
  // from ?stores=abc, so the popover never has to render an id it cannot name.
  const selectedStores = storesParam
    ? storesParam.split(",").map(Number).filter((id) => id in STORE_MAP)
    : [];
```

Delete `const ALL_STORE_IDS = Object.keys(STORE_MAP).map(Number);` at module level, the `allStoresSelected` derivation, and `handleStoreChange` — all three move into `StoreMultiSelect`.

Replace the entire store `Select` block (from `{/* Store select */}` through its closing `</Select>`) with:

```tsx
        <StoreMultiSelect
          selected={selectedStores}
          onCommit={(ids) =>
            updateParam("stores", ids.length ? ids.join(",") : null)
          }
        />
```

`STORE_LOGOS` is no longer referenced in this file — Task 1 added it for the interim label and `StoreMultiSelect` owns that now — so remove that import. `STORE_MAP` is still used by `selectedStores`, so keep it.

- [ ] **Step 5: Never send an empty `storeIds`**

In `app/(main)/search/page.tsx`, replace the `storeIds` derivation:

```tsx
  const ALL_STORE_IDS = Object.keys(STORE_MAP).map(Number);
  const requestedStoreIds =
    typeof params.stores === "string"
      ? params.stores.split(",").map(Number).filter((id) => id in STORE_MAP)
      : [];
  // Never forward [] — the API reads it as "every store", so an empty
  // (?stores=) or all-garbage (?stores=99) param would silently mean the
  // opposite of a filter. Membership also subsumes the old filter(Boolean),
  // which only caught NaN and 0.
  const storeIds = requestedStoreIds.length ? requestedStoreIds : ALL_STORE_IDS;
```

- [ ] **Step 6: Typecheck and lint**

```bash
npx tsc --noEmit && npx eslint app components lib types
```

Expected: `tsc` exit 0 — `STORE_LOGOS[STORE_MAP[draft[0]]]` type-checks only because Task 1 tightened `STORE_MAP` to `Record<number, StoreName>`. `eslint` still reports only the 2 pre-existing errors.

- [ ] **Step 7: Verify in Chrome**

On `http://localhost:3000/search?q=mleko`:
1. The store trigger reads **Vse trgovine**. Open it: `Vse trgovine` is checked in the pinned header, and all five stores are checked below.
2. Untick `Lidl`, `Hofer` and `Mercator` **without closing**. The trigger updates live to `2 trgovini`. Confirm in DevTools Network that **no** request fired yet.
3. Close the popover. Exactly one navigation happens, the URL reads `?q=mleko&stores=1,5` (sorted), and only Spar and Tuš results remain.
4. Re-open. The header row is now unchecked and only Spar and Tuš are ticked.
5. Open and close again without changing anything — confirm **no** navigation.
6. Untick down to one store, then untick that last one: the selection snaps back to all five and the trigger reads `Vse trgovine`.
7. With a subset active, click `Vse trgovine` and close — the `stores` param disappears entirely.
8. Tick exactly one store: the trigger shows its name (`Tuš`, with the š), not `1 trgovina`.
9. Check the plural forms by ticking 2, then 3, then 5: `2 trgovini`, `3 trgovine`, `Vse trgovine`.
10. Go to page 3 via the pagination, then change the store filter — confirm `page` is dropped.
11. Load `?q=mleko&stores=99` and confirm results are unfiltered and the trigger reads `Vse trgovine`.
12. At <640px the trigger is full-width and the popover fits on screen.

- [ ] **Step 8: Commit**

```bash
git add lib/utils.ts components/shared/FilterPopover.tsx components/shared/StoreMultiSelect.tsx components/shared/SearchFilters.tsx "app/(main)/search/page.tsx"
git commit -m "feat: multi-select the store filter

Popover with a checkbox list, committing to the URL on close so a
session of edits costs one navigation instead of one per checkbox. The
draft re-syncs from the URL on open, which is the sync point that makes
an effect watching the param unnecessary.

Empty selection is unreachable by construction: the API reads
storeIds: [] as every store, so unchecking the last box would show more
rather than less. The page now also refuses to forward an empty or
all-garbage list for the same reason."
```

---

### Task 7: Category multi-select

The two-level tri-state tree. Needs the checkbox primitive to distinguish `indeterminate` from `checked` first, because Radix renders its Indicator for both.

**Files:**
- Modify: `components/ui/checkbox.tsx:5,17,22-27`
- Create: `components/shared/CategoryMultiSelect.tsx`
- Modify: `components/shared/SearchFilters.tsx:6-19,23-24,56-75,107-109,132-180`

**Interfaces:**
- Consumes: `FilterPopover` and `FilterCheckboxRow` from Task 6; `categoryCountLabel` from Task 6; `buildCategoryTree` and `ALL_CATEGORIES_LABEL`, both already in the codebase; `updateParam` from Task 5.
- Produces: `CategoryMultiSelect({ categories: Category[], selected: number[], onCommit: (ids: number[]) => void })`. Final task — nothing consumes it.

- [ ] **Step 1: Make the checkbox show a tri-state**

`components/ui/checkbox.tsx:26` renders `CheckIcon` unconditionally, and Radix mounts the Indicator for `indeterminate` as well as `checked`, so a partly-selected parent would be indistinguishable from a fully-selected one.

Change the import:

```tsx
import { CheckIcon, MinusIcon } from "lucide-react"
```

Add `group/checkbox` at the very start of the Root's class string and the three `indeterminate` colour rules next to their `checked` counterparts. The string becomes:

```tsx
        "group/checkbox peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
```

Then render both glyphs inside the Indicator, swapped by the Root's state:

```tsx
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5 group-data-[state=indeterminate]/checkbox:hidden" />
        <MinusIcon className="hidden size-3.5 group-data-[state=indeterminate]/checkbox:block" />
      </CheckboxPrimitive.Indicator>
```

Purely additive — `checked` and `unchecked` render exactly as before, so the checkbox's other consumers are unaffected.

- [ ] **Step 2: Create the category multi-select**

Create `components/shared/CategoryMultiSelect.tsx`:

```tsx
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
```

A childless top-level category needs no special case: `toggleParent` with an empty `children` list degenerates to a plain toggle of its own id, so the `children.length === 0` branch the old `Select` needed disappears.

- [ ] **Step 3: Swap it into the filter bar**

In `components/shared/SearchFilters.tsx`:

Add the import:

```tsx
import { CategoryMultiSelect } from "@/components/shared/CategoryMultiSelect";
```

Replace the `categoryParam` / `isKnownCategory` / `selectedCategory` block — all three derivations and the long comment above them — with:

```tsx
  const categoriesParam = searchParams.get("categories");
  // Not validated against `categories` here: that list is [] during a
  // categories-API outage, and validating against it would wipe a legitimate
  // filter. CategoryMultiSelect drops unknown ids when it opens instead.
  const selectedCategories = categoriesParam
    ? categoriesParam
        .split(",")
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0)
    : [];
```

Delete `handleCategoryChange` and the `categoryTree` derivation. Replace the entire category `Select` block (from `{/* Category select */}` through its closing `</Select>`) with:

```tsx
        <CategoryMultiSelect
          categories={categories}
          selected={selectedCategories}
          onCommit={(ids) =>
            updateParam("categories", ids.length ? ids.join(",") : null)
          }
        />
```

- [ ] **Step 4: Clean up the now-unused imports**

Still in `components/shared/SearchFilters.tsx`, the sort dropdown is the only remaining `Select`, so narrow that import to what it uses:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

`SelectGroup` and `SelectLabel` are gone. Also remove `ALL_CATEGORIES_LABEL` from the types import (`CategoryMultiSelect` owns it now), drop `buildCategoryTree` from the `lib/utils` import while keeping `cn`, and delete the module-level `ITEM_CLASS` constant — the category items were its only consumers.

- [ ] **Step 5: Typecheck and lint**

```bash
npx tsc --noEmit && npx eslint app components lib types
```

Expected: `tsc` exit 0. `eslint` still reports only the 2 pre-existing errors. If it flags an unused import in `SearchFilters.tsx`, Step 4 missed one — remove it.

- [ ] **Step 6: Verify the tri-state**

On `http://localhost:3000/search` (browse mode, so counts are large and easy to read):
1. The category trigger reads **Vse kategorije**; opening it shows that row checked, 20 top-level rows, and indented children under the 7 parents that have them (Meso, Pijače, Zajtrk, Osnovna živila, Posebna hrana, Prigrizki, Sezonsko).
2. Tick **Pijače**. Both its children tick too. Close: URL is `?categories=4`, count about `4915 izdelkov`.
3. Re-open: Pijače is a filled box with a **dash** (not a checkmark) only if partly selected — here it is fully checked, so confirm a **checkmark**.
4. Untick **Alkoholne pijače**. Pijače switches to the dashed indeterminate box. Close: URL is `?categories=23` and the count drops — this is the documented rollup expansion, and the drop is larger than alcohol alone because the parent-only listings go too.
5. Re-open and untick **Brezalkoholne pijače**: nothing is selected under Pijače, its box clears, and closing removes the `categories` param.
6. Tick **Meso** and **Pijače** (two parents), close: URL is `?categories=3,4`, sorted, and the trigger reads `2 kategoriji`.
7. Tick a childless category such as **Mlečni izdelki** on its own — it toggles as a plain checkbox, `?categories=2`, trigger shows its name.
8. Tick 3 then 5 categories to confirm `3 kategorije` and `5 kategorij`.
9. Open and close with no change — no navigation.
10. Load `?categories=999999`: the trigger reads `Vse kategorije`, the uncategorised-products note is visible, results are empty with the bare `Ni rezultatov.` copy. Open the popover, tick and untick anything, close — the stale id is gone from the URL.
11. Confirm the popover scrolls internally with all 36 entries and does not run off a short viewport; check at <640px too.
12. Combine with the store filter and a sort — `?stores=1,5&categories=4&filter=PRICE&order=ASCENDING` — and confirm all three hold together, and that changing any one drops `page`.

- [ ] **Step 7: Regression-check the other checkbox consumers**

`components/ui/checkbox.tsx` is shared. Search the app for other usages (`grep -rn "ui/checkbox" app components`) and confirm any that exist still render a plain checkmark when checked and an empty box when not. If the filter rows are the only consumers, note that and move on.

- [ ] **Step 8: Commit**

```bash
git add components/ui/checkbox.tsx components/shared/CategoryMultiSelect.tsx components/shared/SearchFilters.tsx
git commit -m "feat: multi-select the category filter

Parent rows are the rollups: checked sends just the parent id, which
already matches its children on the wire, and a dash marks a parent with
only some children picked. The checkbox primitive needed that dash —
Radix mounts its Indicator for indeterminate too, so a partial parent
was rendering an indistinguishable checkmark.

Unchecking a child under a rolled-up parent expands to the remaining
siblings, which also drops the listings filed on the parent alone — 991
of 4915 for Pijače. Unavoidable at child granularity; the visible count
change is the signal.

Replaces the single-select's stale-id placeholder hack, whose own
comment flagged it for revisiting when multi-select landed."
```

---

## Final verification

After Task 7, walk the whole feature once on a fresh server (`pnpm dev` restarted, hard reload):

- [ ] Home → "Primerjaj cene" → `Vsi izdelki` headed browse, discount-sorted, ~5153 items.
- [ ] Search `mleko` from the header → `Rezultati za "mleko"`, Razvrsti reads `Brez razvrščanja`, direction pills dim.
- [ ] Pick grid; search `kruh`; still grid.
- [ ] No row-then-card flash on any hard reload, at desktop or mobile width, including under Slow 3G.
- [ ] Stores → Spar + Tuš; categories → Pijače then untick Alkoholne; sort → Cena/Naraš. URL carries all of it, one navigation per popover close, `page` dropped on each change.
- [ ] A Tuš product shows its image and logo in card, row, detail page and basket.
- [ ] A 404-image product shows the placeholder icon in all four of those.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npx eslint app components lib types` reports exactly the 2 pre-existing errors, and `pnpm lint` still 4 errors / 2 warnings — no increase.
- [ ] `git log --oneline` shows 7 commits, one per task.
