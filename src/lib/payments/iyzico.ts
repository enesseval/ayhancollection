import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../env";
import type { Order } from "../types";

// iyzico REST istemcisi (IYZWSv2 imzası). Resmî Node SDK'sı dosya sisteminden dinamik require
// yaptığı için serverless paketlemede sorun çıkarabiliyor; aynı imza algoritması burada doğrudan uygulanır.
// Ödeme formu iyzico'nun barındırdığı sayfada açılır (paymentPageUrl) → kart verisi sitemize hiç gelmez.

const money = (kurus: number) => {
  const s = (kurus / 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, ".0");
  return s;
};

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const rnd = Date.now().toString() + randomBytes(6).toString("hex");
  const json = JSON.stringify(body);
  const signature = createHmac("sha256", env.iyzicoSecretKey).update(rnd + path + json).digest("hex");
  const auth = Buffer.from(`apiKey:${env.iyzicoApiKey}&randomKey:${rnd}&signature:${signature}`).toString("base64");
  const res = await fetch(env.iyzicoBaseUrl.replace(/\/$/, "") + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `IYZWSv2 ${auth}`,
      "x-iyzi-rnd": rnd,
    },
    body: json,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  return (await res.json()) as T;
}

type InitResult = {
  status: "success" | "failure";
  errorMessage?: string;
  token?: string;
  paymentPageUrl?: string;
  tokenExpireTime?: number;
};

/** Sepet kalemlerini iyzico kurallarına göre hazırla: kalem toplamı == price. İndirim kalemlere dağıtılır, kargo ayrı kalem. */
export function buildBasket(order: Order) {
  const items = order.items.map((i) => ({
    id: i.sku,
    name: `${i.productName} (${i.color}/${i.size})`.slice(0, 100),
    category1: "Giyim",
    itemType: "PHYSICAL",
    gross: i.unitPrice * i.qty,
  }));
  let remainingDiscount = order.discount;
  const totalGross = items.reduce((a, b) => a + b.gross, 0);
  const priced = items.map((it, idx) => {
    const share = idx === items.length - 1 ? remainingDiscount : Math.floor((order.discount * it.gross) / totalGross);
    remainingDiscount -= share;
    return { ...it, net: it.gross - share };
  });
  const basket = priced
    .filter((p) => p.net > 0)
    .map(({ id, name, category1, itemType, net }) => ({ id, name, category1, itemType, price: money(net) }));
  if (order.shipping > 0) {
    basket.push({ id: "KARGO", name: "Kargo", category1: "Kargo", itemType: "VIRTUAL", price: money(order.shipping) });
  }
  const sum = priced.reduce((a, p) => a + Math.max(0, p.net), 0) + order.shipping;
  return { basket, sum };
}

export async function initCheckoutForm(order: Order, ip: string): Promise<InitResult> {
  const { basket, sum } = buildBasket(order);
  if (sum !== order.total) throw new Error("Sepet toplamı tutarsız");
  const [name, ...rest] = order.shippingAddress.fullName.trim().split(/\s+/);
  const surname = rest.join(" ") || name;
  const address = {
    contactName: order.shippingAddress.fullName,
    city: order.shippingAddress.city,
    country: "Turkey",
    address: `${order.shippingAddress.line} ${order.shippingAddress.district}/${order.shippingAddress.city}`,
    zipCode: order.shippingAddress.postalCode || undefined,
  };
  const body = {
    locale: "tr",
    conversationId: order.id,
    price: money(order.total),
    paidPrice: money(order.total),
    currency: "TRY",
    basketId: order.orderNo,
    paymentGroup: "PRODUCT",
    callbackUrl: `${env.siteUrl}/api/payments/iyzico/callback`,
    enabledInstallments: [1, 2, 3, 6],
    buyer: {
      id: order.userId ?? "guest-" + order.id.slice(0, 8),
      name,
      surname,
      gsmNumber: order.phone.startsWith("+") ? order.phone : "+90" + order.phone.replace(/^0/, ""),
      email: order.email,
      // T.C. kimlik numarası toplanmıyor (veri minimizasyonu); iyzico bu alanı zorunlu tutuyor.
      identityNumber: "11111111111",
      registrationAddress: address.address,
      ip,
      city: address.city,
      country: "Turkey",
    },
    shippingAddress: address,
    billingAddress: address,
    basketItems: basket,
  };
  return call<InitResult>("/payment/iyzipos/checkoutform/initialize/auth/ecom", body);
}

export type RetrieveResult = {
  status: "success" | "failure";
  errorMessage?: string;
  paymentStatus?: "SUCCESS" | "FAILURE" | "INIT_THREEDS" | "CALLBACK_THREEDS";
  paymentId?: string;
  conversationId?: string;
  basketId?: string;
  paidPrice?: number;
  price?: number;
  currency?: string;
  installment?: number;
  lastFourDigits?: string;
  fraudStatus?: number;
  token?: string;
};

export async function retrieveCheckoutForm(token: string, conversationId?: string): Promise<RetrieveResult> {
  return call<RetrieveResult>("/payment/iyzipos/checkoutform/auth/ecom/detail", {
    locale: "tr",
    ...(conversationId ? { conversationId } : {}),
    token,
  });
}

/** Webhook imza doğrulaması (X-IYZ-SIGNATURE-V3, HPP formatı). */
export function verifyWebhookSignature(
  header: string | null,
  p: { iyziEventType?: string; iyziPaymentId?: string | number; token?: string; paymentConversationId?: string; status?: string; paymentId?: string | number },
): boolean {
  if (!header) return false;
  const key = env.iyzicoSecretKey;
  const candidates = [
    // HPP (Checkout Form) formatı
    key + (p.iyziEventType ?? "") + String(p.iyziPaymentId ?? "") + (p.token ?? "") + (p.paymentConversationId ?? "") + (p.status ?? ""),
    // Direkt format
    key + (p.iyziEventType ?? "") + String(p.paymentId ?? "") + (p.paymentConversationId ?? "") + (p.status ?? ""),
  ];
  return candidates.some((c) => {
    const expected = createHmac("sha256", key).update(c).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(header.trim().toLowerCase());
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/** Ödeme sonucunu siparişle eşleştir: tutar, para birimi, sepet no, fraud durumu. */
export function isValidPaymentForOrder(r: RetrieveResult, order: Order): string | null {
  if (r.status !== "success") return r.errorMessage || "Ödeme sorgulanamadı";
  if (r.paymentStatus !== "SUCCESS") return "Ödeme onaylanmadı";
  if (r.basketId && r.basketId !== order.orderNo) return "Sipariş eşleşmedi";
  if (r.conversationId && r.conversationId !== order.id) return "Sipariş eşleşmedi";
  if (Math.round(Number(r.paidPrice) * 100) < order.total) return "Ödenen tutar sipariş tutarıyla eşleşmiyor";
  if (r.currency && r.currency !== "TRY") return "Para birimi hatalı";
  if (r.fraudStatus !== undefined && r.fraudStatus !== 1) return "Ödeme güvenlik incelemesinde";
  return null;
}
