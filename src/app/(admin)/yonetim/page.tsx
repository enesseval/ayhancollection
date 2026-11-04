import Link from "next/link";
import { repo } from "@/lib/data";
import { formatDate, formatTRY, ORDER_STATUS_LABEL } from "@/lib/format";

export default async function AdminDashboard() {
  const [stats, orders] = await Promise.all([repo.dashboardStats(), repo.listOrders({ limit: 8 })]);
  const tiles = [
    { label: "Bugünkü sipariş", value: String(stats.todayOrders) },
    { label: "Bugünkü ciro", value: formatTRY(stats.todayRevenue) },
    { label: "Bu ayki ciro", value: formatTRY(stats.monthRevenue) },
    { label: "Hazırlanacak", value: String(stats.toPrepare), href: "/yonetim/siparisler?durum=paid" },
    { label: "Havale bekleyen", value: String(stats.awaitingTransfer), href: "/yonetim/siparisler?durum=awaiting_transfer" },
  ];
  return (
    <div className="space-y-8">
      <h1 className="text-3xl">Pano</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => {
          const inner = (
            <>
              <p className="text-xs text-muted">{t.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</p>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="card p-4 hover:border-ink">{inner}</Link>
          ) : (
            <div key={t.label} className="card p-4">{inner}</div>
          );
        })}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-sans text-sm font-semibold">Son siparişler</h2>
            <Link href="/yonetim/siparisler" className="text-xs underline">Tümü</Link>
          </div>
          <ul className="divide-y divide-line text-sm">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/yonetim/siparisler/${o.id}`} className="grid grid-cols-[1fr_auto] gap-1 px-4 py-3 hover:bg-canvas sm:grid-cols-[1.2fr_1fr_auto_auto] sm:items-center sm:gap-4">
                  <span className="font-mono">{o.orderNo}</span>
                  <span className="truncate text-muted">{o.shippingAddress.fullName} · {formatDate(o.createdAt)}</span>
                  <span className="rounded-full bg-sand px-2 py-0.5 text-xs">{ORDER_STATUS_LABEL[o.status]}</span>
                  <span className="text-right font-medium">{formatTRY(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-sans text-sm font-semibold">Düşük stok (≤ 2)</h2>
          </div>
          <ul className="divide-y divide-line text-sm">
            {stats.lowStock.map((v) => (
              <li key={v.sku} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate">{v.productName}</span>
                  <span className="text-xs text-muted">{v.color} · {v.size} · {v.sku}</span>
                </span>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${v.stock === 0 ? "bg-danger/10 text-danger" : "bg-blush-soft"}`}>
                  {v.stock === 0 ? "Tükendi" : `${v.stock} adet`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
