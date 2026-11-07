import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { repo } from "@/lib/data";
import { ProductGrid } from "@/components/product/product-card";
import { FilterBar } from "@/components/shop/filter-bar";
import type { ProductQuery } from "@/lib/types";

const SPECIAL: Record<string, { name: string; description: string; q: ProductQuery }> = {
  yeni: { name: "Yeni Gelenler", description: "Koleksiyona en son eklenen ürünler", q: { onlyNew: true } },
  "cok-satanlar": { name: "Çok Satanlar", description: "En çok tercih edilen ürünler", q: { onlyBestseller: true } },
  indirim: { name: "İndirimli Ürünler", description: "Kaçırılmayacak fiyatlar", q: { onlyDiscounted: true } },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ beden?: string; renk?: string; sirala?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const special = SPECIAL[slug];
  if (special) return { title: special.name, description: special.description, alternates: { canonical: `/kategori/${slug}` } };
  const cat = (await repo.listCategories()).find((c) => c.slug === slug);
  if (!cat) return { title: "Sayfa bulunamadı", robots: { index: false } };
  return {
    title: cat.name,
    description: cat.description ?? `${cat.name} modelleri uygun fiyat ve hızlı kargo ile Ayşe Ayhan Collection'da.`,
    alternates: { canonical: `/kategori/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const categories = await repo.listCategories();
  const special = SPECIAL[slug];
  const cat = categories.find((c) => c.slug === slug);
  if (!special && !cat) notFound();

  const base: ProductQuery = special ? special.q : { categorySlug: slug };
  const sort = (["new", "popular", "price_asc", "price_desc"] as const).find((s) => s === sp.sirala) ?? "new";
  const unfiltered = await repo.listProducts(base);
  const products = await repo.listProducts({ ...base, size: sp.beden, color: sp.renk, sort });

  const sizeOrder = ["S", "M", "L", "XL", "2XL", "S/M", "L/XL", "36", "38", "40", "42", "44", "46"];
  const sizes = [...new Set(unfiltered.flatMap((p) => p.variants.map((v) => v.size)))].sort(
    (a, b) => (sizeOrder.indexOf(a) + 1 || 99) - (sizeOrder.indexOf(b) + 1 || 99),
  );
  const colors = [...new Map(unfiltered.flatMap((p) => p.variants.map((v) => [v.color, v.colorHex] as const))).entries()].map(
    ([name, hex]) => ({ name, hex }),
  );
  const parent = cat?.parentId ? categories.find((c) => c.id === cat.parentId) : null;
  const children = cat ? categories.filter((c) => c.parentId === (cat.parentId ?? cat.id)) : [];
  const title = special?.name ?? cat!.name;

  return (
    <div className="container-x py-8">
      <nav aria-label="Konum" className="mb-4 text-xs text-muted">
        <Link href="/" className="hover:text-ink">Ana sayfa</Link>
        {parent && (
          <>
            {" / "}
            <Link href={`/kategori/${parent.slug}`} className="hover:text-ink">{parent.name}</Link>
          </>
        )}
        {" / "}
        <span className="text-ink">{title}</span>
      </nav>
      <h1 className="text-4xl">{title}</h1>
      {(special?.description || cat?.description) && <p className="mt-2 text-ink-soft">{special?.description ?? cat?.description}</p>}

      {children.length > 0 && (
        <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto">
          {parent || cat?.parentId ? (
            <Link href={`/kategori/${parent!.slug}`} className="shrink-0 rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-ink">
              Tümü
            </Link>
          ) : (
            <span className="shrink-0 rounded-full border border-ink bg-ink px-4 py-2 text-sm text-white">Tümü</span>
          )}
          {children.map((c) => (
            <Link
              key={c.id}
              href={`/kategori/${c.slug}`}
              aria-current={c.slug === slug ? "page" : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm ${c.slug === slug ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        {/* Yer ayrılır: filtre çubuğu hidrasyonda belirince ızgara kaymasın (CLS) */}
        <Suspense fallback={<div className="border-y border-line" style={{ minHeight: sizes.length > 1 && colors.length > 1 ? 158 : sizes.length > 1 || colors.length > 1 ? 110 : 62 }} aria-hidden="true" />}>
          <FilterBar sizes={sizes} colors={colors} total={products.length} />
        </Suspense>
      </div>
      <div className="mt-8">
        {products.length ? (
          <ProductGrid products={products} preloadFirst={4} heading="h2" />
        ) : (
          <div className="py-20 text-center text-ink-soft">
            Bu filtrelere uygun ürün bulunamadı.{" "}
            <Link href={`/kategori/${slug}`} className="underline">Filtreleri temizle</Link>
          </div>
        )}
      </div>
    </div>
  );
}
