import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { features } from "@/lib/env";
import { formatTRY } from "@/lib/format";
import { loadOrder, verifyOrderToken } from "@/lib/order-access";
import { demoPay } from "@/app/actions/checkout";

export const metadata: Metadata = { title: "Demo ödeme", robots: { index: false } };

// iyzico anahtarları girilene kadar 3D Secure adımını simüle eder. Gerçek kart bilgisi ALINMAZ.
export default async function DemoPaymentPage({ searchParams }: { searchParams: Promise<{ o?: string; t?: string }> }) {
  if (features.iyzico) notFound();
  const { o = "", t = "" } = await searchParams;
  if (!verifyOrderToken(o, t)) notFound();
  const order = await loadOrder(o);
  if (!order) notFound();
  if (order.status !== "pending_payment") redirect(`/odeme/sonuc?no=${order.orderNo}&t=${t}`);

  return (
    <div className="container-x flex justify-center py-12">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <span className="rounded bg-blush-soft px-2 py-1 text-xs font-semibold">DEMO 3D SECURE</span>
          <ShieldCheck className="h-6 w-6 text-success" />
        </div>
        <h1 className="text-2xl">Ödeme onayı</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Bu ekran, iyzico anahtarları girilene kadar bankanın 3D Secure doğrulamasını taklit eder. Kart bilgisi istenmez ve hiçbir
          ücret çekilmez.
        </p>
        <dl className="mt-5 space-y-2 rounded bg-canvas p-4 text-sm">
          <div className="flex justify-between"><dt>Sipariş</dt><dd className="font-mono">{order.orderNo}</dd></div>
          <div className="flex justify-between"><dt>Tutar</dt><dd className="font-semibold">{formatTRY(order.total)}</dd></div>
          <div className="flex justify-between"><dt>Test kartı</dt><dd className="font-mono">5528 79** **** 0008</dd></div>
        </dl>
        <form action={demoPay} className="mt-5 space-y-3">
          <input type="hidden" name="o" value={order.id} />
          <input type="hidden" name="t" value={t} />
          <label className="block text-sm">
            <span className="label">Taksit</span>
            <select name="installment" className="input" defaultValue="1">
              <option value="1">Tek çekim</option>
              <option value="3">3 taksit</option>
              <option value="6">6 taksit</option>
            </select>
          </label>
          <button name="outcome" value="success" className="btn-primary w-full">Ödemeyi onayla (başarılı)</button>
          <button name="outcome" value="fail" className="btn-outline w-full">Kart reddedildi (başarısız simülasyonu)</button>
        </form>
      </div>
    </div>
  );
}
