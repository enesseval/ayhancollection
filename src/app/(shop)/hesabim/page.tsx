import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { getSessionUser, DEMO_PASSWORD_DEFAULT } from "@/lib/auth";
import { repo } from "@/lib/data";
import { env, features } from "@/lib/env";
import { formatDate, formatTRY, ORDER_STATUS_LABEL } from "@/lib/format";
import { orderToken } from "@/lib/order-access";
import { AuthForms } from "@/components/account/forms";
import { logoutAction } from "@/app/actions/account";

export const metadata: Metadata = { title: "Hesabım", robots: { index: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "" } = await searchParams;
  const user = await getSessionUser();
  if (user?.role === "admin") redirect("/yonetim");

  if (!user) {
    const pw = env.demoAdminPassword ? "DEMO_ADMIN_PASSWORD ortam değişkenindeki şifre" : DEMO_PASSWORD_DEFAULT;
    const demoHint = features.supabase
      ? null
      : `Demo hesaplar — müşteri: musteri@ayseayhan.demo · yönetici: ${env.demoAdminEmail} · şifre: ${pw}`;
    return (
      <div className="container-x py-12">
        <h1 className="mb-8 text-center text-4xl">Hesabım</h1>
        <AuthForms next={safeNext(next, "/hesabim")} demoHint={demoHint} />
        <p className="mt-8 text-center text-sm text-muted">
          Üye olmadan verdiğiniz siparişler için <Link href="/siparis-takip" className="underline">sipariş takibi</Link> sayfasını kullanın.
        </p>
      </div>
    );
  }

  const orders = await repo.listOrdersForUser(user.id);
  return (
    <div className="container-x max-w-4xl py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Hoş geldiniz</p>
          <h1 className="text-4xl">{user.fullName || user.email}</h1>
        </div>
        <form action={logoutAction}>
          <button className="btn-outline">Çıkış yap</button>
        </form>
      </div>
      <h2 className="mt-10 mb-4 text-2xl">Siparişlerim</h2>
      {orders.length === 0 ? (
        <p className="text-ink-soft">Henüz siparişiniz yok. <Link href="/kategori/yeni" className="underline">Yeni gelenlere göz atın.</Link></p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/odeme/sonuc?no=${o.orderNo}&t=${orderToken(o.id)}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-white">
                <span>
                  <span className="font-mono text-sm font-medium">{o.orderNo}</span>
                  <span className="block text-xs text-muted">{formatDate(o.createdAt)} · {o.items.length} ürün</span>
                </span>
                <span className="rounded-full bg-sand px-3 py-1 text-xs">{ORDER_STATUS_LABEL[o.status]}</span>
                <span className="font-semibold">{formatTRY(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm text-muted">
        Üye olmadan (giriş yapmadan) verdiğiniz siparişler burada görünmez; onlar için{" "}
        <Link href="/siparis-takip" className="underline">sipariş takibi</Link> sayfasını kullanın.
      </p>
      <p className="mt-2 text-sm text-muted">
        İade talebi için siparişin teslim tarihinden itibaren 14 gün içinde WhatsApp hattımıza sipariş numaranızla yazabilirsiniz.
      </p>
    </div>
  );
}
