// Türkçe renk adı → renk kodu. Yönetimde renk adı yazıldığında kod otomatik gelir;
// mağazada da kodu hiç seçilmemiş (varsayılan lacivertte kalmış) renkler için kullanılır.

export const DEFAULT_COLOR_HEX = "#1F2A44";

const COLORS: Record<string, string> = {
  siyah: "#141414",
  beyaz: "#F4F3EF",
  ekru: "#EDE6D6",
  krem: "#E8E1D6",
  bej: "#C9B79C",
  vizon: "#8A7D72",
  taş: "#B9AE9C",
  tas: "#B9AE9C",
  camel: "#B5885A",
  taba: "#9C5B2E",
  kahve: "#6B4A33",
  "kahverengi": "#6B4A33",
  "acı kahve": "#3F2A1E",
  hardal: "#C9A227",
  sarı: "#E8C93D",
  turuncu: "#E07B2A",
  kiremit: "#B4532F",
  somon: "#F2A48A",
  pudra: "#E7C3C4",
  pembe: "#E8A5B8",
  "gül kurusu": "#C08081",
  fuşya: "#C2185B",
  kırmızı: "#C62828",
  bordo: "#6E2430",
  mürdüm: "#5A2A3F",
  mor: "#6A3D8F",
  lila: "#B9A3D0",
  lavanta: "#B7A9D6",
  lacivert: "#1F2A44",
  indigo: "#3B4A8F",
  "saks mavi": "#2F5DA8",
  saks: "#2F5DA8",
  mavi: "#3E6C9E",
  "bebe mavi": "#A9C8E8",
  "buz mavi": "#CFE3EF",
  petrol: "#1F5560",
  turkuaz: "#2BB3B1",
  mint: "#A9CDB7",
  "su yeşili": "#9ED8C6",
  yeşil: "#2E7D32",
  zümrüt: "#1F6B5C",
  "çağla": "#B5C46B",
  "çağla yeşili": "#B5C46B",
  haki: "#59563A",
  "haki yeşil": "#4B5320",
  "nefti": "#2F4A3A",
  "nefti yeşil": "#2F4A3A",
  "zeytin yeşili": "#6B6B2E",
  gri: "#8A8D91",
  "açık gri": "#C4C6C8",
  "koyu gri": "#55585C",
  füme: "#4B4F54",
  antrasit: "#2E3135",
  gümüş: "#BFC1C2",
  altın: "#C9A44C",
};

function norm(name: string) {
  return name.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

/** Bilinen bir renk adıysa kodunu döndürür ("Kırmızı", "kırmızı ", "HAKİ YEŞİL" → kod) */
export function colorHexFor(name: string): string | undefined {
  const n = norm(name);
  if (COLORS[n]) return COLORS[n];
  // "Koyu Kırmızı", "Kırmızı Desenli" gibi: bilinen renk adını içeren en uzun eşleşme
  const hit = Object.keys(COLORS)
    .filter((k) => (k.includes(" ") ? n.includes(k) : n.split(/[\s\-/]+/).includes(k)))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? COLORS[hit] : undefined;
}

/**
 * Mağazada gösterilecek renk kodu: yönetici bilinçli bir kod seçtiyse o;
 * kod varsayılan lacivertte kalmış ama renk adı başka bir rengi anlatıyorsa addan bulunan kod.
 */
export function displayHex(name: string, hex: string): string {
  if (hex.toUpperCase() !== DEFAULT_COLOR_HEX) return hex;
  const guess = colorHexFor(name);
  return guess ?? hex;
}
