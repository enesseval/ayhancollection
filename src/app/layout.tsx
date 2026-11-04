import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/playfair-display/index.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Ayşe Ayhan Collection · Tesettür Giyim, Eşarp ve Şal",
    template: "%s · Ayşe Ayhan Collection",
  },
  description:
    "Yüksek kalite, uygun fiyat. Tesettür tunik, takım, elbise, desenli eşarp ve şallar, pijama takımları. Türkiye'nin her yerine kargo, 14 gün iade.",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Ayşe Ayhan Collection",
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#FAF8F6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
