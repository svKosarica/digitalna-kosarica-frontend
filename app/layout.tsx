import "./globals.css";
import { Inter, Geist_Mono } from "next/font/google";

const inter_display = Inter({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--display-family",
});

const inter_body = Inter({
  subsets: ["latin"],
  weight: ["400"],
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
      lang="en"
      className={`${inter_display.variable} ${inter_body.variable} ${geist_mono.variable}`}
    >
      <body className="font-body">{children}</body>
    </html>
  );
}
