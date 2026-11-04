import "server-only";
import { repo } from "./data";
import type { CartLineInput, Coupon, PricedLine, Totals } from "./types";

// Sepet tutarının TEK kaynağı. İstemciden gelen hiçbir fiyat kullanılmaz;
// varyant fiyatları her seferinde veri katmanından okunur.

export const MAX_QTY_PER_LINE = 10;

export function couponDiscount(c: Coupon, subtotal: number, now = new Date()): { amount: number; error: string | null } {
  if (!c.active) return { amount: 0, error: "Bu kupon artık geçerli değil" };
  if (c.startsAt && new Date(c.startsAt) > now) return { amount: 0, error: "Bu kupon henüz başlamadı" };
  if (c.endsAt && new Date(c.endsAt) < now) return { amount: 0, error: "Bu kuponun süresi doldu" };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return { amount: 0, error: "Kupon kullanım limiti doldu" };
  if (subtotal < c.minSubtotal) {
    return { amount: 0, error: `Bu kupon ${Math.round(c.minSubtotal / 100)} TL ve üzeri sepetlerde geçerli` };
  }
  const raw = c.type === "percent" ? Math.floor((subtotal * c.value) / 100) : c.value;
  return { amount: Math.min(raw, subtotal), error: null };
}

export async function priceCart(input: CartLineInput[], couponCode?: string | null): Promise<Totals> {
  // Aynı varyant birden fazla gelirse birleştir, adetleri sınırla
  const merged = new Map<string, number>();
  for (const l of input.slice(0, 30)) {
    if (!l.variantId || !Number.isInteger(l.qty) || l.qty < 1) continue;
    merged.set(l.variantId, Math.min(MAX_QTY_PER_LINE, (merged.get(l.variantId) ?? 0) + l.qty));
  }
  const found = await repo.getVariantsWithProducts([...merged.keys()]);
  const lines: PricedLine[] = [];
  for (const { variant, product } of found) {
    if (product.status !== "active") continue;
    const qty = Math.min(merged.get(variant.id) ?? 0, variant.stock);
    if (qty < 1) continue;
    const unitPrice = variant.priceOverride ?? product.basePrice;
    lines.push({ variant, product, qty, unitPrice, lineTotal: unitPrice * qty });
  }
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const settings = await repo.getSettings();

  let coupon: Coupon | null = null;
  let couponError: string | null = null;
  let discount = 0;
  if (couponCode && couponCode.trim()) {
    const c = await repo.findCoupon(couponCode);
    if (!c) couponError = "Kupon kodu bulunamadı";
    else {
      const r = couponDiscount(c, subtotal);
      if (r.error) couponError = r.error;
      else {
        coupon = c;
        discount = r.amount;
      }
    }
  }
  const afterDiscount = subtotal - discount;
  const shipping = lines.length === 0 || afterDiscount >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
  return {
    lines,
    subtotal,
    discount,
    shipping,
    total: afterDiscount + shipping,
    coupon,
    couponError,
    freeShippingRemaining: Math.max(0, settings.freeShippingThreshold - afterDiscount),
  };
}
