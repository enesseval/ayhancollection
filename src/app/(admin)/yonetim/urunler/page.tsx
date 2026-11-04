import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { repo } from "@/lib/data";
import { formatTRY } from "@/lib/format";

const STATUS: Record<string, string> = { active: "Yayında", draft: "Taslak", archived: "Arşiv" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [products, categories] = await Promise.all([
    repo.listProducts({ includeInactive: true, q: q.slice(0, 60) || undefined }),
    repo.listCategories(),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Ürünler</h1>
        <div className="flex gap-2">
          <form>
            <input name="q" defaultValue={q} placeholder="Ürün ara" className="input !min-h-10 !py-1 text-sm" />
          </form>
          <Link href="/yonetim/urunler/yeni" className="btn-primary !min-h-10">
            <Plus className="h-4 w-4" /> Yeni ürün
          </Link>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Ürün</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium">Fiyat</th>
              <th className="px-4 py-3 font-medium">Stok</th>
              <th className="px-4 py-3 font-medium">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => {
              const stock = p.variants.reduce((a, v) => a + v.stock, 0);
              const out = p.variants.filter((v) => v.stock === 0).length;
              return (
                <tr key={p.id} className="hover:bg-canvas">
                  <td className="px-4 py-2.5">
                    <Link href={`/yonetim/urunler/${p.id}`} className="flex items-center gap-3">
                      <span className="w-10 shrink-0 bg-sand">
                        {p.media[0] && <Image src={p.media[0].key} alt="" width={240} height={300} sizes="40px" className="aspect-[4/5] w-full object-cover" />}
                      </span>
                      <span className="font-medium hover:underline">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{categories.find((c) => c.id === p.categoryId)?.name}</td>
                  <td className="px-4 py-2.5">{formatTRY(p.basePrice)}</td>
                  <td className="px-4 py-2.5">
                    {stock} adet
                    {out > 0 && <span className="block text-xs text-danger">{out} varyant tükendi</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "active" ? "bg-success/10 text-success" : "bg-sand"}`}>{STATUS[p.status]}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
