export type StoreName = "spar" | "mercator" | "hofer" | "lidl" | "tus";

/**
 * Per-store display data.
 *
 * `lineColor` is only read by the multi-store price chart. It is a CSS var
 * reference rather than a hex literal so the palette stays in globals.css with
 * every other colour in the app.
 */
export const STORE_LOGOS: Record<
  StoreName,
  { label: string; logoUrl: string; lineColor: string }
> = {
  spar:     { label: "Spar",     logoUrl: "/images/spar.png",     lineColor: "var(--store-spar)"     },
  mercator: { label: "Mercator", logoUrl: "/images/mercator.png", lineColor: "var(--store-mercator)" },
  hofer:    { label: "Hofer",    logoUrl: "/images/hofer.png",    lineColor: "var(--store-hofer)"    },
  lidl:     { label: "Lidl",     logoUrl: "/images/lidl.png",     lineColor: "var(--store-lidl)"     },
  tus:      { label: "Tuš",      logoUrl: "/images/tus.png",      lineColor: "var(--store-tus)"      },
};
