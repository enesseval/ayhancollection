import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/lib/data";
import { OrderDetails } from "@/components/order/order-details";
import { OrderActions } from "@/components/admin/order-actions";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const order = await repo.getOrderById(id);
  if (!order) notFound();
  return (
    <div className="space-y-6">
      <Link href="/yonetim/siparisler" className="text-sm text-muted hover:text-ink">← Siparişler</Link>
      <h1 className="text-3xl">Sipariş {order.orderNo}</h1>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="card p-5">
          <OrderDetails order={order} />
          {order.note && <p className="mt-4 rounded bg-canvas p-3 text-sm">Not: {order.note}</p>}
        </div>
        <div className="space-y-4">
          <div className="card space-y-1 p-5 text-sm">
            <h2 className="mb-2 font-sans font-semibold">Müşteri</h2>
            <p>{order.shippingAddress.fullName}</p>
            <p className="text-muted">{order.email}</p>
            <p className="text-muted">{order.phone}</p>
            <p className="pt-2 text-xs text-muted">
              Sözleşme sürümü {order.consents.contractVersion} · Pazarlama izni: {order.consents.marketing ? "var" : "yok"}
              {order.utm?.utm_source && ` · Kaynak: ${order.utm.utm_source}${order.utm.utm_medium ? "/" + order.utm.utm_medium : ""}`}
            </p>
          </div>
          <OrderActions order={order} />
        </div>
      </div>
    </div>
  );
}
