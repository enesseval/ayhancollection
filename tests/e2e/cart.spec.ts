import { test, expect, addToCart } from "../fixtures/test";

// Sepet: beden zorunluluğu, ekleme, adet, silme, kupon ve tutar hesapları

const money = (s: string) => Number(s.replace(/[^\d,]/g, "").replace(",", "."));

async function summary(page: import("@playwright/test").Page) {
  const rows = await page.locator("main dl div").allInnerTexts();
  const get = (label: string) => {
    const r = rows.find((x) => x.startsWith(label));
    return r ? (/Ücretsiz/.test(r) ? 0 : money(r.slice(label.length))) : null;
  };
  return { subtotal: get("Ara toplam"), discount: get("İndirim"), shipping: get("Kargo"), total: get("Toplam") };
}

test("beden seçmeden sepete eklenemez", async ({ page }) => {
  await page.goto("/urun/vizon-uzun-tunik");
  await page.getByRole("button", { name: "Sepete Ekle" }).first().click();
  await expect(page.getByText(/beden seç/i).first()).toBeVisible();
});

test("tükenen beden seçilemez", async ({ page }) => {
  // Örnek veride Vizon Uzun Tunik'in bir renginde tükenen beden var: renkleri sırayla dene
  await page.goto("/urun/vizon-uzun-tunik");
  const swatches = page.getByRole("button", { pressed: false }).filter({ has: page.locator("span.rounded-full") });
  const radios = page.getByRole("radiogroup", { name: "Beden" }).getByRole("radio");
  let found = (await radios.and(page.locator("[disabled]")).count()) > 0;
  for (let i = 0; !found && i < (await swatches.count()); i++) {
    await swatches.nth(i).click();
    found = (await radios.and(page.locator("[disabled]")).count()) > 0;
  }
  expect(found, "en az bir renkte tükenen beden bulunmalı").toBe(true);
  const sold = radios.and(page.locator("[disabled]")).first();
  await expect(sold).toBeDisabled();
});

test("sepete ekle, adet değiştir, tutarlar doğru, sil", async ({ page }) => {
  await addToCart(page, "vizon-uzun-tunik", { size: "40" });
  await page.goto("/sepet");
  await expect(page.getByText("Vizon Uzun Tunik")).toBeVisible();
  await expect.poll(async () => (await summary(page)).total).not.toBeNull();
  let s = await summary(page);
  expect(s.subtotal).toBe(999);
  expect(s.shipping).toBe(79.9); // 1.500 TL altı: kargo ücretli
  expect(s.total).toBeCloseTo(1078.9, 2);

  await page.getByRole("button", { name: "Artır" }).first().click();
  await expect.poll(async () => (await summary(page)).subtotal).toBe(1998);
  s = await summary(page);
  expect(s.shipping).toBe(0); // 1.500 TL üstü: kargo ücretsiz
  expect(s.total).toBe(1998);

  await page.getByRole("button", { name: /kaldır/ }).first().click();
  await expect(page.getByText(/Sepetiniz boş/i)).toBeVisible();
});

test("kupon: geçersiz reddedilir, geçerli indirim uygular, alt limit kontrol edilir", async ({ page }) => {
  await addToCart(page, "vizon-uzun-tunik", { size: "38" });
  await page.goto("/sepet");
  const input = page.getByPlaceholder("Kupon kodu");

  await input.fill("YOKBOYLEKUPON");
  await input.press("Enter");
  await expect(page.getByText("Kupon kodu bulunamadı")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kaldır", exact: true })).toHaveCount(0); // geçersiz kupon uygulanmış görünmemeli

  // KIS150 en az 1.500 TL ister: 999 TL'de reddedilmeli
  await input.fill("kis150");
  await input.press("Enter");
  await expect(page.getByText(/en az|minimum|1\.500/i).first()).toBeVisible();

  // HOSGELDIN10 (%10, en az 500 TL)
  await input.fill("HOSGELDIN10");
  await input.press("Enter");
  await expect(page.getByText('"HOSGELDIN10" kuponu uygulandı.')).toBeVisible();
  await expect.poll(async () => (await summary(page)).discount).toBeCloseTo(99.9, 2);
  const s = await summary(page);
  expect(s.total).toBeCloseTo(999 - 99.9 + 79.9, 2);
});

test("sepet sayfa yenilense de korunur", async ({ page }) => {
  await addToCart(page, "vizon-uzun-tunik", { size: "42" });
  await page.goto("/sepet");
  await page.reload();
  await expect(page.getByText("Vizon Uzun Tunik")).toBeVisible();
});
