"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { archiveProduct, saveProduct } from "@/app/actions/admin";
import { slugify } from "@/lib/format";
import { MarkdownField } from "./markdown-field";
import { VariantBuilder, useVariantBuilder, type VariantRow } from "./variant-builder";
import type { Category, Product } from "@/lib/types";
import { Flash, useAdminAction } from "./order-actions";

const tl = (k: number | null | undefined) => (k == null ? "" : (k / 100).toFixed(2).replace(/\.00$/, ""));
const kurus = (s: string) => Math.round(Number(String(s).replace(",", ".")) * 100);

export function ProductEditor({ product, categories }: { product: Product | null; categories: Category[] }) {
  const router = useRouter();
  const { pending, msg, run } = useAdminAction();
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!product);
  const skuBase = (slug || slugify(name)).split("-").map((w) => w[0]).join("").toUpperCase().slice(0, 5) || "URN";
  const initialRows = useMemo<VariantRow[]>(
    () => product?.variants.map((v) => ({ ...v, priceOverride: tl(v.priceOverride) })) ?? [],
    [product],
  );
  const vb = useVariantBuilder(initialRows, skuBase);
  const [variantError, setVariantError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Renk ve beden seçimi zorunlu
    if (vb.colors.length === 0 || vb.sizes.length === 0) {
      setVariantError(vb.colors.length === 0 ? "En az bir renk seçin." : "En az bir beden seçin.");
      document.getElementById("varyantlar")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setVariantError(null);
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
      variants: vb.rows.map((r) => ({
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
          sizes={vb.orderedSizes}
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

      <div id="varyantlar" className="card scroll-mt-24 space-y-4 p-5 xl:col-span-2">
        <h2 className="font-sans text-sm font-semibold">Renk, beden ve stok</h2>
        <VariantBuilder vb={vb} />
        {variantError && <p className="field-error" role="alert">{variantError}</p>}
      </div>
    </form>
  );
}
