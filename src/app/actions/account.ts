"use server";
import { safeNext } from "@/lib/safe-next";
import { redirect } from "next/navigation";
import { login, logout, register } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { LOGIN_POLICY, clearFails, lockedFor, minutes, registerFail } from "@/lib/login-throttle";
import { loginSchema, orderLookupSchema, registerSchema } from "@/lib/validation";
import { loadOrderByNo, orderToken } from "@/lib/order-access";

export type FormState = { error?: string; notice?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | null;

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = { email: String(fd.get("email") ?? "").slice(0, 120) };
  const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values };
  const rl = await rateLimit("login");
  if (!rl.ok) return { error: `Çok fazla deneme. ${rl.retryAfter} sn sonra tekrar deneyin.`, values };

  const ip = await clientIp();
  const email = parsed.data.email.toLowerCase();
  const emailIpKey = `email-ip:${email}|${ip}`;
  const emailKey = `email:${email}`;
  const ipKey = `ip:${ip}`;
  const locked = Math.max(await lockedFor(emailIpKey), await lockedFor(emailKey), await lockedFor(ipKey));
  if (locked > 0) {
    // Kilitliyken şifre hiç denenmez (doğru şifre bile kabul edilmez)
    return { error: `Çok fazla hatalı deneme yapıldı. Güvenliğiniz için giriş ${minutes(locked)} dakika kapatıldı.`, values };
  }

  const res = await login(parsed.data.email, parsed.data.password);
  if (!res.ok && res.systemError) return { error: res.error, values };
  if (!res.ok) {
    const locks = await Promise.all([
      registerFail(emailIpKey, LOGIN_POLICY.emailIp),
      registerFail(emailKey, LOGIN_POLICY.email),
      registerFail(ipKey, LOGIN_POLICY.ip),
    ]);
    const lock = Math.max(...locks);
    if (lock > 0) return { error: `Çok fazla hatalı deneme yapıldı. Güvenliğiniz için giriş ${minutes(lock)} dakika kapatıldı.`, values };
    return { error: res.error, values };
  }
  await clearFails(emailIpKey);
  await clearFails(emailKey);
  redirect(safeNext(fd.get("next"), res.user.role === "admin" ? "/yonetim" : "/hesabim"));
}

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = { fullName: String(fd.get("fullName") ?? "").slice(0, 80), email: String(fd.get("email") ?? "").slice(0, 120) };
  const parsed = registerSchema.safeParse({
    fullName: fd.get("fullName"),
    email: fd.get("email"),
    password: fd.get("password"),
    acceptKvkk: fd.get("acceptKvkk") === "on",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values };
  const rl = await rateLimit("register");
  if (!rl.ok) return { error: "Çok fazla deneme. Lütfen biraz sonra tekrar deneyin.", values };
  const res = await register(parsed.data.fullName, parsed.data.email, parsed.data.password);
  if (!res.ok && res.pendingConfirmation) return { notice: res.error, values };
  if (!res.ok) return { error: res.error, values };
  redirect(safeNext(fd.get("next"), "/hesabim"));
}

export async function logoutAction() {
  await logout();
  redirect("/");
}

export async function lookupOrderAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = { orderNo: String(fd.get("orderNo") ?? "").slice(0, 20), email: String(fd.get("email") ?? "").slice(0, 120) };
  const parsed = orderLookupSchema.safeParse({ orderNo: fd.get("orderNo"), email: fd.get("email") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values };
  const rl = await rateLimit("lookup");
  if (!rl.ok) return { error: "Çok fazla deneme. 10 dakika sonra tekrar deneyin.", values };
  const order = await loadOrderByNo(parsed.data.orderNo);
  // Aynı hata mesajı: sipariş numarası tahmini ile e-posta tespiti yapılamasın
  if (!order || order.email.toLowerCase() !== parsed.data.email) {
    return { error: "Bu bilgilere ait sipariş bulunamadı.", values };
  }
  redirect(`/odeme/sonuc?no=${order.orderNo}&t=${orderToken(order.id)}`);
}
