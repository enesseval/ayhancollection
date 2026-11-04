import { z } from "zod";

// Hem istemci hem sunucuda kullanılan şemalar. Sunucu her zaman yeniden doğrular.

const trPhone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s()-]/g, ""))
  .refine((s) => /^(\+90|0)?5\d{9}$/.test(s), "Geçerli bir cep telefonu girin (05xx xxx xx xx)");

const name = z.string().trim().min(3, "Ad soyad en az 3 karakter olmalı").max(80);

export const addressSchema = z.object({
  fullName: name,
  phone: trPhone,
  city: z.string().trim().min(2, "İl seçin").max(40),
  district: z.string().trim().min(2, "İlçe girin").max(60),
  line: z.string().trim().min(10, "Açık adresi mahalle, sokak ve numara ile girin").max(300),
  postalCode: z
    .string()
    .trim()
    .max(5)
    .refine((s) => s === "" || /^\d{5}$/.test(s), "Posta kodu 5 haneli olmalı")
    .optional(),
});

export const cartLineSchema = z.object({
  variantId: z.string().uuid(),
  qty: z.number().int().min(1).max(10),
});

export const checkoutSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin").max(120),
  address: addressSchema,
  paymentMethod: z.enum(["card", "transfer"]),
  couponCode: z.string().trim().toUpperCase().max(24).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
  lines: z.array(cartLineSchema).min(1, "Sepetiniz boş").max(30),
  acceptContract: z.literal(true, { message: "Ön bilgilendirme formu ve mesafeli satış sözleşmesini onaylamalısınız" }),
  acceptKvkk: z.literal(true, { message: "KVKK aydınlatma metnini okuduğunuzu onaylamalısınız" }),
  marketing: z.boolean().optional(),
  utm: z.record(z.string(), z.string().max(100)).optional(),
  turnstileToken: z.string().max(4096).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
  password: z.string().min(1, "Şifre girin").max(200),
});

export const registerSchema = z.object({
  fullName: name,
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
  password: z
    .string()
    .min(10, "Şifre en az 10 karakter olmalı")
    .max(200)
    .refine((s) => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(s) && /\d/.test(s), "Şifre harf ve rakam içermeli"),
  acceptKvkk: z.literal(true, { message: "KVKK aydınlatma metnini onaylamalısınız" }),
});

export const orderLookupSchema = z.object({
  orderNo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^AA-\d{4}-[A-Z0-9]{5,6}$/, "Sipariş numarası AA-2611-XXXXXX biçiminde olmalı"),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
});

export const productFormSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(140),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,80}$/, "Adres yalnız küçük harf, rakam ve tire içerebilir"),
  description: z.string().trim().max(4000),
  fabric: z.string().trim().max(500),
  care: z.string().trim().max(500),
  categoryId: z.string().uuid("Kategori seçin"),
  basePrice: z.number().int().min(0).max(100_000_00),
  compareAtPrice: z.number().int().min(0).max(100_000_00).nullable(),
  status: z.enum(["draft", "active", "archived"]),
  isNew: z.boolean(),
  isBestseller: z.boolean(),
  variants: z
    .array(
      z.object({
        id: z.string().optional().or(z.literal("")),
        sku: z.string().trim().min(2).max(40),
        size: z.string().trim().min(1).max(20),
        color: z.string().trim().min(1).max(30),
        colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        stock: z.number().int().min(0).max(100000),
        priceOverride: z.number().int().min(0).nullable(),
      }),
    )
    .min(1, "En az bir varyant ekleyin")
    .max(120),
});

export const couponFormSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,24}$/, "Kod 3-24 harf/rakam olmalı"),
  type: z.enum(["percent", "fixed"]),
  value: z.number().int().positive(),
  minSubtotal: z.number().int().min(0),
  endsAt: z.string().optional().or(z.literal("")),
  usageLimit: z.number().int().positive().nullable(),
  active: z.boolean(),
});

export const TR_CITIES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin",
  "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa",
  "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum",
  "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir",
  "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis", "Kırıkkale", "Kırklareli",
  "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir",
  "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop", "Şırnak", "Sivas",
  "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak",
];
