import "./globals.css";
import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";

const APP_NAME = "Digitalna Košarica";
const APP_DESCRIPTION =
  "Primerjajte cene izdelkov med slovenskimi trgovinami — Spar, Mercator, Hofer in Lidl — in prihranite pri vsakem nakupu.";
const APP_URL = "https://digitalna-kosarica.si";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: "website",
    locale: "sl_SI",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    url: APP_URL,
    images: [
      {
        url: "/images/logo_kosarica.png",
        width: 1200,
        height: 630,
        alt: APP_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ["/images/logo_kosarica.png"],
  },
  icons: {
    icon: "/images/logo_kosarica.png",
    apple: "/images/logo_kosarica.png",
  },
};

const inter_display = Inter({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--display-family",
});

const inter_body = Inter({
  subsets: ["latin"],
  weight: ["400", "900"],
  variable: "--body-family",
});

const geist_mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="sl"
      className={`${inter_display.variable} ${inter_body.variable} ${geist_mono.variable}`}
    >
      <body className="font-body">{children}</body>
    </html>
  );
}
