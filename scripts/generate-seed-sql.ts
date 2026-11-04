// Demo kataloğunu Supabase seed SQL'ine dönüştürür: node scripts/generate-seed-sql.ts
import { writeFile } from "node:fs/promises";
import { seedCategories, seedCoupons, seedProducts, seedSettings } from "../src/lib/seed/catalog.ts";

const q = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return "'" + String(v).replace(/'/g, "''") + "'";
};

const lines: string[] = ["-- Otomatik üretildi: node scripts/generate-seed-sql.ts", "begin;"];

// Önce üst kategoriler
const cats = [...seedCategories].sort((a, b) => Number(!!a.parentId) - Number(!!b.parentId));
for (const c of cats) {
  lines.push(
    `insert into public.categories (id, parent_id, slug, name, description, sort) values (${q(c.id)}, ${q(c.parentId)}, ${q(c.slug)}, ${q(c.name)}, ${q(c.description ?? null)}, ${c.sort}) on conflict (id) do nothing;`,
  );
}
for (const p of seedProducts) {
  lines.push(
    `insert into public.products (id, slug, name, description, fabric, care, category_id, base_price, compare_at_price, status, is_new, is_bestseller, vat_rate, created_at) values (${[
      p.id, p.slug, p.name, p.description, p.fabric, p.care, p.categoryId, p.basePrice, p.compareAtPrice, p.status, p.isNew, p.isBestseller, p.vatRate, p.createdAt,
    ].map(q).join(", ")}) on conflict (id) do nothing;`,
  );
  p.media.forEach((m, i) =>
    lines.push(
      `insert into public.product_media (product_id, storage_key, width, height, thumbhash, alt, color, sort) values (${[
        p.id, m.key, m.width, m.height, m.thumbhash, m.alt, m.color ?? null, i,
      ].map(q).join(", ")});`,
    ),
  );
  for (const v of p.variants) {
    lines.push(
      `insert into public.product_variants (id, product_id, sku, size, color, color_hex, stock, price_override) values (${[
        v.id, p.id, v.sku, v.size, v.color, v.colorHex, v.stock, v.priceOverride,
      ].map(q).join(", ")}) on conflict (id) do nothing;`,
    );
  }
}
for (const c of seedCoupons) {
  lines.push(
    `insert into public.coupons (id, code, type, value, min_subtotal, starts_at, ends_at, usage_limit, used_count, active) values (${[
      c.id, c.code, c.type, c.value, c.minSubtotal, c.startsAt, c.endsAt, c.usageLimit, c.usedCount, c.active,
    ].map(q).join(", ")}) on conflict (id) do nothing;`,
  );
}
lines.push(
  `insert into public.settings (id, data) values (1, ${q(JSON.stringify(seedSettings))}::jsonb) on conflict (id) do update set data = excluded.data;`,
);
lines.push("commit;");

await writeFile("supabase/seed.sql", lines.join("\n") + "\n");
console.log(`seed.sql: ${lines.length} satır`);
