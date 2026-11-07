import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/lib/data";
import { ProductEditor } from "@/components/admin/product-editor";
import { MediaManager } from "@/components/admin/media-manager";

export default async function AdminProductEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [categories, sizeCharts] = await Promise.all([repo.listCategories(), repo.listSizeCharts()]);
  const product = id === "yeni" ? null : /^[0-9a-f-]{36}$/.test(id) ? await repo.getProductById(id) : null;
  if (id !== "yeni" && !product) notFound();
  return (
    <div className="space-y-6">
      <Link href="/yonetim/urunler" className="text-sm text-muted hover:text-ink">← Ürünler</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">{product ? product.name : "Yeni ürün"}</h1>
        {product?.status === "active" && (
          <Link href={`/urun/${product.slug}`} target="_blank" className="text-sm underline">Mağazada gör ↗</Link>
        )}
      </div>
      {product && (
        <MediaManager productId={product.id} productName={product.name} media={product.media} colors={[...new Set(product.variants.map((v) => v.color))]} />
      )}
      <ProductEditor product={product} categories={categories} sizeCharts={sizeCharts} />
    </div>
  );
}
