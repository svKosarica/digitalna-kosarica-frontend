"use client";

import { CARD_DISCOUNT_TOTAL_NOTE } from "@/components/shared/CardDiscountMark";
import type { CartItem } from "@/lib/cart";
import { formatEurAmount } from "@/lib/format";
import { STORE_LOGOS, type StoreName } from "@/lib/store";

export interface StoreGroup {
  store: StoreName;
  /** Display name, e.g. "Tuš". Falls back to the raw key for an unknown store. */
  label: string;
  total: number;
  items: CartItem[];
}

/**
 * The cart split per store, cheapest store first.
 *
 * One grouping feeds both the basket summary panel and the printed list, so the
 * two can never disagree about a store's total or the order stores appear in.
 */
export function groupItemsByStore(items: CartItem[]): StoreGroup[] {
  const groups = new Map<StoreName, StoreGroup>();

  for (const item of items) {
    let group = groups.get(item.storeName);
    if (!group) {
      group = {
        store: item.storeName,
        label: STORE_LOGOS[item.storeName]?.label ?? item.storeName,
        total: 0,
        items: [],
      };
      groups.set(item.storeName, group);
    }
    group.total += item.price * item.quantity;
    group.items.push(item);
  }

  return Array.from(groups.values()).sort((a, b) => a.total - b.total);
}

// Slovenian has a dual, so a count has four forms. Same approach as the piece
// counts in lib/format.ts: Intl implements the rule, we only supply the nouns.
const countRules = new Intl.PluralRules("sl");

const ITEM_FORMS: Record<Intl.LDMLPluralRule, string> = {
  one: "izdelek",
  two: "izdelka",
  few: "izdelki",
  other: "izdelkov",
  zero: "izdelkov",
  many: "izdelkov",
};

const STORE_FORMS: Record<Intl.LDMLPluralRule, string> = {
  one: "trgovina",
  two: "trgovini",
  few: "trgovine",
  other: "trgovin",
  zero: "trgovin",
  many: "trgovin",
};

function pluralize(count: number, forms: Record<Intl.LDMLPluralRule, string>): string {
  return `${count} ${forms[countRules.select(count)]}`;
}

const listDate = new Intl.DateTimeFormat("sl-SI", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

// Product and brand names are store-supplied strings that end up inside an
// iframe document, so every one of them is escaped on the way in.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => HTML_ENTITIES[char]);
}

/** Brand, size and unit price — whichever the item actually carries. */
function itemMeta(item: CartItem): string {
  const parts = [item.brandName, item.size].filter(Boolean) as string[];
  if (item.quantity > 1) {
    parts.push(`${item.quantity} × ${formatEurAmount(item.price)} €`);
  }
  if (item.cardDiscount) parts.push("s kartico ugodnosti");
  return parts.join(" · ");
}

function renderItem(item: CartItem): string {
  const meta = itemMeta(item);
  return `
      <li>
        <span class="box"></span>
        <span class="item">
          <span class="item-name">${escapeHtml(item.productName)}</span>
          ${meta ? `<span class="item-meta">${escapeHtml(meta)}</span>` : ""}
        </span>
        <span class="qty">${item.quantity} ×</span>
        <span class="amount">${formatEurAmount(item.price * item.quantity)} €</span>
      </li>`;
}

function renderGroup(group: StoreGroup): string {
  return `
    <section class="store">
      <div class="store-head">
        <span class="store-name">${escapeHtml(group.label)}</span>
        <span class="store-total">${formatEurAmount(group.total)} €</span>
      </div>
      <ul>${group.items.map(renderItem).join("")}
      </ul>
    </section>`;
}

const PRINT_STYLES = `
    @page { size: A4; margin: 15mm 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.35;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12pt;
      padding-bottom: 8pt;
      border-bottom: 1.5pt solid #111;
    }
    h1 { margin: 0; font-size: 19pt; font-weight: 800; letter-spacing: -0.02em; }
    .subtitle { margin: 3pt 0 0; font-size: 9pt; color: #6b6b6b; }
    .date { font-size: 9pt; color: #6b6b6b; white-space: nowrap; }
    .store { margin-top: 15pt; }
    /* A store heading stranded at the foot of a page reads as an empty store. */
    .store-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8pt;
      padding-bottom: 4pt;
      border-bottom: 0.75pt solid #c9c9c9;
      break-after: avoid;
      page-break-after: avoid;
    }
    .store-name { font-size: 11pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .store-total { font-size: 10pt; font-weight: 700; color: #444; }
    ul { margin: 0; padding: 0; list-style: none; }
    li {
      display: flex;
      align-items: flex-start;
      gap: 9pt;
      padding: 6pt 0;
      border-bottom: 0.5pt dotted #d4d4d4;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    /* The tick box. Empty on purpose — it is filled in with a pen. */
    .box {
      flex: none;
      width: 12pt;
      height: 12pt;
      margin-top: 1pt;
      border: 1pt solid #111;
      border-radius: 2pt;
    }
    .item { flex: 1 1 auto; min-width: 0; }
    .item-name { display: block; font-weight: 600; }
    .item-meta { display: block; margin-top: 1pt; font-size: 8.5pt; color: #6b6b6b; }
    .qty { flex: none; width: 34pt; text-align: right; color: #444; font-variant-numeric: tabular-nums; }
    .amount { flex: none; width: 60pt; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
    footer { margin-top: 18pt; padding-top: 8pt; border-top: 1.5pt solid #111; }
    .grand { display: flex; justify-content: space-between; font-size: 13pt; font-weight: 800; }
    .note { margin: 6pt 0 0; font-size: 8.5pt; color: #6b6b6b; }`;

/** The printable document — a standalone HTML page, styled only for paper. */
export function renderShoppingListHtml(items: CartItem[], now = new Date()): string {
  const groups = groupItemsByStore(items);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotal = groups.reduce((sum, group) => sum + group.total, 0);
  const hasCardDiscount = items.some((item) => item.cardDiscount);

  return `<!doctype html>
<html lang="sl">
<head>
  <meta charset="utf-8">
  <!-- Chrome names the saved PDF after the title. -->
  <title>Nakupovalni seznam</title>
  <style>${PRINT_STYLES}
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Nakupovalni seznam</h1>
      <p class="subtitle">${pluralize(itemCount, ITEM_FORMS)} · ${pluralize(groups.length, STORE_FORMS)}</p>
    </div>
    <span class="date">${escapeHtml(listDate.format(now))}</span>
  </header>
${groups.map(renderGroup).join("")}
  <footer>
    <div class="grand"><span>Skupaj</span><span>${formatEurAmount(grandTotal)} €</span></div>
    ${hasCardDiscount ? `<p class="note">${escapeHtml(CARD_DISCOUNT_TOTAL_NOTE)}</p>` : ""}
  </footer>
</body>
</html>`;
}

// Long enough that a slow reader in the print dialog is never cut off, short
// enough that an abandoned dialog does not leak the frame for the session.
const FRAME_CLEANUP_MS = 5 * 60 * 1000;

/**
 * Opens the browser print dialog on a standalone shopping list, from which the
 * user saves a PDF.
 *
 * A hidden same-origin iframe rather than a popup: `window.open` is what popup
 * blockers stop, and printing in place would need the whole app's stylesheet to
 * be print-aware. The frame is torn down on `afterprint`, with a timer behind
 * it because Safari does not always fire that event.
 */
export function printShoppingList(items: CartItem[]): void {
  if (items.length === 0) return;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  // Parked off-screen at page size rather than collapsed to 0x0 or hidden with
  // `visibility`: the frame still has to lay itself out to be printable.
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;";

  let removed = false;
  const removeFrame = () => {
    if (removed) return;
    removed = true;
    frame.remove();
  };

  frame.onload = () => {
    const frameWindow = frame.contentWindow;
    if (!frameWindow) {
      removeFrame();
      return;
    }
    frameWindow.addEventListener("afterprint", removeFrame, { once: true });
    window.setTimeout(removeFrame, FRAME_CLEANUP_MS);
    frameWindow.focus();
    frameWindow.print();
  };

  // srcdoc before insertion, so the one load event carries the list. An iframe
  // inserted empty first loads `about:blank`, and that load fires soon enough
  // to print a blank page instead.
  frame.srcdoc = renderShoppingListHtml(items);
  document.body.appendChild(frame);
}
