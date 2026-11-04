"use server";
import { z } from "zod";
import { priceCart } from "@/lib/pricing";
import { rateLimit } from "@/lib/rate-limit";
import { cartLineSchema } from "@/lib/validation";

export type PricedCartView = {
  lines: {
    variantId: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    maxQty: number;
    productName: string;
    productSlug: string;
    size: string;
    color: string;
    imageKey: string | null;
  }[];
  removed: string[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode: string | null;
  couponError: string | null;
  freeShippingRemaining: number;
};

const inputSchema = z.object({
  lines: z.array(cartLineSchema).max(30),
  coupon: z.string().trim().toUpperCase().max(24).optional(),
});

/** Sepeti sunucuda yeniden fiyatlar (istemci fiyatlarına güvenilmez). */
export async function priceCartAction(raw: unknown): Promise<PricedCartView> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return { lines: [], removed: [], subtotal: 0, discount: 0, shipping: 0, total: 0, couponCode: null, couponError: "Geçersiz sepet", freeShippingRemaining: 0 };
  }
  const { lines, coupon } = parsed.data;
  let couponCode = coupon || null;
  let limited = false;
  if (couponCode) {
    const rl = await rateLimit("coupon");
    if (!rl.ok) {
      couponCode = null;
      limited = true;
    }
  }
  const t = await priceCart(lines, couponCode);
  const kept = new Set(t.lines.map((l) => l.variant.id));
  return {
    lines: t.lines.map((l) => ({
      variantId: l.variant.id,
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      maxQty: Math.min(l.variant.stock, 10),
      productName: l.product.name,
      productSlug: l.product.slug,
      size: l.variant.size,
      color: l.variant.color,
      imageKey: (l.product.media.find((m) => m.color === l.variant.color) ?? l.product.media[0])?.key ?? null,
    })),
    removed: lines.filter((l) => !kept.has(l.variantId)).map((l) => l.variantId),
    subtotal: t.subtotal,
    discount: t.discount,
    shipping: t.shipping,
    total: t.total,
    couponCode: t.coupon?.code ?? null,
    couponError: limited ? "Çok fazla deneme yaptınız, lütfen biraz bekleyin" : t.couponError,
    freeShippingRemaining: t.freeShippingRemaining,
  };
}
