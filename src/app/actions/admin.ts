"use server";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { requireAdmin, AdminError } from "@/lib/admin-guard";
import { couponFormSchema, productFormSchema } from "@/lib/validation";
import { deleteProductImage } from "@/lib/media/storage";
import { sendOrderShipped } from "@/lib/email";
import type { OrderStatus, Settings } from "@/lib/types";
import { z } from "zod";

export type AdminResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

async function guard<T>(fn: (actorId: string) => Promise<T>): Promise<T | AdminResult> {
  try {
    const admin = await requireAdmin();
    return await fn(admin.id);
  } catch (e) {
    if (e instanceof AdminError) return { ok: false, error: e.message };
    console.error("[admin]", e);
    return { ok: false, error: e instanceof Error ? e.message : "İşlem başarısız" };
  }
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
    const saved = await repo.upsertProduct(
      {
        ...d,
        id: d.id || undefined,
        variants: d.variants.map((v) => ({ ...v, id: v.id || "", sku: v.sku.toUpperCase() })),
      },
      actor,
    );
    revalidateCatalog(saved.slug);
    return { ok: true as const, message: "Ürün kaydedildi", id: saved.id };
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
    const o = await repo.updateOrderStatus(z.string().uuid().parse(id), s, actor);
    if (!o) return { ok: false as const, error: "Sipariş bulunamadı" };
    revalidatePath("/yonetim/siparisler");
    return { ok: true as const, message: "Durum güncellendi" };
  }) as Promise<AdminResult>;
}

export async function setOrderTracking(id: string, carrier: string, trackingNo: string): Promise<AdminResult> {
  return guard(async (actor) => {
    const c = z.string().trim().min(2).max(40).parse(carrier);
    const t = z.string().trim().regex(/^[A-Za-z0-9-]{4,40}$/, "Geçersiz takip no").parse(trackingNo);
    const o = await repo.setTracking(z.string().uuid().parse(id), c, t, actor);
    if (!o) return { ok: false as const, error: "Sipariş bulunamadı" };
    await sendOrderShipped(o).catch(() => {});
    return { ok: true as const, message: "Kargo bilgisi kaydedildi, müşteriye bildirim gönderildi" };
  }) as Promise<AdminResult>;
}

export async function confirmTransfer(id: string): Promise<AdminResult> {
  return guard(async (actor) => {
    const o = await repo.confirmTransfer(z.string().uuid().parse(id), actor);
    if (!o) return { ok: false as const, error: "Sipariş havale beklemiyor" };
    return { ok: true as const, message: "Ödeme onaylandı" };
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
