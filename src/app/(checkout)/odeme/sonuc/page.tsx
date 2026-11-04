import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { repo } from "@/lib/data";
import { formatTRY } from "@/lib/format";
import { canViewOrder, loadOrderByNo } from "@/lib/order-access";
import { OrderDetails } from "@/components/order/order-details";
import { ClearCartOnMount } from "@/components/checkout/clear-cart";

export const metadata: Metadata = { title: "Sipariş sonucu", robots: { index: false } };

export default async function ResultPage({ searchParams }: { searchParams: Promise<{ no?: string; t?: string }> }) {
  const { no = "", t } = await searchParams;
  const order = no ? await loadOrderByNo(no) : null;
  if (!order || !(await canViewOrder(order, t))) notFound();
  const settings = await repo.getSettings();

  const paid = ["paid", "preparing", "shipped", "delivered"].includes(order.status);
  const transfer = order.status === "awaiting_transfer";
  const failed = order.status === "cancelled";

  return (
    <div className="container-x max-w-3xl py-10">
      {(paid || transfer) && <ClearCartOnMount />}
      <div className="mb-8 text-center">
        {paid && <CheckCircle2 className="mx-auto h-12 w-12 text-success" strokeWidth={1.5} />}
        {transfer && <Clock className="mx-auto h-12 w-12 text-rose" strokeWidth={1.5} />}
        {failed && <XCircle className="mx-auto h-12 w-12 text-danger" strokeWidth={1.5} />}
        {order.status === "pending_payment" && <Clock className="mx-auto h-12 w-12 text-muted" strokeWidth={1.5} />}
        <h1 className="mt-4 text-3xl">
          {paid && "Siparişiniz alındı, teşekkürler!"}
          {transfer && "Siparişiniz alındı, ödemenizi bekliyoruz"}
          {failed && "Ödeme tamamlanamadı"}
          {order.status === "pending_payment" && "Ödemeniz kontrol ediliyor"}
        </h1>
        <p className="mt-2 text-ink-soft">
          {paid && `Onay e-postası ${order.email} adresine gönderildi. Siparişiniz 1-3 iş günü içinde kargoya verilecek.`}
          {failed && "Kartınızdan çekim yapılmadı. Sepetiniz duruyor; tekrar deneyebilirsiniz."}
          {order.status === "pending_payment" && "Birkaç dakika içinde bu sayfayı yenileyin."}
        </p>
      </div>

      {transfer && (
        <div className="mb-8 rounded-md border border-blush bg-blush-soft p-5">
          <p className="text-sm">
            Lütfen <b>{formatTRY(order.total)}</b> tutarındaki ödemenizi 24 saat içinde aşağıdaki hesaba yapın. Açıklama kısmına{" "}
            <b className="font-mono">{order.orderNo}</b> yazmayı unutmayın.
          </p>
          {settings.bankAccounts.map((b) => (
            <div key={b.iban} className="mt-3 rounded bg-white p-3 text-sm">
              <p>{b.bank} · {b.holder}</p>
              <p className="font-mono font-semibold tracking-wide">{b.iban}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card p-5 sm:p-6">
        <OrderDetails order={order} />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {failed ? (
          <Link href="/odeme" className="btn-primary">Tekrar dene</Link>
        ) : (
          <Link href="/" className="btn-primary">Alışverişe devam et</Link>
        )}
        <Link href="/siparis-takip" className="btn-outline">Sipariş takibi</Link>
      </div>
    </div>
  );
}
