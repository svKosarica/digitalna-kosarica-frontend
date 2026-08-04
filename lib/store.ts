export type StoreName = "spar" | "mercator" | "hofer" | "lidl" | "tus";

export const STORE_LOGOS: Record<StoreName, { label: string; logoUrl: string }> = {
  spar:     { label: "Spar",     logoUrl: "/images/spar.png"     },
  mercator: { label: "Mercator", logoUrl: "/images/mercator.png" },
  hofer:    { label: "Hofer",    logoUrl: "/images/hofer.png"    },
  lidl:     { label: "Lidl",     logoUrl: "/images/lidl.png"     },
  tus:      { label: "Tuš",      logoUrl: "/images/tus.png"      },
};
