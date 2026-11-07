import { test as base, expect, type Page } from "@playwright/test";

// Ortak test altyapısı:
// - Çerez bandı önceden onaylı (tıklamaları engellemesin)
// - Her test kendi sahte IP'siyle gelir: IP başına hız sınırları testleri birbirine bağlamaz
// - Sayfadaki konsol hataları ve yakalanmamış istisnalar toplanır; test sonunda boş olmalı
export const ADMIN = { email: "admin@ayseayhan.demo", password: "AyseAyhan-Demo-2026" };

type Fixtures = { consoleErrors: string[] };

export const test = base.extend<Fixtures>({
  extraHTTPHeaders: async ({}, use) => {
    const ip = `10.${rnd()}.${rnd()}.${rnd()}`;
    await use({ "x-forwarded-for": ip });
  },
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("aac-consent-v1", JSON.stringify({ analytics: false, marketing: false, at: new Date().toISOString() }));
      } catch {}
    });
    await use(page);
  },
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const t = m.text();
      // Tarayıcının kendi kaynak yükleme 404'leri (ör. favicon önbelleği) gürültüdür
      if (/Failed to load resource: the server responded with a status of 404/.test(t)) return;
      errors.push(t);
    });
    await use(errors);
  },
});
export { expect };

function rnd() {
  return Math.floor(Math.random() * 250) + 1;
}

export function uniq(prefix = "e2e") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Ürün sayfasında beden (ve istenirse renk) seçip sepete ekler */
export async function addToCart(page: Page, slug: string, opts: { size?: string; color?: string; qty?: number } = {}) {
  await page.goto(`/urun/${slug}`);
  if (opts.color) await page.getByRole("button", { name: opts.color, exact: true }).first().click();
  const sizes = page.getByRole("radiogroup", { name: "Beden" }).getByRole("radio");
  if (opts.size) await sizes.filter({ hasText: new RegExp(`^${opts.size}$`) }).first().click();
  else await sizes.and(page.locator(":not([disabled])")).first().click();
  for (let i = 1; i < (opts.qty ?? 1); i++) await page.getByRole("button", { name: "Artır" }).first().click();
  await page.getByRole("button", { name: "Sepete Ekle" }).first().click();
}

/** Ödeme formunu geçerli test bilgileriyle doldurur */
export async function fillCheckout(page: Page, o: { email: string; method: "card" | "transfer" }) {
  await page.locator("#email").fill(o.email);
  await page.getByPlaceholder("05xx xxx xx xx").fill("0532 111 22 33");
  await page.getByLabel("Ad soyad").fill("E2E Test Müşteri");
  await page.locator('select[name="city"]').selectOption("Eskişehir");
  await page.getByLabel("İlçe").fill("Odunpazarı");
  await page.getByPlaceholder("Mahalle, cadde/sokak, bina ve daire no").fill("Test Mah. Deneme Sok. No: 1 Daire 2");
  await page.getByRole("radio", { name: o.method === "card" ? /Kredi/ : /Havale/ }).click();
  await page.locator('input[name="acceptContract"]').check();
  await page.locator('input[name="acceptKvkk"]').check();
}

export async function login(page: Page, email: string, password: string, next?: string) {
  await page.goto(next ? `/hesabim?next=${encodeURIComponent(next)}` : "/hesabim");
  const form = page.locator("form").filter({ has: page.locator('input[type="password"]') }).first();
  await form.locator('input[type="email"]').fill(email);
  await form.locator('input[type="password"]').fill(password);
  await form.getByRole("button", { name: "Giriş yap" }).click();
  // Sonuç bekle: ya hata mesajı ya da giriş formunun kaybolması (yönlendirme)
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)').or(page.getByText("Siparişlerim")).or(page.getByRole("heading", { name: "Pano" })).first()).toBeVisible();
}

export async function loginAdmin(page: Page) {
  await login(page, ADMIN.email, ADMIN.password, "/yonetim");
  if (!/\/yonetim/.test(page.url())) await page.goto("/yonetim");
  await expect(page.getByRole("heading", { name: "Pano" })).toBeVisible();
}

/** Gerçek bir PNG üretir (görsel yükleme testleri için) */
export async function testPng(color = { r: 176, g: 141, b: 121 }): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: 800, height: 1000, channels: 3, background: color } }).png().toBuffer();
}
