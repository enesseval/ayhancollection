// Seed verisini tek bir kompakt SQL'e çevirir (JSON + jsonb_array_elements). node scripts/generate-seed-compact.ts
import { writeFileSync } from "node:fs";
import { seedCategories, seedCoupons, seedProducts, seedSettings } from "../src/lib/seed/catalog.ts";

const j = (v: unknown) => "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb";
const cats = [...seedCategories].sort((a, b) => Number(!!a.parentId) - Number(!!b.parentId)).map((c) => [c.id, c.parentId, c.slug, c.name, c.description ?? null, c.sort]);
const prods = seedProducts.map((p) => [p.id, p.slug, p.name, p.description, p.fabric, p.care, p.categoryId, p.basePrice, p.compareAtPrice, p.isNew, p.isBestseller, p.createdAt]);
const media = seedProducts.flatMap((p) => p.media.map((m, i) => [p.id, m.key, m.thumbhash, m.alt, m.color ?? null, i]));
const vars = seedProducts.flatMap((p) => p.variants.map((v) => [v.id, p.id, v.sku, v.size, v.color, v.colorHex, v.stock]));
const sql = `
insert into public.categories (id, parent_id, slug, name, description, sort)
select (e->>0)::uuid, (e->>1)::uuid, e->>2, e->>3, e->>4, (e->>5)::int from jsonb_array_elements(${j(cats)}) e on conflict (id) do nothing;
insert into public.products (id, slug, name, description, fabric, care, category_id, base_price, compare_at_price, status, is_new, is_bestseller, created_at)
select (e->>0)::uuid, e->>1, e->>2, e->>3, e->>4, e->>5, (e->>6)::uuid, (e->>7)::int, (e->>8)::int, 'active', (e->>9)::bool, (e->>10)::bool, (e->>11)::timestamptz from jsonb_array_elements(${j(prods)}) e on conflict (id) do nothing;
insert into public.product_media (product_id, storage_key, width, height, thumbhash, alt, color, sort)
select (e->>0)::uuid, e->>1, 1600, 2000, e->>2, e->>3, e->>4, (e->>5)::int from jsonb_array_elements(${j(media)}) e;
insert into public.product_variants (id, product_id, sku, size, color, color_hex, stock)
select (e->>0)::uuid, (e->>1)::uuid, e->>2, e->>3, e->>4, e->>5, (e->>6)::int from jsonb_array_elements(${j(vars)}) e on conflict (id) do nothing;
insert into public.coupons (id, code, type, value, min_subtotal, ends_at, usage_limit, used_count, active)
select (e->>'id')::uuid, e->>'code', e->>'type', (e->>'value')::int, (e->>'minSubtotal')::int, (e->>'endsAt')::timestamptz, (e->>'usageLimit')::int, 0, true from jsonb_array_elements(${j(seedCoupons)}) e on conflict (id) do nothing;
insert into public.settings (id, data) values (1, ${j(seedSettings)}) on conflict (id) do update set data = excluded.data;
`.trim();
writeFileSync("supabase/seed.sql", "-- Otomatik üretildi: node scripts/generate-seed-compact.ts\n" + sql + "\n");
console.log(sql.length);
