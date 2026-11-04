import Image from "next/image";
import { formatDate, formatTRY, ORDER_STATUS_LABEL } from "@/lib/format";
import type { Order } from "@/lib/types";

const STEPS = ["paid", "preparing", "shipped", "delivered"] as const;

export function OrderTimeline({ order }: { order: Order }) {
  if (order.status === "cancelled" || order.status === "refunded")
    return <p className="rounded bg-sand px-4 py-3 text-sm">Durum: <b>{ORDER_STATUS_LABEL[order.status]}</b></p>;
  if (order.status === "pending_payment" || order.status === "awaiting_transfer")
    return <p className="rounded bg-blush-soft px-4 py-3 text-sm">Durum: <b>{ORDER_STATUS_LABEL[order.status]}</b></p>;
  const idx = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  return (
    <ol className="grid grid-cols-4 gap-2 text-center text-xs">
      {STEPS.map((s, i) => (
        <li key={s} className="space-y-2">
          <span className={`block h-1.5 rounded-full ${i <= idx ? "bg-rose" : "bg-line"}`} />
          <span className={i <= idx ? "font-medium" : "text-muted"}>{ORDER_STATUS_LABEL[s]}</span>
        </li>
      ))}
    </ol>
  );
}

export function OrderDetails({ order }: { order: Order }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted">Sipariş no</p>
          <p className="font-mono font-medium">{order.orderNo}</p>
        </div>
        <div>
          <p className="text-muted">Tarih</p>
          <p>{formatDate(order.createdAt, true)}</p>
        </div>
        <div>
          <p className="text-muted">Ödeme</p>
          <p>
            {order.paymentMethod === "card" ? "Kart" : "Havale/EFT"}
            {order.payment?.cardLast4 ? ` · **** ${order.payment.cardLast4}` : ""}
            {order.payment?.installment && order.payment.installment > 1 ? ` · ${order.payment.installment} taksit` : ""}
          </p>
        </div>
      </div>
      <OrderTimeline order={order} />
      {order.trackingNo && (
        <p className="text-sm">
          Kargo: <b>{order.carrier}</b> · Takip no: <span className="font-mono">{order.trackingNo}</span>
        </p>
      )}
      <ul className="divide-y divide-line border-y border-line">
        {order.items.map((i) => (
          <li key={i.variantId + i.sku} className="flex gap-3 py-3">
            <div className="w-14 shrink-0 bg-sand">
              {i.imageKey && <Image src={i.imageKey} alt="" width={240} height={300} sizes="56px" className="aspect-[4/5] w-full object-cover" />}
            </div>
            <div className="flex-1 text-sm">
              <p>{i.productName}</p>
              <p className="text-xs text-muted">
                {i.color} · {i.size} · {i.qty} adet
              </p>
            </div>
            <span className="text-sm">{formatTRY(i.unitPrice * i.qty)}</span>
          </li>
        ))}
      </ul>
      <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between"><dt>Ara toplam</dt><dd>{formatTRY(order.subtotal)}</dd></div>
        {order.discount > 0 && (
          <div className="flex justify-between text-success"><dt>İndirim {order.couponCode && `(${order.couponCode})`}</dt><dd>-{formatTRY(order.discount)}</dd></div>
        )}
        <div className="flex justify-between"><dt>Kargo</dt><dd>{order.shipping ? formatTRY(order.shipping) : "Ücretsiz"}</dd></div>
        <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Toplam</dt><dd>{formatTRY(order.total)}</dd></div>
      </dl>
      <div className="text-sm">
        <p className="text-muted">Teslimat adresi</p>
        <p>
          {order.shippingAddress.fullName} · {order.shippingAddress.line}, {order.shippingAddress.district}/{order.shippingAddress.city}
        </p>
      </div>
    </div>
  );
}
