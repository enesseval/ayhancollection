import "server-only";
import { revalidatePath } from "next/cache";
import { repo } from "../data";
import { sendOrderReceived } from "../email";
import type { Order } from "../types";
import { isValidPaymentForOrder, retrieveCheckoutForm } from "./iyzico";

export type FinalizeResult = { ok: true; order: Order } | { ok: false; order: Order | null; reason: string };

/**
 * iyzico ödeme sonucunu SUNUCUDAN SUNUCUYA sorgulayıp siparişi kesinleştirir.
 * Callback ve webhook aynı fonksiyonu kullanır; işlem idempotenttir.
 */
export async function finalizeIyzicoToken(token: string): Promise<FinalizeResult> {
  const r = await retrieveCheckoutForm(token);
  const orderId = r.conversationId;
  if (!orderId) return { ok: false, order: null, reason: r.errorMessage || "Ödeme bulunamadı" };
  const order = await repo.getOrderById(orderId);
  if (!order) return { ok: false, order: null, reason: "Sipariş bulunamadı" };

  if (order.status === "paid" || order.status === "preparing" || order.status === "shipped" || order.status === "delivered") {
    return { ok: true, order };
  }

  const problem = isValidPaymentForOrder(r, order);
  if (problem) {
    // 3DS henüz tamamlanmadıysa siparişi iptal etme; rezerv süresi dolunca otomatik iptal edilir
    if (r.paymentStatus === "FAILURE" || r.status === "failure") await repo.failOrder(order.id, `Ödeme başarısız: ${problem}`);
    return { ok: false, order, reason: problem };
  }

  const paid = await repo.markOrderPaid(order.id, {
    provider: "iyzico",
    paymentId: r.paymentId ?? null,
    status: "success",
    installment: r.installment ?? 1,
    cardLast4: r.lastFourDigits ?? null,
    paidAt: new Date().toISOString(),
  });
  if (!paid) return { ok: false, order, reason: "Sipariş ödeme için uygun değil" };
  await afterPaid(paid);
  return { ok: true, order: paid };
}

export async function afterPaid(order: Order) {
  const settings = await repo.getSettings();
  await sendOrderReceived(order, settings).catch((e) => console.error("[email]", e));
  for (const i of order.items) revalidatePath(`/urun/${i.productSlug}`);
}
