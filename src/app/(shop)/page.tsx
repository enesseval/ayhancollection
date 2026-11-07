import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { InstagramIcon as Instagram } from "@/components/icons";
import { repo } from "@/lib/data";
import { ProductGrid, ProductCard } from "@/components/product/product-card";
import { ProductImage } from "@/components/product/product-image";
import { TrustBand } from "@/components/layout/footer";
import { Butterfly } from "@/components/brand/logo";
import type { Product } from "@/lib/types";
import { isNewProduct } from "@/lib/format";

export const revalidate = 300;

export default async function HomePage() {
  const [all, categories, settings] = await Promise.all([
    repo.listProducts({ sort: "new" }),
    repo.listCategories(),
    repo.getSettings(),
  ]);
  const newArrivals = all.filter((p) => isNewProduct(p)).slice(0, 8);
  // Gerçek satışa göre, sonra elle işaretlenenler
  const bestsellers = all
    .filter((p) => p.soldCount > 0 || p.isBestseller)
    .sort((a, b) => b.soldCount - a.soldCount || Number(b.isBestseller) - Number(a.isBestseller))
    .slice(0, 10);
  const byCat = (slug: string): Product | undefined => {
    const cat = categories.find((c) => c.slug === slug);
    if (!cat) return undefined;
    const ids = [cat.id, ...categories.filter((c) => c.parentId === cat.id).map((c) => c.id)];
    return all.find((p) => ids.includes(p.categoryId));
  };
  const heroA = all.find((p) => p.slug === "raglan-kol-lacivert-tunik") ?? all[0];
  const heroB = all.find((p) => p.slug === "kahve-sal-desen-ipek-esarp") ?? all[1];
  const heroC = all.find((p) => p.slug === "denim-gorunumlu-yelek-takim") ?? all[2];
  const highlights = [
    { slug: "tesettur-giyim", label: "Tesettür" },
    { slug: "esarp-sal", label: "Eşarp & Şal" },
    { slug: "pijama-ev-giyim", label: "Pijama" },
    { slug: "triko-yun", label: "Yün & Triko" },
    { slug: "erkek", label: "Erkek" },
    { slug: "indirim", label: "İndirim" },
  ];
  const scarf = byCat("esarp-sal");

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-x grid items-center gap-10 py-10 md:grid-cols-[1.05fr_1fr] md:py-16">
          <div className="relative z-10 max-w-xl">
            <p className="eyebrow mb-4 flex items-center gap-2">
              <Butterfly className="h-5 w-7 text-rose" /> Yeni sezon koleksiyonu
            </p>
            <h1 className="text-[2.6rem] leading-[1.05] sm:text-6xl">
              Zarafet,
              <br />
              <em className="text-rose">her gün.</em>
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-ink-soft">
              Tunikten takıma, desenli eşarplardan pijama takımlarına. <b>Yüksek kalite, uygun fiyat</b> ve Türkiye&apos;nin her
              yerine hızlı kargo.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/kategori/yeni" className="btn-primary">
                Yeni gelenleri keşfet <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/kategori/esarp-sal" className="btn-outline">
                Eşarp & Şal
              </Link>
            </div>
          </div>
          <div className="relative grid grid-cols-[1.2fr_1fr] gap-3 sm:gap-4">
            <Link href={`/urun/${heroA.slug}`} className="row-span-2 overflow-hidden rounded-t-[999px] bg-sand transition-opacity hover:opacity-90">
              <ProductImage media={heroA.media[0]} sizes="(max-width: 768px) 55vw, 30vw" preload />
            </Link>
            <Link href={`/urun/${heroB.slug}`} className="overflow-hidden rounded-t-[999px] bg-sand transition-opacity hover:opacity-90">
              <ProductImage media={heroB.media[0]} sizes="(max-width: 768px) 45vw, 22vw" preload />
            </Link>
            <Link href={`/urun/${heroC.slug}`} className="overflow-hidden bg-sand transition-opacity hover:opacity-90">
              <ProductImage media={heroC.media[0]} sizes="(max-width: 768px) 45vw, 22vw" />
            </Link>
          </div>
        </div>
      </section>

      {/* Instagram öne çıkanlar tarzı kategori şeridi */}
      <section aria-label="Kategoriler" className="container-x">
        <ul className="no-scrollbar -mx-4 flex gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:justify-center sm:gap-8 sm:px-0">
          {highlights.map((h) => {
            const p = h.slug === "indirim" ? all.find((x) => x.compareAtPrice) : byCat(h.slug);
            return (
              <li key={h.slug} className="shrink-0">
                <Link href={`/kategori/${h.slug}`} className="group flex w-20 flex-col items-center gap-2 sm:w-24">
                  <span className="block rounded-full bg-gradient-to-tr from-blush via-rose/70 to-blush p-[2.5px] transition-transform duration-200 group-hover:scale-105">
                    <span className="block overflow-hidden rounded-full border-2 border-canvas bg-sand">
                      <span className="block h-[70px] w-[70px] sm:h-[84px] sm:w-[84px] [&_img]:h-full [&_img]:object-cover">
                        <ProductImage media={p?.media[0]} sizes="96px" />
                      </span>
                    </span>
                  </span>
                  <span className="text-center text-xs font-medium">{h.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Yeni gelenler */}
      <section className="container-x mt-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="eyebrow">Bu hafta</p>
            <h2 className="mt-1 text-3xl">Yeni Gelenler</h2>
          </div>
          <Link href="/kategori/yeni" className="text-sm font-medium underline-offset-4 hover:underline">
            Tümünü gör
          </Link>
        </div>
        <ProductGrid products={newArrivals} />
      </section>

      {/* Eşarp vitrin */}
      {scarf && (
        <section className="mt-20 bg-sand/60">
          <div className="container-x grid items-center gap-8 py-12 md:grid-cols-2">
            <div className="mx-auto w-full max-w-md overflow-hidden rounded-t-[999px]">
              <ProductImage media={scarf.media[scarf.media.length - 1]} sizes="(max-width: 768px) 90vw, 40vw" />
            </div>
            <div className="max-w-md">
              <p className="eyebrow">Koleksiyon</p>
              <h2 className="mt-2 text-4xl">Eşarp & Şal</h2>
              <p className="mt-4 leading-7 text-ink-soft">
                Şal desenlerinden zebra ve dalga motiflerine; ipeksi twill dokusuyla kaymayan, yumuşak dökümlü eşarplar. Her
                kombine bir imza.
              </p>
              <Link href="/kategori/esarp-sal" className="btn-primary mt-6">
                Eşarpları incele <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Çok satanlar */}
      <section className="mt-20">
        <div className="container-x mb-6 flex items-end justify-between">
          <div>
            <p className="eyebrow">En sevilenler</p>
            <h2 className="mt-1 text-3xl">Çok Satanlar</h2>
          </div>
          <Link href="/kategori/cok-satanlar" className="text-sm font-medium underline-offset-4 hover:underline">
            Tümünü gör
          </Link>
        </div>
        <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto px-4 sm:px-6 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]">
          {bestsellers.map((p) => (
            <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-[22%]">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </section>

      {/* Instagram / memnuniyet */}
      <section className="container-x mt-20">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-white px-6 py-12 text-center">
          <Instagram className="h-8 w-8 text-rose" strokeWidth={1.4} />
          <h2 className="text-3xl">Bizi Instagram&apos;da takip edin</h2>
          <p className="max-w-lg text-ink-soft">
            Yeni ürünler, kombin önerileri, çekilişler ve müşterilerimizin memnuniyet paylaşımları @{settings.instagram} hesabında.
          </p>
          <a
            href={`https://www.instagram.com/${settings.instagram}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
          >
            @{settings.instagram}
          </a>
        </div>
      </section>

      <div className="mt-20">
        <TrustBand />
      </div>
    </>
  );
}
