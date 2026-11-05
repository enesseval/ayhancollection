import "server-only";
import { features } from "./env";
import { db } from "./data/supabase";

// Hatalı giriş koruması (iki katman):
//  1) IP başına: 15 dk içinde 20 hatalı deneme → IP 15 dk engellenir (çok hesaba yayılan saldırı)
//  2) E-posta başına: 15 dk içinde 5 hatalı deneme → hesap 15 dk GEÇİCİ kilitlenir (şifre deneme)
// Kalıcı kilit kullanılmaz: aksi halde kötü niyetli biri yönetici hesabını sürekli kilitleyebilir.
// Sayaçlar Supabase'de tutulur (sunucusuz örnekler arasında ortak). Supabase yoksa bellek içi.

export const LOGIN_POLICY = {
  email: { max: 5, windowSec: 900, lockSec: 900 },
  ip: { max: 20, windowSec: 900, lockSec: 900 },
};

type Row = { fails: number; first: number; lockedUntil: number };
const g = globalThis as unknown as { __aacLt?: Map<string, Row> };
const mem = () => (g.__aacLt ??= new Map());

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | undefined> {
  if (!features.supabase) return undefined;
  const { data, error } = await db().rpc(fn, args);
  if (error) {
    // Migration henüz uygulanmadıysa bellek içi sayaca düş
    console.error(`[login-throttle] ${fn}:`, error.message);
    return undefined;
  }
  return data as T;
}

export async function lockedFor(key: string): Promise<number> {
  const r = await rpc<number>("auth_throttle_check", { p_key: key });
  if (r !== undefined) return r;
  const row = mem().get(key);
  return row && row.lockedUntil > Date.now() ? Math.ceil((row.lockedUntil - Date.now()) / 1000) : 0;
}

export async function registerFail(key: string, p: { max: number; windowSec: number; lockSec: number }): Promise<number> {
  const r = await rpc<number>("auth_throttle_fail", { p_key: key, p_max: p.max, p_window_sec: p.windowSec, p_lock_sec: p.lockSec });
  if (r !== undefined) return r;
  const now = Date.now();
  let row = mem().get(key);
  if (!row || now - row.first > p.windowSec * 1000) row = { fails: 0, first: now, lockedUntil: row?.lockedUntil ?? 0 };
  row.fails++;
  let locked = 0;
  if (row.fails >= p.max) {
    row = { fails: 0, first: now, lockedUntil: now + p.lockSec * 1000 };
    locked = p.lockSec;
  }
  mem().set(key, row);
  if (mem().size > 5000) mem().clear();
  return locked;
}

export async function clearFails(key: string): Promise<void> {
  const r = await rpc<null>("auth_throttle_clear", { p_key: key });
  if (r === undefined) mem().delete(key);
}

export function minutes(sec: number) {
  return Math.max(1, Math.ceil(sec / 60));
}
