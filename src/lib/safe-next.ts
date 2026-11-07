// Girişten sonra yönlendirilecek adresi güvenli hale getirir (açık yönlendirme / open redirect önleme).
// Yalnız aynı sitedeki göreli yollar kabul edilir. Kontrol karakterleri ve ters eğik çizgi reddedilir:
// tarayıcılar "/\t/evil.com" gibi değerlerdeki sekme/satır sonunu silip "//evil.com" (başka site) yapar.
export function safeNext(next: unknown, fallback: string): string {
  const n = typeof next === "string" ? next : String(next ?? "");
  if (!n.startsWith("/") || n.length > 500) return fallback;
  if (/[\u0000-\u001F\u007F\\]/.test(n)) return fallback;
  if (/^\/[\/]/.test(n) || /%2f|%5c|%09|%0a|%0d/i.test(n.slice(0, 4))) return fallback;
  try {
    const base = "http://site.invalid";
    const u = new URL(n, base);
    if (u.origin !== base) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
