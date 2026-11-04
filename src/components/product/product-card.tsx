import Link from "next/link";
import { formatTRY } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ProductImage } from "./product-image";

export function ProductCard({ product, preload = false }: { product: Product; preload?: boolean }) {
  const totalStock = product.variants.reduce((a, v) => a + v.stock, 0);
  const colors = [...new Map(product.variants.map((v) => [v.color, v.colorHex])).entries()];
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.basePrice
      ? Math.round((1 - product.basePrice / product.compareAtPrice) * 100)
      : 0;
  const second = product.media[1];
  return (
    <article className="group relative">
      <Link href={`/urun/${product.slug}`} className="block" aria-label={product.name}>
        <div className="relative overflow-hidden bg-sand">
          <ProductImage media={product.media[0]} sizes="(max-width: 768px) 50vw, 25vw" preload={preload} />
          {second && (
            <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 max-md:hidden">
              <ProductImage media={second} sizes="25vw" />
            </div>
          )}
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {product.isNew && <span className="bg-white/95 px-2 py-0.5 text-[11px] font-medium tracking-wide">YENİ</span>}
            {discount > 0 && <span className="bg-blush px-2 py-0.5 text-[11px] font-semibold">%{discount} İNDİRİM</span>}
          </div>
          {totalStock === 0 ? (
            <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1.5 text-center text-xs text-white">Tükendi</span>
          ) : totalStock <= 5 ? (
            <span className="absolute inset-x-0 bottom-0 bg-white/90 py-1.5 text-center text-xs text-ink">Son {totalStock} ürün</span>
          ) : null}
        </div>
        <div className="mt-3 space-y-1">
          <h3 className="line-clamp-2 font-sans text-sm leading-snug text-ink">{product.name}</h3>
          <p className="flex items-baseline gap-2 text-sm">
            <span className="font-semibold">{formatTRY(product.basePrice)}</span>
            {discount > 0 && <s className="text-xs text-muted">{formatTRY(product.compareAtPrice!)}</s>}
          </p>
          {colors.length > 1 && (
            <div className="flex gap-1.5 pt-0.5" aria-label={`${colors.length} renk`}>
              {colors.map(([name, hex]) => (
                <span key={name} title={name} className="h-3 w-3 rounded-full border border-line" style={{ background: hex }} />
              ))}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}

export function ProductGrid({ products, preloadFirst = 0 }: { products: Product[]; preloadFirst?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} preload={i < preloadFirst} />
      ))}
    </div>
  );
}
