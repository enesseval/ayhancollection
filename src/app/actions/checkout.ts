"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { repo, StockError } from "@/lib/data";
import { features } from "@/lib/env";
import { getSessionUser } from "@/lib/auth";
import { priceCart } from "@/lib/pricing";
import { clientIp, rateLimit, verifyTurnstile } from "@/lib/rate-limit";
import { checkoutSchema } from "@/lib/validation";
import { CONTRACT_VERSION } from "@/lib/format";
import { initCheckoutForm } from "@/lib/payments/iyzico";
import { afterPaid } from "@/lib/payments/finalize";
import { sendOrderReceived } from "@/lib/email";
import { loadOrder, orderToken, rememberOrder, verifyOrderToken } from "@/lib/order-access";

export type CheckoutState =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; refreshCart?: boolean };

const RESERVATION_MIN = { card: 15, transfer: 24 * 60 } as const;

export async function placeOrder(raw: unknown): Promise<CheckoutState> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".");
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: "Lütfen işaretli alanları kontrol edin.", fieldErrors };
  }
  const input = parsed.data;

  const rl = await rateLimit("checkout");
  if (!rl.ok) return { ok: false, error: `Çok fazla deneme yapıldı. ${Math.ceil(rl.retryAfter / 60)} dakika sonra tekrar deneyin.` };
  if (!(await verifyTurnstile(input.turnstileToken))) return { ok: false, error: "Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin." };

  // Fiyat ve stok SUNUCUDA yeniden hesaplanır
  const totals = await priceCart(input.lines, input.couponCode || null);
  if (input.couponCode && totals.couponError) {
    return { ok: false, error: totals.couponError, fieldErrors: { couponCode: totals.couponError } };
  }
  const requested = new Map(input.lines.map((l) => [l.variantId, l.qty]));
  const mismatch =
    totals.lines.length !== requested.size || totals.lines.some((l) => l.qty !== requested.get(l.variant.id));
  if (totals.lines.length === 0 || mismatch) {
    return { ok: false, error: "Sepetinizdeki bazı ürünlerin stoğu değişti. Sepetiniz güncellendi, lütfen kontrol edin.", refreshCart: true };
  }

  const user = await getSessionUser();
  const ip = await clientIp();
  let order;
  try {
    order = await repo.createOrder({
      userId: user?.role === "customer" ? user.id : null,
      email: input.email,
      phone: input.address.phone,
      paymentMethod: input.paymentMethod,
      shippingAddress: {
        fullName: input.address.fullName,
        phone: input.address.phone,
        city: input.address.city,
        district: input.address.district,
        line: input.address.line,
        postalCode: input.address.postalCode || undefined,
      },
      note: input.note || null,
      items: totals.lines.map((l) => ({
        variantId: l.variant.id,
        productId: l.product.id,
        productName: l.product.name,
        productSlug: l.product.slug,
        sku: l.variant.sku,
        size: l.variant.size,
        color: l.variant.color,
        unitPrice: l.unitPrice,
        qty: l.qty,
        imageKey: (l.product.media.find((m) => m.color === l.variant.color) ?? l.product.media[0])?.key ?? null,
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      shipping: totals.shipping,
      total: totals.total,
      couponCode: totals.coupon?.code ?? null,
      consents: {
        contractVersion: CONTRACT_VERSION,
        acceptedAt: new Date().toISOString(),
        ip,
        marketing: !!input.marketing,
      },
      utm: input.utm && Object.keys(input.utm).length ? input.utm : null,
      reservationMinutes: RESERVATION_MIN[input.paymentMethod],
    });
  } catch (e) {
    if (e instanceof StockError) {
      return { ok: false, error: "Ürünlerden biri az önce tükendi. Sepetiniz güncellendi.", refreshCart: true };
    }
    if (e instanceof Error && (e.message === "PRICE_CHANGED" || e.message === "COUPON_INVALID")) {
      return { ok: false, error: "Fiyat veya kupon bilgisi değişti. Lütfen sepetinizi kontrol edin.", refreshCart: true };
    }
    console.error("[checkout] createOrder", e);
    return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar deneyin." };
  }

  await rememberOrder(order);
  for (const l of totals.lines) revalidatePath(`/urun/${l.product.slug}`);
  const t = orderToken(order.id);

  if (input.paymentMethod === "transfer") {
    await sendOrderReceived(order, await repo.getSettings()).catch(() => {});
    return { ok: true, redirectTo: `/odeme/sonuc?no=${order.orderNo}&t=${t}` };
  }

  if (features.iyzico) {
    try {
      const init = await initCheckoutForm(order, ip);
      if (init.status !== "success" || !init.paymentPageUrl || !init.token) {
        await repo.failOrder(order.id, "Ödeme başlatılamadı: " + (init.errorMessage ?? ""));
        return { ok: false, error: "Ödeme sayfası açılamadı: " + (init.errorMessage ?? "bilinmeyen hata") };
      }
      await repo.setOrderPaymentInit(order.id, init.token);
      return { ok: true, redirectTo: init.paymentPageUrl };
    } catch (e) {
      console.error("[checkout] iyzico init", e);
      await repo.failOrder(order.id, "Ödeme servisine ulaşılamadı");
      return { ok: false, error: "Ödeme servisine şu an ulaşılamıyor. Lütfen biraz sonra tekrar deneyin." };
    }
  }

  // iyzico anahtarları yoksa: demo 3D Secure ekranı
  return { ok: true, redirectTo: `/odeme/demo?o=${order.id}&t=${t}` };
}

/** Demo ödeme ekranının sonucu. Yalnızca iyzico anahtarları YOKKEN çalışır. */
export async function demoPay(formData: FormData) {
  if (features.iyzico) throw new Error("Demo ödeme devre dışı");
  const orderId = String(formData.get("o") ?? "");
  const t = String(formData.get("t") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  if (!verifyOrderToken(orderId, t)) redirect("/");
  const order = await loadOrder(orderId);
  if (!order) redirect("/odeme?hata=siparis");

  if (outcome === "success") {
    const paid = await repo.markOrderPaid(order.id, {
      provider: "demo",
      paymentId: "demo-" + order.orderNo,
      status: "success",
      installment: Number(formData.get("installment") ?? 1) || 1,
      cardLast4: "0008",
      paidAt: new Date().toISOString(),
    });
    if (paid) {
      await rememberOrder(paid);
      await afterPaid(paid);
    }
    redirect(`/odeme/sonuc?no=${order.orderNo}&t=${t}`);
  }
  const rl = await rateLimit("payment_fail");
  await repo.failOrder(order.id, "Demo: kart reddedildi");
  const after = await repo.getOrderById(order.id);
  if (after) await rememberOrder(after);
  redirect(`/odeme?hata=${rl.ok ? "odeme" : "limit"}`);
}
