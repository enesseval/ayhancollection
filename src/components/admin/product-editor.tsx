"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { archiveProduct, saveProduct } from "@/app/actions/admin";
import { slugify } from "@/lib/format";
import { MarkdownField } from "./markdown-field";
import { VariantTable, useVariantRows, type VariantRow } from "./variant-table";
import type { Category, Product, SizeChart } from "@/lib/types";
import { Flash, useAdminAction } from "./order-actions";

const tl = (k: number | null | undefined) => (k == null ? "" : (k / 100).toFixed(2).replace(/\.00$/, ""));
const kurus = (s: string) => Math.round(Number(String(s).replace(",", ".")) * 100);

export function ProductEditor({ product, categories, sizeCharts }: { product: Product | null; categories: Category[]; sizeCharts: SizeChart[] }) {
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
  const vt = useVariantRows(initialRows, skuBase);
  const [variantError, setVariantError] = useState<string | null>(null);

  // Kaydedilmemiş değişiklik takibi: form alanları + varyant seçimi
  const [formDirty, setFormDirty] = useState(false);
  const variantSig = JSON.stringify(vt.rows.map((r) => [r.color, r.colorHex, r.size, r.stock, r.priceOverride, r.sku]));
  const [savedSig, setSavedSig] = useState(variantSig);
  const dirty = formDirty || variantSig !== savedSig;
  useUnsavedGuard(dirty);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Her satırda renk ve beden seçimi zorunlu
    const problem =
      vt.rows.length === 0
        ? "En az bir varyant ekleyin (renk + beden)."
        : vt.incomplete >= 0
          ? `${vt.incomplete + 1}. satırda renk ve beden seçilmeli.`
          : vt.duplicate
            ? `${vt.duplicate} iki kez eklenmiş; birini silin.`
            : null;
    if (problem) {
      setVariantError(problem);
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
      measurements: String(f.get("measurements") ?? ""),
      care: String(f.get("care") ?? ""),
      categoryId: String(f.get("categoryId") ?? ""),
      basePrice: kurus(String(f.get("basePrice") ?? "0")),
      compareAtPrice: compare ? kurus(compare) : null,
      status: String(f.get("status")),
      isNew: f.get("isNew") === "on",
      isBestseller: f.get("isBestseller") === "on",
      sizeChartId: String(f.get("sizeChartId") ?? "") || null,
      variants: vt.rows.map((r, i) => ({
        id: r.id,
        sku: r.sku.trim() || vt.autoSku(r.color, r.size, i),
        size: r.size,
        color: r.color,
        colorHex: r.colorHex,
        stock: Number(r.stock) || 0,
        priceOverride: r.priceOverride ? kurus(r.priceOverride) : null,
      })),
    };
    run(async () => {
      const res = await saveProduct(payload);
      if (res.ok) {
        setFormDirty(false);
        setSavedSig(variantSig);
      }
      if (res.ok && !product && res.id) router.replace(`/yonetim/urunler/${res.id}`);
      return res;
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      onInput={() => setFormDirty(true)}
      onChange={() => setFormDirty(true)}
      className="grid gap-6 pb-4 xl:grid-cols-[1.4fr_1fr]"
    >
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
          label="Kumaş"
          rows={2}
          defaultValue={product?.fabric}
          placeholder="Örn. %100 Viskon, dökümlü ve terletmez"
        />
        <MarkdownField
          name="measurements"
          label="Ölçüler"
          rows={6}
          defaultValue={product?.measurements}
          sizes={vt.allSizes}
          placeholder={"Ölçü tablosu için tablo butonuna basın; seçtiğiniz bedenler tabloya otomatik gelir.\nÖrn. Model 1,72 m ve 38 beden giyiyor."}
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
                <option value={p.id}>{p.name} (genel){p.isActive === false ? " — gizli" : ""}</option>
                {categories.filter((c) => c.parentId === p.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.isActive === false ? " — gizli" : ""}</option>
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
        <div>
          <label className="label" htmlFor="sizeChartId">Beden tablosu</label>
          <select id="sizeChartId" name="sizeChartId" className="input" defaultValue={product?.sizeChartId ?? ""}>
            <option value="">Yok (buton gösterilmez)</option>
            {sizeCharts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <a href="/yonetim/beden-tablolari" target="_blank" className="mt-1 inline-block text-xs text-muted underline">Beden tablolarını yönet ↗</a>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isNew" defaultChecked={product?.isNew} className="h-4 w-4 accent-ink" /> &quot;Yeni&quot; rozeti <span className="text-xs text-muted">(son 30 günde eklenenler zaten yeni sayılır)</span></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isBestseller" defaultChecked={product?.isBestseller} className="h-4 w-4 accent-ink" /> Çok satanlarda göster <span className="text-xs text-muted">(satışı olanlar otomatik listelenir)</span></label>
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
        <h2 className="font-sans text-sm font-semibold">Varyantlar ve stok</h2>
        <VariantTable vt={vt} />
        {variantError && <p className="field-error" role="alert">{variantError}</p>}
      </div>

      {/* Sabit kaydet çubuğu: sayfanın neresinde olunursa olsun görünür */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 text-sm">
            {pending ? (
              <span className="text-muted">Kaydediliyor…</span>
            ) : dirty ? (
              <span className="flex items-center gap-2 font-medium text-rose">
                <span className="h-2 w-2 rounded-full bg-rose" /> Kaydedilmemiş değişiklikler var
              </span>
            ) : msg ? (
              <Flash msg={msg} />
            ) : (
              <span className="text-muted">Tüm değişiklikler kaydedildi</span>
            )}
          </div>
          <button className="btn-primary min-w-40" disabled={pending}>{pending ? "Kaydediliyor…" : "Kaydet"}</button>
        </div>
        {dirty && msg && !msg.ok && <div className="mt-1"><Flash msg={msg} /></div>}
      </div>
    </form>
  );
}

/** Kaydedilmemiş değişiklik varken sayfadan çıkışta uyarır (yenileme, sekme kapatma ve panel içi bağlantılar) */
function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const url = new URL(href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      if (!confirm("Kaydedilmemiş değişiklikler var. Kaydetmeden çıkmak istiyor musunuz?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
