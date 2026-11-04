import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { sessionSecretBytes } from "./env";
import { repo } from "./data";
import { demoAdopt } from "./data/demo";
import { getSessionUser } from "./auth";
import type { Order } from "./types";

// Sipariş erişim kontrolü (IDOR önleme). Bir sipariş yalnızca şu durumlarda gösterilir:
//  1) URL'deki imzalı erişim anahtarı (t) geçerliyse,
//  2) oturumdaki kullanıcı siparişin sahibiyse,
//  3) yönetici ise.

export function orderToken(orderId: string): string {
  return createHmac("sha256", sessionSecretBytes()).update("order:" + orderId).digest("base64url").slice(0, 22);
}

export function verifyOrderToken(orderId: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const a = Buffer.from(orderToken(orderId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

const LAST_ORDER_COOKIE = "aac_last_order";

/** Demo modda farklı sunucu örneklerinde siparişin kaybolmaması için son siparişin imzalı kopyası. */
export async function rememberOrder(order: Order) {
  if (repo.kind !== "demo") return;
  const jwt = await new SignJWT({ o: order })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2d")
    .setAudience("aac-order")
    .sign(sessionSecretBytes());
  (await cookies()).set(LAST_ORDER_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 2 * 86400,
  });
}

async function fromCookie(id: string): Promise<Order | null> {
  const raw = (await cookies()).get(LAST_ORDER_COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, sessionSecretBytes(), { audience: "aac-order", algorithms: ["HS256"] });
    const o = payload.o as Order;
    return o.id === id ? o : null;
  } catch {
    return null;
  }
}

/** Siparişi id ile bul; demo modda yoksa çerezdeki kopyadan geri yükle. */
export async function loadOrder(id: string): Promise<Order | null> {
  const o = await repo.getOrderById(id);
  if (o || repo.kind !== "demo") return o;
  const c = await fromCookie(id);
  if (c) demoAdopt(c);
  return c;
}

export async function loadOrderByNo(no: string): Promise<Order | null> {
  const o = await repo.getOrderByNo(no);
  if (o || repo.kind !== "demo") return o;
  const raw = (await cookies()).get(LAST_ORDER_COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, sessionSecretBytes(), { audience: "aac-order", algorithms: ["HS256"] });
    const c = payload.o as Order;
    if (c.orderNo !== no) return null;
    demoAdopt(c);
    return c;
  } catch {
    return null;
  }
}

export async function canViewOrder(order: Order, token?: string | null): Promise<boolean> {
  if (verifyOrderToken(order.id, token)) return true;
  const user = await getSessionUser();
  if (!user) return false;
  if (user.role === "admin") return true;
  return order.userId === user.id;
}
