import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CookieBanner } from "@/components/shop/cookie-banner";
import { UtmCapture } from "@/components/shop/utm-capture";
import { repo, isDemoData } from "@/lib/data";
import { features } from "@/lib/env";

export function DemoBar() {
  if (!isDemoData && features.iyzico) return null;
  const parts = [isDemoData && "örnek ürün verisi", !features.iyzico && "test ödemesi"].filter(Boolean).join(" ve ");
  return (
    <div className="bg-blush-soft px-4 py-1.5 text-center text-[12px] text-ink">
      <b>Demo sürüm:</b> Bu sitede {parts} kullanılıyor; gerçek sipariş ve ödeme alınmaz.
    </div>
  );
}

export async function SiteChrome({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([repo.listCategories(), repo.getSettings()]);
  return (
    <>
      <a href="#icerik" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:bg-white focus:p-3">
        İçeriğe geç
      </a>
      <DemoBar />
      <Header categories={categories} announcement={settings.announcement} />
      <main id="icerik">{children}</main>
      <Footer settings={settings} />
      <CartDrawer freeShippingThreshold={settings.freeShippingThreshold} />
      <CookieBanner />
      <UtmCapture />
    </>
  );
}
