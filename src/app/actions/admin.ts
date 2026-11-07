"use server";
import { randomBytes } from "node:crypto";
import { features } from "@/lib/env";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { requireAdmin, AdminError } from "@/lib/admin-guard";
import { categoryFormSchema, couponFormSchema, productFormSchema, sizeChartSchema } from "@/lib/validation";
import { deleteProductImage } from "@/lib/media/storage";
import { sendOrderUpdate } from "@/lib/email";

// E-posta servisi bağlı değilken "gönderildi" denmesin
const MAIL_NOTE = () => (features.resend ? ", müşteriye e-posta gönderildi" : " (e-posta servisi bağlanınca müşteriye otomatik gidecek)");
import type { OrderStatus, Settings } from "@/lib/types";
import { z } from "zod";
import { capitalizeFirst, ORDER_STATUS_LABEL } from "@/lib/format";
import { TRACKABLE, allowedFrom, canTransition } from "@/lib/order-status";

export type AdminResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

async function guard<T>(fn: (actorId: string) => Promise<T>): Promise<T | AdminResult> {
  try {
    const admin = await requireAdmin();
    return await fn(admin.id);
  } catch (e) {
    if (e instanceof AdminError) return { ok: false, error: e.message };
    console.error("[admin]", e);
    return { ok: false, error: friendlyError(e) };
  }
}

/** Ham veritabanı hatalarını yöneticiye anlaşılır Türkçe mesaja çevirir */
function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (/products_slug_key/.test(msg)) return "Bu adres (URL) başka bir ürün tarafından kullanılıyor. Farklı bir adres yazın.";
  if (/sku/i.test(msg) && /duplicate key/.test(msg)) return "Aynı SKU başka bir üründe kullanılıyor. SKU'yu değiştirip tekrar kaydedin.";
  if (/coupons_code_key/.test(msg)) return "Bu kupon kodu zaten var.";
  if (/duplicate key/.test(msg)) return "Bu kayıt zaten var.";
  if (/violates foreign key/.test(msg)) return "Bu kayıt başka kayıtlarda (ör. siparişlerde) kullanıldığı için değiştirilemiyor.";
  if (/violates check constraint/.test(msg)) return "Girilen değerlerden biri geçersiz. Lütfen formu kontrol edin.";
  // Kendi fırlattığımız Türkçe mesajlar olduğu gibi gösterilir; ham İngilizce hata gösterilmez
  if (msg && /[çğıöşüÇĞİÖŞÜ]/.test(msg)) return msg;
  return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
}

function revalidateCatalog(slug?: string) {
  revalidatePath("/");
  revalidatePath("/kategori/[slug]", "page");
  if (slug) revalidatePath(`/urun/${slug}`);
}

export async function saveProduct(raw: unknown): Promise<AdminResult> {
  return guard(async (actor) => {
    const parsed = productFormSchema.safeParse(raw);
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Geçersiz form" };
    const d = parsed.data;
    const skus = d.variants.map((v) => v.sku.toUpperCase());
    if (new Set(skus).size !== skus.length) return { ok: false as const, error: "SKU'lar benzersiz olmalı" };
    const combos = d.variants.map((v) => `${v.color}|${v.size}`);
    if (new Set(combos).size !== combos.length) return { ok: false as const, error: "Aynı renk/beden kombinasyonu iki kez girilmiş" };
    // Yayına alma kuralı: en az 1 görsel ve stoğu olan en az 1 beden
    if (d.status === "active") {
      const existing = d.id ? await repo.getProductById(d.id) : null;
      const imageCount = existing?.media.length ?? 0;
      const hasStock = d.variants.some((v) => v.stock > 0);
      if (!imageCount || !hasStock) {
        const missing = [!imageCount && "en az 1 görsel", !hasStock && "stoğu olan en az 1 beden"].filter(Boolean).join(" ve ");
        return {
          ok: false as const,
          error: `Yayına almak için ${missing} gerekli.${!imageCount && !d.id ? " Ürünü önce taslak olarak kaydedin, ardından görsel ekleyip yayına alın." : ""}`,
        };
      }
    }
    const saved = await repo.upsertProduct(
      {
        ...d,
        name: capitalizeFirst(d.name),
        id: d.id || undefined,
        variants: d.variants.map((v) => ({ ...v, id: v.id || "", sku: v.sku.toUpperCase() })),
      },
      actor,
    );
    revalidateCatalog(saved.slug);
    return {
      ok: true as const,
      message: saved.slug !== d.slug ? `Ürün kaydedildi. Adres başka bir üründe kullanıldığı için "${saved.slug}" olarak ayarlandı.` : "Ürün kaydedildi",
      id: saved.id,
    };
  }) as Promise<AdminResult>;
}

export async function archiveProduct(id: string): Promise<AdminResult> {
  return guard(async (actor) => {
    const p = await repo.getProductById(z.string().uuid().parse(id));
    await repo.archiveProduct(id, actor);
    revalidateCatalog(p?.slug);
    return { ok: true as const, message: "Ürün arşivlendi" };
  }) as Promise<AdminResult>;
}

export async function removeMedia(productId: string, key: string): Promise<AdminResult> {
  return guard(async (actor) => {
    const p = await repo.getProductById(z.string().uuid().parse(productId));
    if (!p || !p.media.some((m) => m.key === key)) return { ok: false as const, error: "Görsel bulunamadı" };
    if (p.status === "active" && p.media.length === 1)
      return { ok: false as const, error: "Yayındaki ürünün son görseli silinemez. Önce yeni görsel ekleyin ya da ürünü taslağa alın." };
    await repo.removeProductMedia(productId, key, actor);
    await deleteProductImage(key).catch((e) => console.error("[media delete]", e));
    revalidateCatalog(p.slug);
    return { ok: true as const };
  }) as Promise<AdminResult>;
}

export async function reorderMedia(productId: string, keys: string[]): Promise<AdminResult> {
  return guard(async (actor) => {
    const p = await repo.getProductById(z.string().uuid().parse(productId));
    if (!p) return { ok: false as const, error: "Ürün bulunamadı" };
    const valid = keys.filter((k) => p.media.some((m) => m.key === k));
    await repo.reorderProductMedia(productId, valid, actor);
    revalidateCatalog(p.slug);
    return { ok: true as const };
  }) as Promise<AdminResult>;
}

const STATUSES = ["pending_payment", "awaiting_transfer", "paid", "preparing", "shipped", "delivered", "cancelled", "refunded"] as const;

export async function setOrderStatus(id: string, status: string): Promise<AdminResult> {
  return guard(async (actor) => {
    const s = z.enum(STATUSES).parse(status) as OrderStatus;
    const current = await repo.getOrderById(z.string().uuid().parse(id));
    if (!current) return { ok: false as const, error: "Sipariş bulunamadı" };
    // Geçiş kuralları sunucuda da uygulanır (arayüz atlatılsa bile)
    if (!canTransition(current.status, s))
      return { ok: false as const, error: `"${ORDER_STATUS_LABEL[current.status]}" durumundaki sipariş "${ORDER_STATUS_LABEL[s]}" yapılamaz.` };
    const o = await repo.updateOrderStatus(current.id, s, actor);
    if (!o) return { ok: false as const, error: "Sipariş durumu değişmiş olabilir; sayfayı yenileyin." };
    revalidatePath("/yonetim/siparisler");
    // Müşteriye bildirim: teslim edildi / iptal
    if (s === "delivered" || s === "cancelled") {
      await sendOrderUpdate(s, o, await repo.getSettings()).catch((e) => console.error("[email]", e));
      return { ok: true as const, message: `Durum güncellendi${MAIL_NOTE()}` };
    }
    return { ok: true as const, message: "Durum güncellendi" };
  }) as Promise<AdminResult>;
}

export async function setOrderTracking(id: string, carrier: string, trackingNo: string): Promise<AdminResult> {
  return guard(async (actor) => {
    const c = z.string().trim().min(2).max(40).parse(carrier);
    const t = z.string().trim().regex(/^[A-Za-z0-9-]{4,40}$/, "Geçersiz takip no").parse(trackingNo);
    const current = await repo.getOrderById(z.string().uuid().parse(id));
    if (!current) return { ok: false as const, error: "Sipariş bulunamadı" };
    if (!TRACKABLE.includes(current.status))
      return { ok: false as const, error: `"${ORDER_STATUS_LABEL[current.status]}" durumundaki siparişe kargo bilgisi girilemez.` };
    const o = await repo.setTracking(z.string().uuid().parse(id), c, t, actor);
    if (!o) return { ok: false as const, error: "Sipariş bulunamadı" };
    await sendOrderUpdate("shipped", o, await repo.getSettings()).catch((e) => console.error("[email]", e));
    return { ok: true as const, message: `Kargo bilgisi kaydedildi${MAIL_NOTE()}` };
  }) as Promise<AdminResult>;
}

export async function confirmTransfer(id: string): Promise<AdminResult> {
  return guard(async (actor) => {
    const o = await repo.confirmTransfer(z.string().uuid().parse(id), actor);
    if (!o) return { ok: false as const, error: "Sipariş havale beklemiyor" };
    await sendOrderUpdate("transfer_confirmed", o, await repo.getSettings()).catch((e) => console.error("[email]", e));
    return { ok: true as const, message: `Ödeme onaylandı${MAIL_NOTE()}` };
  }) as Promise<AdminResult>;
}

export async function saveCoupon(raw: unknown): Promise<AdminResult> {
  return guard(async (actor) => {
    const parsed = couponFormSchema.safeParse(raw);
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Geçersiz form" };
    const d = parsed.data;
    if (d.type === "percent" && d.value > 100) return { ok: false as const, error: "Yüzde 100'den büyük olamaz" };
    await repo.upsertCoupon(
      {
        id: d.id || undefined,
        code: d.code,
        type: d.type,
        value: d.value,
        minSubtotal: d.minSubtotal,
        startsAt: null,
        endsAt: d.endsAt ? new Date(d.endsAt + "T23:59:59+03:00").toISOString() : null,
        usageLimit: d.usageLimit,
        active: d.active,
      },
      actor,
    );
    revalidatePath("/yonetim/kuponlar");
    return { ok: true as const, message: "Kupon kaydedildi" };
  }) as Promise<AdminResult>;
}

const settingsSchema = z.object({
  shippingFee: z.number().int().min(0).max(100000),
  freeShippingThreshold: z.number().int().min(0).max(10_000_000),
  whatsapp: z.string().regex(/^90\d{10}$/, "WhatsApp numarası 90 ile başlayan 12 hane olmalı"),
  instagram: z.string().regex(/^[a-zA-Z0-9._]{1,30}$/),
  announcement: z.string().trim().max(160),
  bankAccounts: z
    .array(
      z.object({
        bank: z.string().trim().min(2).max(60),
        holder: z.string().trim().min(2).max(80),
        iban: z
          .string()
          .trim()
          .transform((s) => s.toUpperCase().replace(/\s+/g, ""))
          .refine((s) => /^TR\d{24}$/.test(s), "IBAN TR ile başlayan 26 karakter olmalı")
          .transform((s) => s.replace(/(.{4})/g, "$1 ").trim()),
      }),
    )
    .max(4),
});

export async function saveSettings(raw: unknown): Promise<AdminResult> {
  return guard(async (actor) => {
    const parsed = settingsSchema.safeParse(raw);
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Geçersiz form" };
    await repo.updateSettings(parsed.data as Settings, actor);
    revalidatePath("/", "layout");
    return { ok: true as const, message: "Ayarlar kaydedildi" };
  }) as Promise<AdminResult>;
}

export async function saveSizeChart(raw: unknown): Promise<AdminResult> {
  return guard(async (actor) => {
    const parsed = sizeChartSchema.safeParse(raw);
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Geçersiz form" };
    const saved = await repo.upsertSizeChart({ id: parsed.data.id || undefined, name: parsed.data.name, content: parsed.data.content }, actor);
    revalidatePath("/urun/[slug]", "page");
    revalidatePath("/yonetim/beden-tablolari");
    return { ok: true as const, message: "Beden tablosu kaydedildi", id: saved.id };
  }) as Promise<AdminResult>;
}

export async function deleteSizeChart(id: string): Promise<AdminResult> {
  return guard(async (actor) => {
    await repo.deleteSizeChart(z.string().uuid().parse(id), actor);
    revalidatePath("/urun/[slug]", "page");
    revalidatePath("/yonetim/beden-tablolari");
    return { ok: true as const, message: "Beden tablosu silindi" };
  }) as Promise<AdminResult>;
}

/* ---------------- Kategoriler ---------------- */

function revalidateStore() {
  // Kategoriler üst menüde her sayfada görünür
  revalidatePath("/", "layout");
}

export async function saveCategory(raw: unknown): Promise<AdminResult> {
  return guard(async (actor) => {
    const parsed = categoryFormSchema.safeParse(raw);
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Geçersiz form" };
    const d = parsed.data;
    const all = await repo.listAllCategories();
    if (d.parentId) {
      const parent = all.find((c) => c.id === d.parentId);
      if (!parent) return { ok: false as const, error: "Üst kategori bulunamadı" };
      if (parent.parentId) return { ok: false as const, error: "Alt kategorinin altına kategori eklenemez (en fazla 2 seviye)." };
      if (d.id && parent.id === d.id) return { ok: false as const, error: "Kategori kendi altına taşınamaz." };
      if (d.id && all.some((c) => c.parentId === d.id))
        return { ok: false as const, error: "Bu kategorinin alt kategorileri var; başka bir kategorinin altına taşınamaz." };
    }
    if (all.some((c) => c.slug === d.slug && c.id !== d.id)) return { ok: false as const, error: "Bu adres başka bir kategoride kullanılıyor." };
    const saved = await repo.upsertCategory(
      { id: d.id || undefined, name: capitalizeFirst(d.name), slug: d.slug, parentId: d.parentId, description: d.description, isActive: d.isActive },
      actor,
    );
    revalidateStore();
    return { ok: true as const, message: "Kategori kaydedildi", id: saved.id };
  }) as Promise<AdminResult>;
}

export async function deleteCategory(id: string): Promise<AdminResult> {
  return guard(async (actor) => {
    await repo.deleteCategory(z.string().uuid().parse(id), actor);
    revalidateStore();
    return { ok: true as const, message: "Kategori silindi" };
  }) as Promise<AdminResult>;
}

export async function moveCategory(id: string, dir: -1 | 1): Promise<AdminResult> {
  return guard(async (actor) => {
    const all = await repo.listAllCategories();
    const me = all.find((c) => c.id === z.string().uuid().parse(id));
    if (!me) return { ok: false as const, error: "Kategori bulunamadı" };
    const siblings = all.filter((c) => c.parentId === me.parentId).sort((a, b) => a.sort - b.sort);
    const i = siblings.findIndex((c) => c.id === me.id);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return { ok: true as const };
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    await repo.reorderCategories(siblings.map((c) => c.id), actor);
    revalidateStore();
    return { ok: true as const, message: "Sıra güncellendi" };
  }) as Promise<AdminResult>;
}

/* ---------------- Ürün listesi kısayolları ---------------- */

export async function setProductStatus(id: string, status: string): Promise<AdminResult> {
  return guard(async (actor) => {
    const st = z.enum(["active", "draft", "archived"]).parse(status);
    const p = await repo.getProductById(z.string().uuid().parse(id));
    if (!p) return { ok: false as const, error: "Ürün bulunamadı" };
    if (st === "active" && (!p.media.length || !p.variants.some((v) => v.stock > 0))) {
      const missing = [!p.media.length && "en az 1 görsel", !p.variants.some((v) => v.stock > 0) && "stoğu olan en az 1 beden"].filter(Boolean).join(" ve ");
      return { ok: false as const, error: `"${p.name}" yayına alınamadı: ${missing} gerekli.` };
    }
    await repo.setProductStatus(p.id, st, actor);
    revalidateCatalog(p.slug);
    return { ok: true as const, message: `"${p.name}" ${st === "active" ? "yayına alındı" : st === "draft" ? "taslağa alındı" : "arşivlendi"}` };
  }) as Promise<AdminResult>;
}

export async function deleteProduct(id: string): Promise<AdminResult> {
  return guard(async (actor) => {
    const p = await repo.getProductById(z.string().uuid().parse(id));
    if (!p) return { ok: false as const, error: "Ürün bulunamadı" };
    const keys = await repo.deleteProduct(p.id, actor);
    for (const k of keys) await deleteProductImage(k).catch((e) => console.error("[media delete]", e));
    revalidateCatalog(p.slug);
    revalidatePath("/yonetim/urunler");
    return { ok: true as const, message: `"${p.name}" silindi` };
  }) as Promise<AdminResult>;
}

/** Ürünü taslak olarak çoğaltır (görseller kopyalanmaz: aynı dosyayı iki ürün paylaşmasın) */
export async function duplicateProduct(id: string): Promise<AdminResult> {
  return guard(async (actor) => {
    const p = await repo.getProductById(z.string().uuid().parse(id));
    if (!p) return { ok: false as const, error: "Ürün bulunamadı" };
    const suffix = randomBytes(2).toString("hex").toUpperCase();
    const saved = await repo.upsertProduct(
      {
        name: `${p.name} (kopya)`,
        slug: `${p.slug.slice(0, 70)}-kopya`,
        description: p.description,
        fabric: p.fabric,
        measurements: p.measurements,
        care: p.care,
        categoryId: p.categoryId,
        basePrice: p.basePrice,
        compareAtPrice: p.compareAtPrice,
        status: "draft",
        isNew: p.isNew,
        isBestseller: false,
        sizeChartId: p.sizeChartId,
        variants: p.variants.map((v) => ({ id: "", sku: `${v.sku.slice(0, 34)}-${suffix}`, size: v.size, color: v.color, colorHex: v.colorHex, stock: v.stock, priceOverride: v.priceOverride })),
      },
      actor,
    );
    revalidatePath("/yonetim/urunler");
    return { ok: true as const, message: `Kopya oluşturuldu (taslak). Görselleri ekleyip yayına alabilirsiniz.`, id: saved.id };
  }) as Promise<AdminResult>;
}
