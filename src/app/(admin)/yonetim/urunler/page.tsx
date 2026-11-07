import Link from "next/link";
import Image from "next/image";
import { Plus, Search } from "lucide-react";
import { repo } from "@/lib/data";
import { formatTRY, minPrice } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ProductRowActions } from "@/components/admin/product-row-actions";

const STATUS: Record<string, string> = { active: "Yayında", draft: "Taslak", archived: "Arşiv" };

type SP = { q?: string; durum?: string; stok?: string; kategori?: string; sirala?: string };

const DURUM = [
  { v: "", label: "Tümü", test: (p: Product) => p.status !== "archived" },
  { v: "yayinda", label: "Yayında", test: (p: Product) => p.status === "active" },
  { v: "taslak", label: "Taslak", test: (p: Product) => p.status === "draft" },
  { v: "arsiv", label: "Arşiv", test: (p: Product) => p.status === "archived" },
] as const;

const total = (p: Product) => p.variants.reduce((a, v) => a + v.stock, 0);

const STOK = [
  { v: "", label: "Hepsi", test: () => true },
  { v: "yok", label: "Stokta yok", test: (p: Product) => total(p) === 0 },
  { v: "az", label: "Az stok (≤5)", test: (p: Product) => total(p) > 0 && total(p) <= 5 },
  { v: "eksik", label: "Tükenen beden var", test: (p: Product) => total(p) > 0 && p.variants.some((v) => v.stock === 0) },
  { v: "gorselsiz", label: "Görselsiz", test: (p: Product) => p.media.length === 0 },
  { v: "indirimli", label: "İndirimli", test: (p: Product) => !!p.compareAtPrice && p.compareAtPrice > p.basePrice },
] as const;

const SIRALA: Record<string, { label: string; fn: (a: Product, b: Product) => number }> = {
  "": { label: "En yeni", fn: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  eski: { label: "En eski", fn: (a, b) => a.createdAt.localeCompare(b.createdAt) },
  ad: { label: "Ada göre (A-Z)", fn: (a, b) => a.name.localeCompare(b.name, "tr") },
  "stok-az": { label: "Stok (azdan çoğa)", fn: (a, b) => total(a) - total(b) },
  "stok-cok": { label: "Stok (çoktan aza)", fn: (a, b) => total(b) - total(a) },
  "fiyat-artan": { label: "Fiyat (artan)", fn: (a, b) => minPrice(a) - minPrice(b) },
  "fiyat-azalan": { label: "Fiyat (azalan)", fn: (a, b) => minPrice(b) - minPrice(a) },
  satis: { label: "En çok satan", fn: (a, b) => b.soldCount - a.soldCount },
};

export default async function AdminProducts({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const durum = DURUM.find((d) => d.v === sp.durum) ?? DURUM[0];
  const stok = STOK.find((s) => s.v === sp.stok) ?? STOK[0];
  const sirala = SIRALA[sp.sirala ?? ""] ? (sp.sirala ?? "") : "";

  const [all, categories] = await Promise.all([
    repo.listProducts({ includeArchived: true, q: q || undefined }),
    repo.listAllCategories(),
  ]);

  // Kategori filtresi: ana kategori seçilirse alt kategorileri de dahil
  const catIds = sp.kategori ? [sp.kategori, ...categories.filter((c) => c.parentId === sp.kategori).map((c) => c.id)] : null;
  const inCat = (p: Product) => !catIds || catIds.includes(p.categoryId);

  const base = all.filter(inCat);
  const byStatus = base.filter(durum.test);
  const products = byStatus.filter(stok.test).sort(SIRALA[sirala].fn);

  const href = (patch: Partial<SP>) => {
    const u = new URLSearchParams();
    const next = { q, durum: durum.v, stok: stok.v, kategori: sp.kategori ?? "", sirala, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) u.set(k, v);
    const s = u.toString();
    return `/yonetim/urunler${s ? `?${s}` : ""}`;
  };
  const filtered = !!(q || durum.v || stok.v || sp.kategori || sirala);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Ürünler</h1>
        <Link href="/yonetim/urunler/yeni" className="btn-primary !min-h-10">
          <Plus className="h-4 w-4" /> Yeni ürün
        </Link>
      </div>

      {/* Durum sekmeleri */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line">
        {DURUM.map((d) => {
          const n = base.filter(d.test).length;
          const on = d.v === durum.v;
          return (
            <Link key={d.v} href={href({ durum: d.v })} className={`shrink-0 border-b-2 px-3 py-2 text-sm ${on ? "border-ink font-semibold" : "border-transparent text-muted hover:text-ink"}`}>
              {d.label} <span className="ml-1 rounded-full bg-sand px-1.5 text-xs">{n}</span>
            </Link>
          );
        })}
      </div>

      {/* Stok / diğer filtreler */}
      <div className="flex flex-wrap gap-2">
        {STOK.map((s) => {
          const n = byStatus.filter(s.test).length;
          const on = s.v === stok.v;
          return (
            <Link
              key={s.v}
              href={href({ stok: s.v })}
              className={`rounded-full border px-3 py-1 text-xs ${on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"} ${!on && s.v && n === 0 ? "text-muted" : ""}`}
            >
              {s.label}
              {s.v && <span className="ml-1">({n})</span>}
            </Link>
          );
        })}
      </div>

      {/* Arama, kategori, sıralama */}
      <form className="flex flex-wrap items-end gap-2" action="/yonetim/urunler">
        {durum.v && <input type="hidden" name="durum" value={durum.v} />}
        {stok.v && <input type="hidden" name="stok" value={stok.v} />}
        <label className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Ürün adı veya açıklamada ara" className="input !min-h-10 !py-1 !pl-9 text-base sm:text-sm" />
        </label>
        <select name="kategori" defaultValue={sp.kategori ?? ""} className="input !min-h-10 !w-auto !py-1 text-base sm:text-sm" aria-label="Kategori">
          <option value="">Tüm kategoriler</option>
          {categories
            .filter((c) => !c.parentId)
            .map((r) => [
              <option key={r.id} value={r.id}>{r.name}</option>,
              ...categories
                .filter((c) => c.parentId === r.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>— {c.name}</option>
                )),
            ])}
        </select>
        <select name="sirala" defaultValue={sirala} className="input !min-h-10 !w-auto !py-1 text-base sm:text-sm" aria-label="Sıralama">
          {Object.entries(SIRALA).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button className="btn-outline !min-h-10">Uygula</button>
        {filtered && (
          <Link href="/yonetim/urunler" className="btn-ghost !min-h-10 text-sm">Filtreleri temizle</Link>
        )}
      </form>

      <p className="text-xs text-muted">{products.length} ürün listeleniyor</p>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Ürün</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium">Fiyat</th>
              <th className="px-4 py-3 font-medium">Stok</th>
              <th className="px-4 py-3 font-medium">Satış</th>
              <th className="px-4 py-3 font-medium">Durum</th>
              <th className="px-4 py-3 text-right font-medium">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => {
              const stock = total(p);
              const out = p.variants.filter((v) => v.stock === 0).length;
              return (
                <tr key={p.id} className="hover:bg-canvas">
                  <td className="px-4 py-2.5">
                    <Link href={`/yonetim/urunler/${p.id}`} className="flex items-center gap-3">
                      <span className="w-10 shrink-0 bg-sand">
                        {p.media[0] ? (
                          <Image src={p.media[0].key} alt="" width={240} height={300} sizes="40px" className="aspect-[4/5] w-full object-cover" />
                        ) : (
                          <span className="flex aspect-[4/5] w-full items-center justify-center text-[9px] text-muted">görsel yok</span>
                        )}
                      </span>
                      <span className="font-medium hover:underline">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{categories.find((c) => c.id === p.categoryId)?.name}</td>
                  <td className="px-4 py-2.5">{formatTRY(minPrice(p))}</td>
                  <td className="px-4 py-2.5">
                    {stock === 0 ? <span className="font-medium text-danger">Stokta yok</span> : <span className={stock <= 5 ? "font-medium text-rose" : ""}>{stock} adet</span>}
                    {stock > 0 && out > 0 && <span className="block text-xs text-danger">{out} beden tükendi</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{p.soldCount || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "active" ? "bg-success/10 text-success" : p.status === "archived" ? "bg-ink/10 text-ink-soft" : "bg-sand"}`}>{STATUS[p.status]}</span>
                  </td>
                  <td className="px-2 py-2.5">
                    <ProductRowActions id={p.id} name={p.name} slug={p.slug} status={p.status} />
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                  Bu filtrelere uyan ürün yok.{filtered && <> <Link href="/yonetim/urunler" className="underline">Filtreleri temizle</Link></>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
