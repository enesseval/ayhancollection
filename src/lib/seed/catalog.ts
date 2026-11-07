// Demo kataloğu. Instagram'daki ürün yelpazesinden esinlenen örnek ürünler.
// Bu dosya hem demo veri sürücüsü hem de görsel üretme scripti ve SQL seed üretimi tarafından kullanılır.
// Not: Göreli importlar bilinçli (node ile doğrudan çalıştırılabilsin diye).
import { createHash } from "node:crypto";
import type { Category, Coupon, Product, Settings, Variant } from "../types.ts";
import { seedMedia } from "./media-manifest.ts";

export function seedUuid(input: string): string {
  const h = createHash("sha1").update("aac:" + input).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

type CatDef = { slug: string; name: string; parent?: string; description?: string };

const catDefs: CatDef[] = [
  { slug: "tesettur-giyim", name: "Tesettür Giyim", description: "Tunik, takım, elbise ve daha fazlası" },
  { slug: "tunik", name: "Tunik", parent: "tesettur-giyim" },
  { slug: "takim", name: "Takım", parent: "tesettur-giyim" },
  { slug: "elbise", name: "Elbise", parent: "tesettur-giyim" },
  { slug: "etek", name: "Etek", parent: "tesettur-giyim" },
  { slug: "yelek", name: "Yelek", parent: "tesettur-giyim" },
  { slug: "triko-yun", name: "Triko & Yün", parent: "tesettur-giyim" },
  { slug: "esarp-sal", name: "Eşarp & Şal", description: "Desenli eşarp ve şallar" },
  { slug: "pijama-ev-giyim", name: "Pijama & Ev Giyim", description: "Kadın ve erkek pijama takımları" },
  { slug: "kadin-pijama", name: "Kadın Pijama", parent: "pijama-ev-giyim" },
  { slug: "erkek-pijama", name: "Erkek Pijama", parent: "pijama-ev-giyim" },
  { slug: "erkek", name: "Erkek", description: "Tişört ve günlük giyim" },
  { slug: "erkek-tisort", name: "Tişört", parent: "erkek" },
];

export const seedCategories: Category[] = catDefs.map((c, i) => ({
  id: seedUuid("cat:" + c.slug),
  slug: c.slug,
  name: c.name,
  parentId: c.parent ? seedUuid("cat:" + c.parent) : null,
  sort: i,
  description: c.description,
}));

export type Art =
  | "tunic"
  | "set"
  | "dress"
  | "skirt"
  | "vest"
  | "knit"
  | "scarf"
  | "pajama"
  | "tshirt";

export type Pattern = "plain" | "paisley" | "waves" | "zebra" | "medallion" | "floral" | "dots" | "stripes" | "batik" | "pleats";

export type ProductDef = {
  slug: string;
  name: string;
  category: string;
  price: number; // TL
  compareAt?: number; // TL
  colors: { name: string; hex: string }[];
  sizes: string[];
  art: Art;
  pattern: Pattern;
  accent?: string;
  isNew?: boolean;
  isBestseller?: boolean;
  description: string;
  fabric: string;
  care: string;
};

const tesetturSizes = ["36", "38", "40", "42", "44", "46"];
const pijamaSizes = ["S", "M", "L", "XL", "2XL"];
const careStd = "30°C'de tersten yıkayın. Ağartıcı kullanmayın. Düşük ısıda ütüleyin.";
const careSilk = "Elde soğuk suda yıkayın veya kuru temizleme. Sıkmadan gölgede kurutun.";

export const productDefs: ProductDef[] = [
  {
    slug: "raglan-kol-lacivert-tunik",
    name: "Raglan Kol Lacivert Tunik",
    category: "tunik",
    price: 1099,
    compareAt: 1399,
    colors: [
      { name: "Lacivert", hex: "#1F2A44" },
      { name: "İndigo", hex: "#3B4A6B" },
    ],
    sizes: tesetturSizes,
    art: "tunic",
    pattern: "plain",
    accent: "#2B3A5E",
    isBestseller: true,
    description:
      "Raglan kol kesimi ve yaka detayındaki ince taş işlemesiyle günlük şıklığın en rahat hali. Diz altı boyu ve hafif A kesimiyle her bedene uyum sağlar.",
    fabric: "%95 Viskon, %5 Elastan. Model 1,72 m ve 38 beden giyiyor. Boy: 105 cm.",
    care: careStd,
  },
  {
    slug: "pliseli-lacivert-uzun-etek",
    name: "Pliseli Lacivert Uzun Etek",
    category: "etek",
    price: 849,
    colors: [
      { name: "Lacivert", hex: "#1D2742" },
      { name: "Siyah", hex: "#151515" },
    ],
    sizes: tesetturSizes,
    art: "skirt",
    pattern: "pleats",
    isNew: true,
    description:
      "Önden fermuar detaylı, beli lastikli pliseli uzun etek. Tunik ve gömleklerle kolayca kombinlenir.",
    fabric: "%100 Polyester. Boy: 95 cm.",
    care: careStd,
  },
  {
    slug: "denim-gorunumlu-yelek-takim",
    name: "Denim Görünümlü Yelek Takım",
    category: "takim",
    price: 1699,
    compareAt: 1999,
    colors: [{ name: "Mavi", hex: "#3E6C9E" }],
    sizes: tesetturSizes,
    art: "vest",
    pattern: "plain",
    accent: "#E9E4DA",
    isNew: true,
    isBestseller: true,
    description:
      "Nakış detaylı beyaz gömlek tunik ve denim görünümlü uzun yelekten oluşan iki parça takım. Etek ucundaki fırfır detayı ile farklı bir görünüm.",
    fabric: "Yelek: %70 Pamuk, %30 Polyester. Tunik: %100 Pamuk.",
    care: careStd,
  },
  {
    slug: "batik-desen-triko-tunik",
    name: "Batik Desen Triko Tunik",
    category: "triko-yun",
    price: 1249,
    colors: [
      { name: "Lacivert", hex: "#1B2433" },
      { name: "Antrasit", hex: "#2E3135" },
    ],
    sizes: tesetturSizes,
    art: "knit",
    pattern: "batik",
    accent: "#6E8BA0",
    isNew: true,
    description:
      "Önünde batik etkili desen bulunan, yumuşak dokulu triko tunik. Serin havalarda tek başına ya da gömlek üzerine giyilebilir.",
    fabric: "%50 Yün, %50 Akrilik.",
    care: "30°C'de yün programında yıkayın. Asmadan, serili kurutun.",
  },
  {
    slug: "vizon-uzun-tunik",
    name: "Vizon Uzun Tunik",
    category: "tunik",
    price: 999,
    colors: [
      { name: "Vizon", hex: "#6B625C" },
      { name: "Bej", hex: "#B8A894" },
      { name: "Siyah", hex: "#1A1A1A" },
    ],
    sizes: tesetturSizes,
    art: "tunic",
    pattern: "plain",
    isBestseller: true,
    description:
      "Balon kol ve yırtmaç detaylı, sade ve zarif uzun tunik. Ofis ve günlük kullanım için ideal.",
    fabric: "%100 Polyester krep. Boy: 115 cm.",
    care: careStd,
  },
  {
    slug: "murdum-dalga-desen-takim",
    name: "Mürdüm Dalga Desen Takım",
    category: "takim",
    price: 1549,
    colors: [{ name: "Mürdüm", hex: "#5A2A3F" }],
    sizes: tesetturSizes,
    art: "set",
    pattern: "waves",
    accent: "#7A3B57",
    isNew: true,
    description:
      "Ön kısmı dalga desenli tunik ve aynı renk düz etekten oluşan şık takım. Özel günler için zahmetsiz bir kombin.",
    fabric: "%95 Polyester, %5 Elastan.",
    care: careStd,
  },
  {
    slug: "krem-batik-uzun-elbise",
    name: "Krem Batik Uzun Elbise",
    category: "elbise",
    price: 1399,
    colors: [{ name: "Krem", hex: "#E8E1D6" }],
    sizes: tesetturSizes,
    art: "dress",
    pattern: "batik",
    accent: "#B9A99A",
    description:
      "Kemerli, hafif batik desenli uzun elbise. Akışkan kumaşı sayesinde yaz aylarında da rahat.",
    fabric: "%100 Viskon. Boy: 140 cm.",
    care: careStd,
  },
  {
    slug: "siyah-volan-yelek",
    name: "Siyah Volan Detaylı Yelek",
    category: "yelek",
    price: 899,
    colors: [
      { name: "Siyah", hex: "#161616" },
      { name: "Lacivert", hex: "#1D2742" },
    ],
    sizes: tesetturSizes,
    art: "vest",
    pattern: "plain",
    accent: "#2A2A2A",
    description: "Tunik ve elbiselerin üzerine şık bir katman. Etek ucunda volan detayı.",
    fabric: "%100 Polyester.",
    care: careStd,
  },
  {
    slug: "kahve-sal-desen-ipek-esarp",
    name: "Kahve Şal Desen İpek Eşarp",
    category: "esarp-sal",
    price: 549,
    compareAt: 699,
    colors: [{ name: "Kahve", hex: "#7A5534" }],
    sizes: ["90x90 cm"],
    art: "scarf",
    pattern: "medallion",
    accent: "#D6B98C",
    isBestseller: true,
    description: "Klasik şal (kaşmir) motifli, kenarı ince bordürlü ipeksi eşarp. Yumuşak dökümlü, kaymaz.",
    fabric: "%100 Polyester ipeksi twill. Ölçü: 90 x 90 cm.",
    care: careSilk,
  },
  {
    slug: "zumrut-sal-desen-esarp",
    name: "Zümrüt Şal Desen Eşarp",
    category: "esarp-sal",
    price: 499,
    colors: [{ name: "Zümrüt", hex: "#1F6B5C" }],
    sizes: ["90x90 cm"],
    art: "scarf",
    pattern: "paisley",
    accent: "#C99A3D",
    isNew: true,
    description: "Zümrüt yeşili zemin üzerinde altın tonlu şal desenleri. Koyu renk kombinlerin yıldızı.",
    fabric: "%100 Polyester ipeksi twill. Ölçü: 90 x 90 cm.",
    care: careSilk,
  },
  {
    slug: "zebra-desen-twill-esarp",
    name: "Zebra Desen Twill Eşarp",
    category: "esarp-sal",
    price: 529,
    colors: [{ name: "Kahve-Bej", hex: "#5C4A3E" }],
    sizes: ["90x90 cm"],
    art: "scarf",
    pattern: "zebra",
    accent: "#E3D5C3",
    isNew: true,
    description: "Zebra ve leopar desenlerinin bir araya geldiği modern twill eşarp.",
    fabric: "%100 Polyester twill. Ölçü: 90 x 90 cm.",
    care: careSilk,
  },
  {
    slug: "haki-dalga-desen-esarp",
    name: "Haki Dalga Desen Eşarp",
    category: "esarp-sal",
    price: 459,
    colors: [{ name: "Haki", hex: "#59563A" }],
    sizes: ["90x90 cm"],
    art: "scarf",
    pattern: "waves",
    accent: "#C9BE8E",
    description: "Haki ve bej tonlarında dalga desenli, günlük kullanıma uygun eşarp.",
    fabric: "%100 Polyester. Ölçü: 90 x 90 cm.",
    care: careSilk,
  },
  {
    slug: "pudra-cicek-desen-sal",
    name: "Pudra Çiçek Desen Şal",
    category: "esarp-sal",
    price: 389,
    colors: [{ name: "Pudra", hex: "#E7C3C4" }],
    sizes: ["75x200 cm"],
    art: "scarf",
    pattern: "floral",
    accent: "#B9787E",
    description: "Hafif ve nefes alan, pudra zeminde küçük çiçek desenli uzun şal.",
    fabric: "%100 Viskon. Ölçü: 75 x 200 cm.",
    care: careSilk,
  },
  {
    slug: "mint-desenli-kadin-pijama-takimi",
    name: "Mint Desenli Kadın Pijama Takımı",
    category: "kadin-pijama",
    price: 899,
    compareAt: 1099,
    colors: [{ name: "Mint", hex: "#A9CDB7" }],
    sizes: pijamaSizes,
    art: "pajama",
    pattern: "floral",
    accent: "#E6EFE8",
    isBestseller: true,
    description: "Düz mint üst ve yaprak desenli alt. Pamuklu dokusuyla tüm gün rahatlık.",
    fabric: "%100 Pamuk penye.",
    care: careStd,
  },
  {
    slug: "tropikal-desen-kadin-pijama",
    name: "Tropikal Desen Kadın Pijama Takımı",
    category: "kadin-pijama",
    price: 949,
    colors: [{ name: "Çok Renkli", hex: "#3E7CB1" }],
    sizes: pijamaSizes,
    art: "pajama",
    pattern: "floral",
    accent: "#F2B544",
    isNew: true,
    description: "Gömlek yaka, düğmeli tropikal desenli üst ve düz mavi alt.",
    fabric: "%100 Viskon.",
    care: careStd,
  },
  {
    slug: "bordo-erkek-pijama-takimi",
    name: "Bordo Erkek Pijama Takımı",
    category: "erkek-pijama",
    price: 999,
    colors: [
      { name: "Bordo", hex: "#6E2430" },
      { name: "Lacivert", hex: "#1F2A44" },
    ],
    sizes: pijamaSizes,
    art: "pajama",
    pattern: "stripes",
    accent: "#2B2B2B",
    isBestseller: true,
    description: "Patlı yaka bordo üst ve çizgili alt. Yumuşak pamuklu kumaş.",
    fabric: "%100 Pamuk.",
    care: careStd,
  },
  {
    slug: "sari-desenli-erkek-tisort",
    name: "Sarı Desenli Erkek Tişört",
    category: "erkek-tisort",
    price: 449,
    colors: [
      { name: "Sarı", hex: "#E8D44D" },
      { name: "Beyaz", hex: "#F2F2EE" },
    ],
    sizes: ["S", "M", "L", "XL", "2XL"],
    art: "tshirt",
    pattern: "dots",
    accent: "#1F2A44",
    description: "Kolları lacivert biyeli, minimal desenli yazlık tişört.",
    fabric: "%100 Pamuk.",
    care: careStd,
  },
  {
    slug: "lacivert-polo-yaka-tisort",
    name: "Lacivert Polo Yaka Tişört",
    category: "erkek-tisort",
    price: 529,
    colors: [{ name: "Lacivert", hex: "#1F2A44" }],
    sizes: ["S", "M", "L", "XL", "2XL"],
    art: "tshirt",
    pattern: "plain",
    accent: "#FFFFFF",
    description: "Pike kumaştan klasik polo yaka tişört.",
    fabric: "%100 Pamuk pike.",
    care: careStd,
  },
  {
    slug: "gri-sardonyks-tunik",
    name: "Gri Ribana Kol Tunik",
    category: "tunik",
    price: 949,
    colors: [{ name: "Gri", hex: "#5F6266" }],
    sizes: tesetturSizes,
    art: "tunic",
    pattern: "plain",
    accent: "#3D4044",
    description: "Ribana kol ağzı ve sade kesimiyle her güne uyan tunik.",
    fabric: "%95 Viskon, %5 Elastan.",
    care: careStd,
  },
  {
    slug: "vizon-triko-takim",
    name: "Vizon Triko Takım",
    category: "triko-yun",
    price: 1799,
    compareAt: 2099,
    colors: [{ name: "Vizon", hex: "#8A7D72" }],
    sizes: ["S/M", "L/XL"],
    art: "knit",
    pattern: "plain",
    accent: "#6E625A",
    description: "Uzun triko hırka ve aynı renk triko etekten oluşan sıcak takım.",
    fabric: "%30 Yün, %70 Akrilik.",
    care: "30°C'de yün programında yıkayın. Serili kurutun.",
  },
];

export function slugToProductId(slug: string) {
  return seedUuid("product:" + slug);
}

function variantsFor(def: ProductDef): Variant[] {
  const productId = slugToProductId(def.slug);
  const out: Variant[] = [];
  def.colors.forEach((c, ci) => {
    def.sizes.forEach((s, si) => {
      // Deterministik ama gerçekçi stok dağılımı: kenar bedenlerde az stok, bazıları tükenmiş.
      const seed = createHash("md5").update(def.slug + c.name + s).digest()[0];
      let stock = 2 + (seed % 9);
      if (def.sizes.length === 1) stock = 8 + (seed % 15);
      else if (si === 0 || si === def.sizes.length - 1) stock = seed % 7 === 0 ? 0 : 1 + (seed % 3); // çoğu 1-3, bazıları tükenmiş
      const code = def.slug
        .split("-")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 5);
      out.push({
        id: seedUuid(`variant:${def.slug}:${c.name}:${s}`),
        productId,
        sku: `${code}-${ci + 1}${String(si + 1).padStart(2, "0")}-${s.replace(/[^A-Z0-9]/gi, "")}`,
        size: s,
        color: c.name,
        colorHex: c.hex,
        stock,
        priceOverride: null,
      });
    });
  });
  return out;
}

const baseDate = Date.UTC(2026, 9, 1);

export const seedProducts: Product[] = productDefs.map((def, i) => {
  const cat = seedCategories.find((c) => c.slug === def.category);
  if (!cat) throw new Error("Kategori yok: " + def.category);
  return {
    id: slugToProductId(def.slug),
    slug: def.slug,
    name: def.name,
    description: def.description,
    fabric: def.fabric,
    care: def.care,
    categoryId: cat.id,
    basePrice: def.price * 100,
    compareAtPrice: def.compareAt ? def.compareAt * 100 : null,
    status: "active",
    isNew: !!def.isNew,
    isBestseller: !!def.isBestseller,
    vatRate: 10,
    sizeChartId: null,
    soldCount: 0,
    media: seedMedia[def.slug] ?? [],
    variants: variantsFor(def),
    createdAt: new Date(baseDate + (def.isNew ? 25 : i) * 86400000 + i * 3600000).toISOString(),
  };
});

export const seedCoupons: Coupon[] = [
  {
    id: seedUuid("coupon:HOSGELDIN10"),
    code: "HOSGELDIN10",
    type: "percent",
    value: 10,
    minSubtotal: 50000,
    startsAt: null,
    endsAt: null,
    usageLimit: 1000,
    usedCount: 37,
    active: true,
  },
  {
    id: seedUuid("coupon:KIS150"),
    code: "KIS150",
    type: "fixed",
    value: 15000,
    minSubtotal: 150000,
    startsAt: null,
    endsAt: "2026-12-31T20:59:59.000Z",
    usageLimit: 200,
    usedCount: 12,
    active: true,
  },
];

export const seedSettings: Settings = {
  shippingFee: 7990,
  freeShippingThreshold: 150000,
  bankAccounts: [
    { bank: "Örnek Bank (DEMO)", holder: "Ayşe Ayhan", iban: "TR00 0000 0000 0000 0000 0000 00" },
  ],
  whatsapp: "905376079584",
  instagram: "ayse.ayhan.collection",
  announcement: "1.500 TL ve üzeri siparişlerde kargo ücretsiz · Türkiye'nin her yerine gönderim",
};
