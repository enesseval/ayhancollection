import { repo } from "@/lib/data";
import { formatDate, formatTRY } from "@/lib/format";
import { CouponForm } from "@/components/admin/coupon-form";

export default async function AdminCoupons() {
  const coupons = await repo.listCoupons();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Kuponlar</h1>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Kod</th>
                <th className="px-4 py-3 font-medium">İndirim</th>
                <th className="px-4 py-3 font-medium">Min. sepet</th>
                <th className="px-4 py-3 font-medium">Kullanım</th>
                <th className="px-4 py-3 font-medium">Bitiş</th>
                <th className="px-4 py-3 font-medium">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                  <td className="px-4 py-3">{c.type === "percent" ? `%${c.value}` : formatTRY(c.value)}</td>
                  <td className="px-4 py-3">{c.minSubtotal ? formatTRY(c.minSubtotal) : "—"}</td>
                  <td className="px-4 py-3">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                  <td className="px-4 py-3 text-muted">{c.endsAt ? formatDate(c.endsAt) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${c.active ? "bg-success/10 text-success" : "bg-sand"}`}>{c.active ? "Aktif" : "Pasif"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CouponForm coupons={coupons} />
      </div>
    </div>
  );
}
