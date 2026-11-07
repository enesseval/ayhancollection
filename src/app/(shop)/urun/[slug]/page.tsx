import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/lib/data";
import { env } from "@/lib/env";
import { formatTRY, mediaUrl } from "@/lib/format";
import { ProductView } from "@/components/product/product-view";
import { ProductCard } from "@/components/product/product-card";
import { thumbDataUrl } from "@/components/product/product-image";
import { Markdown, markdownToPlain } from "@/components/markdown";

export const revalidate = 300;

export async function generateStaticParams() {
  const products = await repo.listProducts({});
  return products.map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await repo.getProductBySlug(slug);
  if (!p) return {};
  const img = p.media[0] ? mediaUrl(p.media[0].key, 960) : undefined;
  return {
    title: p.name,
    description: markdownToPlain(p.description).slice(0, 155),
    alternates: { canonical: `/urun/${p.slug}` },
    openGraph: { title: p.name, description: markdownToPlain(p.description).slice(0, 155), images: img ? [{ url: img, width: 960, height: 1200 }] : [] },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await repo.getProductBySlug(slug);
  if (!product) notFound();
  const [categories, settings] = await Promise.all([repo.listCategories(), repo.getSettings()]);
  const cat = categories.find((c) => c.id === product.categoryId);
  const parent = cat?.parentId ? categories.find((c) => c.id === cat.parentId) : null;
  const root = parent ?? cat;
  const sizeChart =
    root?.slug === "esarp-sal" ? "esarp" : root?.slug === "pijama-ev-giyim" ? "pijama" : root?.slug === "erkek" ? "erkek" : "tesettur";
  const related = (await repo.listProducts({ categorySlug: root?.slug, limit: 9 })).filter((p) => p.id !== product.id).slice(0, 4);

  // Yalnız ilk görsellere bulanık önizleme (HTML boyutunu küçük tutmak için)
  const placeholders = Object.fromEntries(product.media.slice(0, 3).map((m) => [m.key, thumbDataUrl(m.thumbhash)]));
  const inStock = product.variants.some((v) => v.stock > 0);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: markdownToPlain(product.description),
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: "Ayşe Ayhan Collection" },
    image: product.media.map((m) => new URL(mediaUrl(m.key, 960), env.siteUrl).toString()),
    offers: {
      "@type": "Offer",
      priceCurrency: "TRY",
      price: (product.basePrice / 100).toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${env.siteUrl}/urun/${product.slug}`,
    },
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana sayfa", item: env.siteUrl },
      ...(root ? [{ "@type": "ListItem", position: 2, name: root.name, item: `${env.siteUrl}/kategori/${root.slug}` }] : []),
      { "@type": "ListItem", position: root ? 3 : 2, name: product.name },
    ],
  };

  return (
    <div className="container-x py-6 pb-28 lg:pb-10">
      <script
        type="application/ld+json"
        // JSON.stringify + "<" kaçışı: script enjeksiyonunu önler
        dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, breadcrumb]).replace(/</g, "\\u003c") }}
      />
      <nav aria-label="Konum" className="mb-4 text-xs text-muted">
        <Link href="/" className="hover:text-ink">Ana sayfa</Link>
        {root && (
          <>
            {" / "}
            <Link href={`/kategori/${root.slug}`} className="hover:text-ink">{root.name}</Link>
          </>
        )}
        {cat && cat.id !== root?.id && (
          <>
            {" / "}
            <Link href={`/kategori/${cat.slug}`} className="hover:text-ink">{cat.name}</Link>
          </>
        )}
      </nav>
      <ProductView
        product={product}
        placeholders={placeholders}
        whatsapp={settings.whatsapp}
        sizeChart={sizeChart}
        // Metinler sunucuda Markdown'dan işlenir; istemciye Markdown kütüphanesi gitmez
        details={[
          { title: "Ürün açıklaması", body: <Markdown>{product.description}</Markdown> , filled: !!product.description.trim() },
          { title: "Kumaş ve ölçüler", body: <Markdown>{product.fabric}</Markdown>, filled: !!product.fabric.trim() },
          { title: "Bakım", body: <Markdown>{product.care}</Markdown>, filled: !!product.care.trim() },
          {
            title: "Kargo ve iade",
            body: (
              <Markdown>
                {`Siparişleriniz **1-3 iş günü** içinde kargoya verilir. ${formatTRY(settings.freeShippingThreshold)} ve üzeri siparişlerde kargo **ücretsizdir**. Teslimattan itibaren **14 gün** içinde iade edebilirsiniz.`}
              </Markdown>
            ),
            filled: true,
          },
        ]}
      />

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-3xl">Bunları da beğenebilirsiniz</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
