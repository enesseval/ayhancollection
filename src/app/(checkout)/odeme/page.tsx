import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getSessionUser } from "@/lib/auth";
import { repo } from "@/lib/data";
import { features } from "@/lib/env";

export const metadata: Metadata = { title: "Ödeme", robots: { index: false } };

const ERRORS: Record<string, string> = {
  odeme: "Ödeme tamamlanamadı, kartınızdan çekim yapılmadı. Bilgilerinizi kontrol edip tekrar deneyebilirsiniz.",
  limit: "Çok fazla başarısız ödeme denemesi yapıldı. Lütfen 10 dakika sonra tekrar deneyin.",
  siparis: "Sipariş bulunamadı. Lütfen tekrar deneyin.",
};

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ hata?: string }> }) {
  const { hata } = await searchParams;
  const [user, settings] = await Promise.all([getSessionUser(), repo.getSettings()]);
  return (
    <div className="container-x py-8">
      <h1 className="mb-6 text-3xl">Ödeme</h1>
      {hata && ERRORS[hata] && (
        <p role="alert" className="mb-6 rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {ERRORS[hata]}
        </p>
      )}
      <CheckoutForm
        defaultEmail={user?.role === "customer" ? user.email : ""}
        defaultName={user?.role === "customer" ? user.fullName : ""}
        loggedIn={!!user}
        threshold={settings.freeShippingThreshold}
        demoPayment={!features.iyzico}
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
      />
    </div>
  );
}
