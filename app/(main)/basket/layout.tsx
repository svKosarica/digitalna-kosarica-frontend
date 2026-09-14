import type { Metadata } from "next";

/**
 * Exists only to carry the route's metadata: basket/page.tsx is a client
 * component (it reads the cart context), and a client component cannot export
 * `metadata`. Without this the basket fell back to the bare site-wide title.
 *
 * noIndex because the page is meaningless to a crawler — its contents live in
 * the visitor's own localStorage.
 */
export const metadata: Metadata = {
  title: "Moja košarica",
  description:
    "Vaša košarica s skupno ceno po trgovinah in seznamom za nakup.",
  robots: { index: false, follow: true },
};

export default function BasketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
