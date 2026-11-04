import "server-only";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, features } from "./env";

// Upstash anahtarları varsa dağıtık rate limit; yoksa sunucu örneği başına bellek içi kayan pencere.

type Rule = { limit: number; windowSec: number };
export const RULES = {
  login: { limit: 5, windowSec: 60 },
  register: { limit: 3, windowSec: 60 },
  coupon: { limit: 10, windowSec: 60 },
  checkout: { limit: 5, windowSec: 600 },
  payment_fail: { limit: 5, windowSec: 600 },
  lookup: { limit: 10, windowSec: 600 },
  upload: { limit: 60, windowSec: 600 },
  contact: { limit: 3, windowSec: 3600 },
} satisfies Record<string, Rule>;
export type RuleName = keyof typeof RULES;

const g = globalThis as unknown as { __aacRl?: Map<string, number[]>; __aacUp?: Map<string, Ratelimit> };

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel'de x-forwarded-for'un ilk değeri istemci IP'sidir
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "0.0.0.0").trim();
}

export async function rateLimit(rule: RuleName, key?: string): Promise<{ ok: boolean; retryAfter: number }> {
  const r = RULES[rule];
  const id = `${rule}:${key ?? (await clientIp())}`;

  if (features.upstash) {
    g.__aacUp ??= new Map();
    let rl = g.__aacUp.get(rule);
    if (!rl) {
      rl = new Ratelimit({
        redis: new Redis({ url: env.upstashUrl, token: env.upstashToken }),
        limiter: Ratelimit.slidingWindow(r.limit, `${r.windowSec} s`),
        prefix: "aac",
      });
      g.__aacUp.set(rule, rl);
    }
    const res = await rl.limit(id);
    return { ok: res.success, retryAfter: Math.max(0, Math.ceil((res.reset - Date.now()) / 1000)) };
  }

  g.__aacRl ??= new Map();
  const now = Date.now();
  const arr = (g.__aacRl.get(id) ?? []).filter((t) => now - t < r.windowSec * 1000);
  if (arr.length >= r.limit) {
    g.__aacRl.set(id, arr);
    return { ok: false, retryAfter: Math.ceil((r.windowSec * 1000 - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  g.__aacRl.set(id, arr);
  if (g.__aacRl.size > 5000) g.__aacRl.clear();
  return { ok: true, retryAfter: 0 };
}

export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  if (!features.turnstile) return true; // anahtar yoksa devre dışı
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret: env.turnstileSecret, response: token, remoteip: await clientIp() }),
    cache: "no-store",
  });
  const data = (await res.json()) as { success?: boolean };
  return !!data.success;
}
