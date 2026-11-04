"use server";
import { redirect } from "next/navigation";
import { login, logout, register } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema, orderLookupSchema, registerSchema } from "@/lib/validation";
import { loadOrderByNo, orderToken } from "@/lib/order-access";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | null;

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}

function safeNext(next: FormDataEntryValue | null, fallback: string) {
  const n = String(next ?? "");
  // Açık yönlendirme (open redirect) önleme: yalnız site içi göreli yollar
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : fallback;
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = { email: String(fd.get("email") ?? "").slice(0, 120) };
  const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values };
  const rl = await rateLimit("login");
  if (!rl.ok) return { error: `Çok fazla deneme. ${rl.retryAfter} sn sonra tekrar deneyin.`, values };
  const res = await login(parsed.data.email, parsed.data.password);
  if (!res.ok) return { error: res.error, values };
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
