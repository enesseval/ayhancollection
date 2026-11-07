import { randomInt } from "node:crypto";
import type { Product, ProductQuery } from "../types";
import { isNewProduct, minPrice } from "../format";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 0/O, 1/I yok

/** Tahmin edilemez sipariş numarası: AA-2611-7KQ4X */
export function newOrderNo(now = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  let rand = "";
  for (let i = 0; i < 6; i++) rand += ALPHABET[randomInt(ALPHABET.length)];
  return `AA-${yy}${mm}-${rand}`;
}

export function trLower(s: string) {
  return s.toLocaleLowerCase("tr-TR");
}

export function effectivePrice(p: Product) {
  return minPrice(p);
}

/** Çok satan: gerçekten satılmış ya da elle işaretlenmiş */
const popularity = (p: Product) => p.soldCount * 1000 + (p.isBestseller ? 1 : 0);

/** Bellek içi ürün filtreleme (demo sürücü ve testler için). */
export function filterProducts(
  all: Product[],
  q: ProductQuery,
  categoryIds: string[] | null,
): Product[] {
  let list = all.filter((p) => (q.includeInactive ? p.status !== "archived" : p.status === "active"));
  if (categoryIds) list = list.filter((p) => categoryIds.includes(p.categoryId));
  if (q.q) {
    const needle = trLower(q.q.trim());
    list = list.filter((p) => trLower(`${p.name} ${p.description} ${p.fabric} ${p.measurements}`).includes(needle));
  }
  if (q.size) list = list.filter((p) => p.variants.some((v) => v.size === q.size && v.stock > 0));
  if (q.color) list = list.filter((p) => p.variants.some((v) => trLower(v.color) === trLower(q.color!)));
  if (q.onlyNew) list = list.filter((p) => isNewProduct(p));
  if (q.onlyBestseller) list = list.filter((p) => p.soldCount > 0 || p.isBestseller);
  if (q.onlyDiscounted) list = list.filter((p) => p.compareAtPrice && p.compareAtPrice > p.basePrice);
  switch (q.sort) {
    case "price_asc":
      list = [...list].sort((a, b) => minPrice(a) - minPrice(b));
      break;
    case "price_desc":
      list = [...list].sort((a, b) => minPrice(b) - minPrice(a));
      break;
    case "popular":
      list = [...list].sort((a, b) => popularity(b) - popularity(a) || b.createdAt.localeCompare(a.createdAt));
      break;
    default:
      // Çok Satanlar sayfası satışa göre, diğerleri en yeniye göre
      list = q.onlyBestseller
        ? [...list].sort((a, b) => popularity(b) - popularity(a) || b.createdAt.localeCompare(a.createdAt))
        : [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return q.limit ? list.slice(0, q.limit) : list;
}
