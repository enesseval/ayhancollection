"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { archiveProduct, saveProduct } from "@/app/actions/admin";
import { slugify } from "@/lib/format";
import { MarkdownField } from "./markdown-field";
import type { Category, Product } from "@/lib/types";
import { Flash, useAdminAction } from "./order-actions";

type Row = { id: string; sku: string; size: string; color: string; colorHex: string; stock: number; priceOverride: string };

const tl = (k: number | null | undefined) => (k == null ? "" : (k / 100).toFixed(2).replace(/\.00$/, ""));
const kurus = (s: string) => Math.round(Number(String(s).replace(",", ".")) * 100);

export function ProductEditor({ product, categories }: { product: Product | null; categories: Category[] }) {
  const router = useRouter();
  const { pending, msg, run } = useAdminAction();
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!product);
  const [rows, setRows] = useState<Row[]>(
    product?.variants.map((v) => ({ ...v, priceOverride: tl(v.priceOverride) })) ?? [],
  );
  const [matrixColors, setMatrixColors] = useState("");
  const [matrixSizes, setMatrixSizes] = useState("36, 38, 40, 42, 44, 46");
  const [matrixHex, setMatrixHex] = useState("#1F2A44");

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const skuBase = (slug || slugify(name)).split("-").map((w) => w[0]).join("").toUpperCase().slice(0, 5) || "URN";

  const genMatrix = () => {
    const colors = matrixColors.split(",").map((s) => s.trim()).filter(Boolean);
    const sizes = matrixSizes.split(",").map((s) => s.trim()).filter(Boolean);
    const add: Row[] = [];
    colors.forEach((c, ci) =>
      sizes.forEach((s, si) => {
        if (rows.some((r) => r.color === c && r.size === s)) return;
        add.push({
          id: "",
          color: c,
          colorHex: matrixHex,
          size: s,
          stock: 0,
          priceOverride: "",
          sku: `${skuBase}-${ci + 1 + new Set(rows.map((r) => r.color)).size}${String(si + 1).padStart(2, "0")}-${s.replace(/[^A-Z0-9]/gi, "")}`.toUpperCase(),
        });
      }),
    );
    setRows((r) => [...r, ...add]);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const compare = String(f.get("compareAtPrice") ?? "").trim();
    const payload = {
      id: product?.id ?? "",
      name,
      slug: slug || slugify(name),
      description: String(f.get("description") ?? ""),
      fabric: String(f.get("fabric") ?? ""),
      care: String(f.get("care") ?? ""),
      categoryId: String(f.get("categoryId") ?? ""),
      basePrice: kurus(String(f.get("basePrice") ?? "0")),
      compareAtPrice: compare ? kurus(compare) : null,
      status: String(f.get("status")),
      isNew: f.get("isNew") === "on",
      isBestseller: f.get("isBestseller") === "on",
      variants: rows.map((r) => ({
        id: r.id,
        sku: r.sku,
        size: r.size,
        color: r.color,
        colorHex: r.colorHex,
        stock: Number(r.stock) || 0,
        priceOverride: r.priceOverride ? kurus(r.priceOverride) : null,
      })),
    };
    run(async () => {
      const res = await saveProduct(payload);
      if (res.ok && !product && res.id) router.replace(`/yonetim/urunler/${res.id}`);
      return res;
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="name">Ürün adı</label>
          <input
            id="name"
            className="input"
            value={name}
            required
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="slug">Adres (URL)</label>
          <div className="flex items-center gap-2 text-sm text-muted">
            /urun/
            <input id="slug" className="input" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} pattern="[a-z0-9-]{2,80}" />
          </div>
        </div>
        <MarkdownField name="description" label="Açıklama" rows={5} defaultValue={product?.description} placeholder="Ürünü birkaç cümleyle anlatın." />
        <MarkdownField
          name="fabric"
          label="Kumaş ve ölçüler"
          rows={6}
          defaultValue={product?.fabric}
          sizes={[...new Set(rows.map((r) => r.size).filter(Boolean))]}
          placeholder={"**Kumaş:** %100 Viskon\n\nÖlçü tablosu için tablo butonuna basın."}
        />
        <MarkdownField name="care" label="Bakım" rows={3} defaultValue={product?.care ?? "30°C'de tersten yıkayın."} />
      </div>

      <div className="card h-fit space-y-4 p-5">
        <div>
          <label className="label" htmlFor="categoryId">Kategori</label>
          <select id="categoryId" name="categoryId" className="input" defaultValue={product?.categoryId ?? ""} required>
            <option value="" disabled>Seçin</option>
            {categories.filter((c) => !c.parentId).map((p) => (
              <optgroup key={p.id} label={p.name}>
                <option value={p.id}>{p.name} (genel)</option>
                {categories.filter((c) => c.parentId === p.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="basePrice">Fiyat (TL)</label>
            <input id="basePrice" name="basePrice" inputMode="decimal" className="input" defaultValue={tl(product?.basePrice)} required />
          </div>
          <div>
            <label className="label" htmlFor="compareAtPrice">Üstü çizili fiyat</label>
            <input id="compareAtPrice" name="compareAtPrice" inputMode="decimal" className="input" defaultValue={tl(product?.compareAtPrice)} placeholder="isteğe bağlı" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="status">Durum</label>
          <select id="status" name="status" className="input" defaultValue={product?.status ?? "draft"}>
            <option value="draft">Taslak (mağazada görünmez)</option>
            <option value="active">Yayında</option>
            <option value="archived">Arşiv</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isNew" defaultChecked={product?.isNew} className="h-4 w-4 accent-ink" /> &quot;Yeni&quot; rozeti</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isBestseller" defaultChecked={product?.isBestseller} className="h-4 w-4 accent-ink" /> Çok satanlarda göster</label>
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Kaydediliyor…" : "Kaydet"}</button>
        <Flash msg={msg} />
        {product && product.status !== "archived" && (
          <button
            type="button"
            className="btn-ghost w-full text-danger"
            disabled={pending}
            onClick={() => confirm("Ürün arşivlensin mi? Mağazadan kalkar, sipariş geçmişi korunur.") && run(() => archiveProduct(product.id))}
          >
            Arşivle
          </button>
        )}
      </div>

      <div className="card space-y-4 p-5 xl:col-span-2">
        <h2 className="font-sans text-sm font-semibold">Varyantlar ve stok</h2>
        <div className="grid gap-3 rounded bg-canvas p-3 sm:grid-cols-[1fr_1.3fr_auto_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="mc">Renkler (virgülle)</label>
            <input id="mc" className="input" value={matrixColors} onChange={(e) => setMatrixColors(e.target.value)} placeholder="Lacivert, Vizon" />
          </div>
          <div>
            <label className="label" htmlFor="ms">Bedenler (virgülle)</label>
            <input id="ms" className="input" value={matrixSizes} onChange={(e) => setMatrixSizes(e.target.value)} />
          </div>
          <input type="color" aria-label="Renk kodu" value={matrixHex} onChange={(e) => setMatrixHex(e.target.value)} className="h-11 w-14 rounded border border-line" />
          <button type="button" className="btn-outline" onClick={genMatrix}><Wand2 className="h-4 w-4" /> Matris oluştur</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-2 pr-2 font-medium">Renk</th>
                <th className="py-2 pr-2 font-medium">Kod</th>
                <th className="py-2 pr-2 font-medium">Beden</th>
                <th className="py-2 pr-2 font-medium">SKU</th>
                <th className="py-2 pr-2 font-medium">Stok</th>
                <th className="py-2 pr-2 font-medium">Özel fiyat (TL)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1.5 pr-2"><input className="input !min-h-9 !py-1" value={r.color} onChange={(e) => update(i, { color: e.target.value })} /></td>
                  <td className="py-1.5 pr-2"><input type="color" className="h-9 w-12 rounded border border-line" value={r.colorHex} onChange={(e) => update(i, { colorHex: e.target.value })} aria-label="Renk kodu" /></td>
                  <td className="py-1.5 pr-2"><input className="input !min-h-9 !w-20 !py-1" value={r.size} onChange={(e) => update(i, { size: e.target.value })} /></td>
                  <td className="py-1.5 pr-2"><input className="input !min-h-9 !py-1 font-mono text-xs" value={r.sku} onChange={(e) => update(i, { sku: e.target.value })} /></td>
                  <td className="py-1.5 pr-2"><input type="number" min={0} className={`input !min-h-9 !w-24 !py-1 ${r.stock === 0 ? "!border-danger/40" : ""}`} value={r.stock} onChange={(e) => update(i, { stock: Number(e.target.value) })} /></td>
                  <td className="py-1.5 pr-2"><input inputMode="decimal" className="input !min-h-9 !w-28 !py-1" value={r.priceOverride} placeholder="—" onChange={(e) => update(i, { priceOverride: e.target.value })} /></td>
                  <td className="py-1.5"><button type="button" className="p-2 text-muted hover:text-danger" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label="Varyantı sil"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setRows((r) => [...r, { id: "", sku: `${skuBase}-${r.length + 1}`, size: "", color: r[r.length - 1]?.color ?? "", colorHex: r[r.length - 1]?.colorHex ?? "#000000", stock: 0, priceOverride: "" }])}
        >
          <Plus className="h-4 w-4" /> Varyant ekle
        </button>
      </div>
    </form>
  );
}
