import type { MetadataRoute } from "next";
import { repo } from "@/lib/data";
import { LEGAL_PAGES } from "@/lib/legal";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const [products, categories] = await Promise.all([repo.listProducts({}), repo.listCategories()]);
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...["yeni", "cok-satanlar", "indirim"].map((s) => ({ url: `${base}/kategori/${s}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...categories.map((c) => ({ url: `${base}/kategori/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/urun/${p.slug}`, lastModified: p.createdAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...Object.keys(LEGAL_PAGES).map((k) => ({ url: `${base}/${k}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
