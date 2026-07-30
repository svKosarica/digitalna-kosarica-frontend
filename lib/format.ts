import type { BaseUnit } from "@/types/product.types";

/**
 * Slovenian rendering of a listing's size and its price per unit.
 *
 * Both values come off the listing, never off the product. Both are null
 * together when the store's label could not be parsed, and null here means
 * "render nothing" — no dash, no "0".
 *
 * The only import is type-only, so type stripping erases it and this module can
 * be exercised directly with `node`.
 */

// Slovenian has a dual, so a count has four forms. Intl implements the rule;
// hand-rolling it off the last two digits is how it goes wrong.
const PIECE_FORMS = {
  one: "kos",
  two: "kosa",
  few: "kosi",
  other: "kosov",
  zero: "kosov",
  many: "kosov",
} as const;

const PER_UNIT_LABEL: Record<BaseUnit, string> = {
  g: "€/kg",
  ml: "€/L",
  piece: "€/kos",
  m: "€/m",
};

// "1,16 €/L" does not read aloud usefully.
const PER_UNIT_SPOKEN: Record<BaseUnit, string> = {
  g: "cena na kilogram",
  ml: "cena na liter",
  piece: "cena na kos",
  m: "cena na meter",
};

// Constructed once: these run per card in an auto-fill grid.
const pieceRules = new Intl.PluralRules("sl");
const decimal0 = new Intl.NumberFormat("sl-SI", { maximumFractionDigits: 0 });
const decimal1 = new Intl.NumberFormat("sl-SI", { maximumFractionDigits: 1 });
const decimal2 = new Intl.NumberFormat("sl-SI", { maximumFractionDigits: 2 });
// A price reads as "3,50 €/L", not "3,5 €/L".
const price2 = new Intl.NumberFormat("sl-SI", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
// Four decimals is the wire precision — NUMERIC(10,4) — so this never invents
// digits the API did not send.
const price4 = new Intl.NumberFormat("sl-SI", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/**
 * Two decimals, widening to four when two would collapse a real price to
 * "0,00". Sheet-counted paper reaches that: the backend counts a 20-roll pack
 * as 3000 pieces, so €/piece is 0.0013. Rendering that as "0,00 €/kos" reads as
 * free, and in a price-per-unit sort it would leave a run of identical-looking
 * rows in an order the reader cannot check.
 */
function formatEurAmount(value: number): string {
  const collapsesToZero = value !== 0 && Math.abs(value) < 0.005;
  return collapsesToZero ? price4.format(value) : price2.format(value);
}

/** "1,98 L", "500 g", "5 kosov", "15 cm" — or null when the listing has no parsed size. */
export function formatSize(
  totalQuantity: number | null,
  baseUnit: BaseUnit | null,
): string | null {
  if (totalQuantity == null || baseUnit == null) return null;

  switch (baseUnit) {
    // The grammatical form has to agree with the number actually printed, so
    // round first and select on the result. CLDR Slovenian sends any value with
    // visible fraction digits to `few`, so selecting on a raw 1.5 while
    // printing "2" would read "2 kosi" instead of "2 kosa".
    case "piece": {
      const count = Math.round(totalQuantity);
      // Production carries sub-unit piece counts — a 200 ml sun lotion parsed as
      // 0.2 pieces. "0 kosov" is the "0 as if data were missing" the display
      // contract rejects, so such a listing has no usable size.
      if (count === 0) return null;
      return `${decimal0.format(count)} ${PIECE_FORMS[pieceRules.select(count)]}`;
    }

    // Promote to the larger unit once the number gets big, the way a shelf label would.
    case "g":
      return totalQuantity >= 1000
        ? `${decimal2.format(totalQuantity / 1000)} kg`
        : `${decimal0.format(totalQuantity)} g`;

    case "ml":
      return totalQuantity >= 1000
        ? `${decimal2.format(totalQuantity / 1000)} L`
        : `${decimal0.format(totalQuantity)} ml`;

    // Lengths arrive folded to metres, so a 15 cm label is 0.15 and 5 mm is
    // 0.005. Demote rather than render "0,01 m". A cm label divided by 100 at
    // three decimals can carry one decimal (15,5 cm -> 0.155); an mm label
    // divided by 1000 at three decimals is always a whole number of mm.
    case "m":
      if (totalQuantity >= 1) return `${decimal2.format(totalQuantity)} m`;
      if (totalQuantity >= 0.01) return `${decimal1.format(totalQuantity * 100)} cm`;
      return `${decimal0.format(totalQuantity * 1000)} mm`;

    // A unit the backend added and this build does not know. baseUnit arrives as
    // a bare string, so this is reachable: showing no size is honest, while
    // falling through to metres would mislabel every such listing.
    default:
      return null;
  }
}

/** "3,53 €/L", "0,0013 €/kos" — or null when the listing has no parsed size. */
export function formatPricePerUnit(
  pricePerUnit: number | null,
  baseUnit: BaseUnit | null,
): string | null {
  if (pricePerUnit == null || baseUnit == null) return null;
  const label = PER_UNIT_LABEL[baseUnit];
  if (!label) return null;
  return `${formatEurAmount(pricePerUnit)} ${label}`;
}

/** "cena na liter: 3,53 €" — the spoken form of formatPricePerUnit's output. */
export function pricePerUnitAriaLabel(
  pricePerUnit: number | null,
  baseUnit: BaseUnit | null,
): string | null {
  if (pricePerUnit == null || baseUnit == null) return null;
  const spoken = PER_UNIT_SPOKEN[baseUnit];
  if (!spoken) return null;
  return `${spoken}: ${formatEurAmount(pricePerUnit)} €`;
}
