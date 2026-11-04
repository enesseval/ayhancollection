import Link from "next/link";
import { repo } from "@/lib/data";
import { formatDate, formatTRY, ORDER_STATUS_LABEL } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

const FILTERS: (OrderStatus | "")[] = ["", "paid", "awaiting_transfer", "preparing", "shipped", "delivered", "pending_payment", "cancelled"];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ durum?: string; q?: string }> }) {
  const { durum = "", q = "" } = await searchParams;
  const status = FILTERS.find((f) => f === durum) || undefined;
  const orders = await repo.listOrders({ status, q: q.slice(0, 60) || undefined });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Siparişler</h1>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f || "all"}
            href={`/yonetim/siparisler${f ? `?durum=${f}` : ""}`}
            className={`rounded-full border px-3 py-1.5 text-xs ${f === (status ?? "") ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
          >
            {f ? ORDER_STATUS_LABEL[f] : "Tümü"}
          </Link>
        ))}
        <form className="ml-auto">
          {status && <input type="hidden" name="durum" value={status} />}
          <input name="q" defaultValue={q} placeholder="Sipariş no, e-posta, isim" className="input !min-h-9 !py-1 text-sm" />
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Sipariş</th>
              <th className="px-4 py-3 font-medium">Müşteri</th>
              <th className="px-4 py-3 font-medium">Tarih</th>
              <th className="px-4 py-3 font-medium">Ödeme</th>
              <th className="px-4 py-3 font-medium">Durum</th>
              <th className="px-4 py-3 text-right font-medium">Tutar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-canvas">
                <td className="px-4 py-3 font-mono">
                  <Link href={`/yonetim/siparisler/${o.id}`} className="underline-offset-2 hover:underline">{o.orderNo}</Link>
                </td>
                <td className="px-4 py-3">
                  {o.shippingAddress.fullName}
                  <span className="block text-xs text-muted">{o.shippingAddress.city}</span>
                </td>
                <td className="px-4 py-3 text-muted">{formatDate(o.createdAt, true)}</td>
                <td className="px-4 py-3">{o.paymentMethod === "card" ? "Kart" : "Havale"}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-sand px-2 py-0.5 text-xs">{ORDER_STATUS_LABEL[o.status]}</span></td>
                <td className="px-4 py-3 text-right font-medium">{formatTRY(o.total)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Sipariş bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
