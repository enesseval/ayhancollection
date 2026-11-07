// İstemci ve sunucuda kullanılabilen yardımcılar.

const tl = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 });

export function formatTRY(kurus: number): string {
  return tl.format(kurus / 100);
}

export function formatDate(iso: string, withTime = false): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/Istanbul",
  }).format(new Date(iso));
}

export const MEDIA_WIDTHS = [240, 480, 960, 1600] as const;

/** R2 kullanılıyorsa NEXT_PUBLIC_MEDIA_BASE_URL; yoksa Supabase Storage'ın public "media" bucket'ı. */
export function mediaBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const sb = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (sb) return `${sb.replace(/\/$/, "")}/storage/v1/object/public/media`;
  return "/media";
}

/** Depolama anahtarından boyut ekli WebP URL'si üretir. Vercel görsel dönüşümü kullanılmaz. */
export function mediaUrl(key: string, width: number): string {
  const w = MEDIA_WIDTHS.find((x) => x >= width) ?? MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1];
  if (key.startsWith("seed/")) return `/media/${key}-${w}.webp`;
  if (key.startsWith("mem/")) return `/api/media/${key}-${w}.webp`;
  const base = mediaBaseUrl();
  return `${base}/${key}-${w}.webp`;
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Ödeme bekleniyor",
  awaiting_transfer: "Havale bekleniyor",
  paid: "Ödendi",
  preparing: "Hazırlanıyor",
  shipped: "Kargoya verildi",
  delivered: "Teslim edildi",
  cancelled: "İptal edildi",
  refunded: "İade edildi",
};

export function slugify(input: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", İ: "i" };
  return input
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüİ]/g, (c) => map[c] ?? c)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function waLink(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export const CONTRACT_VERSION = "2026-11-04";

/** İlk harfi Türkçe kurallarıyla büyütür ("omuzu" → "Omuzu", "iç" → "İç"); geri kalanına dokunmaz */
export function capitalizeFirst(s: string): string {
  const t = s.trimStart();
  if (!t) return s;
  const first = String.fromCodePoint(t.codePointAt(0)!);
  return first.toLocaleUpperCase("tr-TR") + t.slice(first.length);
}

/** Renk → kod; aynı renkte farklı kodlar varsa ilk varyantınki (tutarlı görünüm) */
export function firstHexByColor(variants: { color: string; colorHex: string }[]): [string, string][] {
  const m = new Map<string, string>();
  for (const v of variants) if (!m.has(v.color)) m.set(v.color, v.colorHex);
  return [...m.entries()];
}
