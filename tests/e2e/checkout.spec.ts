import { test, expect, addToCart, fillCheckout, uniq } from "../fixtures/test";

// Ödeme: form doğrulama, kartla başarılı/başarısız ödeme (demo 3D Secure), havale, sipariş takibi

test("boş form gönderilince alan hataları gösterilir", async ({ page }) => {
  await addToCart(page, "vizon-uzun-tunik", { size: "38" });
  await page.goto("/odeme");
  await page.getByRole("button", { name: /Ödemeye geç|Siparişi tamamla/ }).click();
  await expect(page.locator(".field-error").first()).toBeVisible();
  expect(await page.locator(".field-error").count()).toBeGreaterThanOrEqual(5);
  await expect(page).toHaveURL(/\/odeme$/);
});

test("kartla başarılı ödeme: sipariş 'Ödendi', sepet boşalır, sipariş takibiyle bulunur", async ({ page }) => {
  const email = `${uniq("kart")}@example.com`;
  await addToCart(page, "vizon-uzun-tunik", { size: "40" });
  await page.goto("/odeme");
  await fillCheckout(page, { email, method: "card" });
  await page.getByRole("button", { name: /Ödemeye geç/ }).click();

  // Demo 3D Secure ekranı: tutar sipariş tutarıyla aynı olmalı (999 + 79,90 kargo)
  await expect(page.getByRole("heading", { name: "Ödeme onayı" })).toBeVisible();
  await expect(page.getByText("₺1.078,90")).toBeVisible();
  await page.getByRole("button", { name: "Ödemeyi onayla (başarılı)" }).click();

  await expect(page.getByRole("heading", { name: "Siparişiniz alındı, teşekkürler!" })).toBeVisible();
  await expect(page.getByText("Ödendi").first()).toBeVisible();
  const orderNo = (await page.locator("text=/AA-\\d{4}-[A-Z0-9]{6}/").first().textContent())!.match(/AA-\d{4}-[A-Z0-9]{6}/)![0];

  // Sepet boşaldı
  await page.goto("/sepet");
  await expect(page.getByText(/Sepetiniz boş/i)).toBeVisible();

  // Sipariş takibi: yanlış e-posta bulunamaz, doğru e-posta (büyük harfle) bulunur
  await page.goto("/siparis-takip");
  await page.getByPlaceholder("AA-2611-XXXXXX").fill(orderNo);
  await page.getByRole("textbox", { name: "Siparişte kullandığınız e-posta" }).fill("baskasi@example.com");
  await page.getByRole("button", { name: "Siparişimi bul" }).click();
  await expect(page.getByText("Bu bilgilere ait sipariş bulunamadı.")).toBeVisible();
  await page.getByRole("textbox", { name: "Siparişte kullandığınız e-posta" }).fill(email.toUpperCase());
  await page.getByRole("button", { name: "Siparişimi bul" }).click();
  await expect(page.getByText(orderNo).first()).toBeVisible();
  await expect(page.getByText("Ödendi").first()).toBeVisible();
});

test("kart reddedilirse sipariş tamamlanmaz ve kullanıcı uyarılır", async ({ page }) => {
  await addToCart(page, "vizon-uzun-tunik", { size: "42" });
  await page.goto("/odeme");
  await fillCheckout(page, { email: `${uniq("red")}@example.com`, method: "card" });
  await page.getByRole("button", { name: /Ödemeye geç/ }).click();
  await page.getByRole("button", { name: /Kart reddedildi/ }).click();
  await expect(page).toHaveURL(/\/odeme\?hata=odeme/);
  await expect(page.getByText(/Ödeme tamamlanamadı/)).toBeVisible();
  // Sepet korunur, müşteri tekrar deneyebilir
  await page.goto("/sepet");
  await expect(page.getByText("Vizon Uzun Tunik")).toBeVisible();
});

test("havale siparişi: IBAN ve açıklama bilgisi gösterilir, durum 'Havale bekleniyor'", async ({ page }) => {
  await addToCart(page, "vizon-uzun-tunik", { size: "44" });
  await page.goto("/odeme");
  await fillCheckout(page, { email: `${uniq("havale")}@example.com`, method: "transfer" });
  await page.getByRole("button", { name: /Siparişi tamamla/ }).click();
  await expect(page.getByRole("heading", { name: "Siparişiniz alındı, ödemenizi bekliyoruz" })).toBeVisible();
  await expect(page.getByText(/TR\d{2}/).first()).toBeVisible();
  await expect(page.getByText(/Havale bekleniyor/).first()).toBeVisible();
});

test("sepetteki fiyat değiştirilse bile sunucu gerçek fiyatı uygular", async ({ page }) => {
  await addToCart(page, "vizon-uzun-tunik", { size: "38" });
  // Tarayıcıdaki sepet kaydında fiyatı 1 TL'ye çek (kötü niyetli müşteri senaryosu)
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("aac-cart-v1")!);
    raw.state.items = raw.state.items.map((i: { unitPrice: number }) => ({ ...i, unitPrice: 100 }));
    localStorage.setItem("aac-cart-v1", JSON.stringify(raw));
  });
  await page.goto("/odeme");
  await fillCheckout(page, { email: `${uniq("fiyat")}@example.com`, method: "card" });
  await page.getByRole("button", { name: /Ödemeye geç/ }).click();
  await expect(page.getByRole("heading", { name: "Ödeme onayı" })).toBeVisible();
  await expect(page.getByText("₺1.078,90")).toBeVisible(); // gerçek fiyat + kargo
});
