import { test, expect, addToCart, fillCheckout, login, uniq } from "../fixtures/test";

// Müşteri hesabı: üyelik doğrulamaları, giriş/çıkış, siparişlerim, yönetime erişememe

test("üyelik formu geçersiz girdileri reddeder", async ({ page }) => {
  await page.goto("/hesabim");
  await page.getByRole("tab", { name: "Üye ol" }).click();
  const form = page.locator("form").filter({ has: page.locator('input[name="fullName"]') });
  await form.locator('[name="fullName"]').fill("A");
  await form.locator('[name="email"]').fill("gecersiz");
  await form.locator('[name="password"]').fill("123");
  await form.getByRole("button", { name: "Üye ol" }).click();
  await expect(page.getByText("Ad soyad en az 3 karakter olmalı")).toBeVisible();
  await expect(page.getByText("Şifre en az 10 karakter olmalı")).toBeVisible();
});

test("üye ol → çıkış → yanlış şifre → doğru şifre → siparişlerim", async ({ page }) => {
  const email = `${uniq("uye")}@example.com`;
  const password = "TestSifre-2026x";
  await page.goto("/hesabim");
  await page.getByRole("tab", { name: "Üye ol" }).click();
  const form = page.locator("form").filter({ has: page.locator('input[name="fullName"]') });
  await form.locator('[name="fullName"]').fill("E2E Üye");
  await form.locator('[name="email"]').fill(email);
  await form.locator('[name="password"]').fill(password);
  await form.locator('[name="acceptKvkk"]').check();
  await form.getByRole("button", { name: "Üye ol" }).click();
  await expect(page.getByText("Siparişlerim")).toBeVisible();

  // Aynı e-postayla ikinci üyelik reddedilir
  await page.locator("main").getByRole("button", { name: "Çıkış yap" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/hesabim");
  await page.getByRole("tab", { name: "Üye ol" }).click();
  await form.locator('[name="fullName"]').fill("Kopya Hesap");
  await form.locator('[name="email"]').fill(email);
  await form.locator('[name="password"]').fill("BaskaSifre-2026x");
  await form.locator('[name="acceptKvkk"]').check();
  await form.getByRole("button", { name: "Üye ol" }).click();
  await expect(page.locator('[role="alert"]').first()).toBeVisible();

  await login(page, email, "yanlis-sifre-123");
  await expect(page.getByText("E-posta veya şifre hatalı")).toBeVisible();
  await login(page, email, password);
  await expect(page.getByText("Siparişlerim")).toBeVisible();

  // Giriş yapmışken sipariş ver → Siparişlerim'de görünür, form e-postası hesaptan dolu
  await addToCart(page, "vizon-uzun-tunik", { size: "40" });
  await page.goto("/odeme");
  await expect(page.locator("#email")).toHaveValue(email);
  await fillCheckout(page, { email, method: "transfer" });
  await page.getByRole("button", { name: /Siparişi tamamla/ }).click();
  await expect(page.getByRole("heading", { name: /ödemenizi bekliyoruz/ })).toBeVisible();
  await page.goto("/hesabim");
  await expect(page.locator("main").getByText(/AA-\d{4}-/).first()).toBeVisible();
});

test("müşteri yönetim paneline giremez", async ({ page }) => {
  const email = `${uniq("musteri")}@example.com`;
  await page.goto("/hesabim");
  await page.getByRole("tab", { name: "Üye ol" }).click();
  const form = page.locator("form").filter({ has: page.locator('input[name="fullName"]') });
  await form.locator('[name="fullName"]').fill("Yetkisiz Müşteri");
  await form.locator('[name="email"]').fill(email);
  await form.locator('[name="password"]').fill("TestSifre-2026x");
  await form.locator('[name="acceptKvkk"]').check();
  await form.getByRole("button", { name: "Üye ol" }).click();
  await expect(page.getByText("Siparişlerim")).toBeVisible();
  await page.goto("/yonetim");
  expect(new URL(page.url()).pathname).toBe("/hesabim"); // giriş sayfasına yönlendirilir
  await page.goto("/yonetim/urunler");
  await expect(page.getByRole("heading", { name: "Ürünler" })).toHaveCount(0);
});
