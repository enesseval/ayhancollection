import { test, expect, addToCart, fillCheckout, login, loginAdmin, uniq } from "../fixtures/test";

// Güvenlik: yetki, sipariş gizliliği (IDOR), açık yönlendirme, XSS, kaba kuvvet koruması, korumalı uç noktalar

test("giriş yapmamış kullanıcı yönetime giremez, yükleme API'si reddeder", async ({ page, request }) => {
  await page.goto("/yonetim/urunler");
  expect(new URL(page.url()).pathname).toBe("/hesabim");
  const r = await request.post("/api/admin/upload", { multipart: { productId: "00000000-0000-4000-a000-000000000000", file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("x") } } });
  expect([401, 403]).toContain(r.status());
});

test("başka siteden (cross-origin) yükleme isteği reddedilir", async ({ request }) => {
  const r = await request.post("/api/admin/upload", {
    headers: { origin: "https://evil.example" },
    multipart: { productId: "x", file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("x") } },
  });
  expect([401, 403]).toContain(r.status());
});

test("cron uç noktası gizli anahtar olmadan çalışmaz", async ({ request }) => {
  const r = await request.get("/api/cron/release-reservations");
  expect([401, 403]).toContain(r.status());
  const ok = await request.get("/api/cron/release-reservations", { headers: { authorization: "Bearer e2e-cron-secret" } });
  expect(ok.status()).toBe(200);
});

test("sipariş sayfası imzasız/yanlış imzalı bağlantıyla açılmaz (IDOR)", async ({ page, request }) => {
  await addToCart(page, "vizon-uzun-tunik", { size: "38" });
  await page.goto("/odeme");
  await fillCheckout(page, { email: `${uniq("idor")}@example.com`, method: "transfer" });
  await page.getByRole("button", { name: /Siparişi tamamla/ }).click();
  await expect(page.getByRole("heading", { name: /ödemenizi bekliyoruz/ })).toBeVisible();
  const url = new URL(page.url());
  const no = url.searchParams.get("no")!;
  // Çerezsiz (başka kişi) istek
  expect((await request.get(`/odeme/sonuc?no=${no}`, { headers: { cookie: "" } })).status()).toBe(404);
  expect((await request.get(`/odeme/sonuc?no=${no}&t=sahte-imza`, { headers: { cookie: "" } })).status()).toBe(404);
  // Doğru imza ile açılır
  expect((await request.get(`/odeme/sonuc?no=${no}&t=${url.searchParams.get("t")}`, { headers: { cookie: "" } })).status()).toBe(200);
});

test("girişten sonra dış siteye yönlendirme yapılmaz (open redirect)", async ({ page }) => {
  const email = `${uniq("redir")}@example.com`;
  await page.goto("/hesabim");
  await page.getByRole("tab", { name: "Üye ol" }).click();
  const form = page.locator("form").filter({ has: page.locator('input[name="fullName"]') });
  await form.locator('[name="fullName"]').fill("Yönlendirme Test");
  await form.locator('[name="email"]').fill(email);
  await form.locator('[name="password"]').fill("TestSifre-2026x");
  await form.locator('[name="acceptKvkk"]').check();
  await form.getByRole("button", { name: "Üye ol" }).click();
  await expect(page.getByText("Siparişlerim")).toBeVisible();
  await page.locator("main").getByRole("button", { name: "Çıkış yap" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  for (const next of ["https://evil.example", "//evil.example", "/\\evil.example"]) {
    await login(page, email, "TestSifre-2026x", next);
    expect(new URL(page.url()).host).toBe("localhost:3100");
    await page.context().clearCookies();
  }
});

test("hatalı şifre denemelerinde hesap geçici kilitlenir", async ({ page }) => {
  const email = `${uniq("kilit")}@example.com`;
  for (let i = 1; i <= 5; i++) await login(page, email, `yanlis-${i}`);
  await expect(page.getByText(/Çok fazla hatalı deneme yapıldı/)).toBeVisible();
});

test("ürün metinlerinde XSS çalışmaz (HTML/script düz metin olarak kalır)", async ({ page }) => {
  let dialog = false;
  page.on("dialog", async (d) => {
    dialog = true;
    await d.dismiss();
  });
  await loginAdmin(page);
  await page.goto("/yonetim/urunler/yeni");
  const name = `XSS Test ${uniq("x").slice(-4)}`;
  await page.locator("#name").fill(name);
  await page.locator("#categoryId").selectOption({ index: 1 });
  await page.locator("#basePrice").fill("100");
  await page.locator("textarea#description").fill('Merhaba <img src=x onerror="alert(1)"> <script>alert(2)</script> [tikla](javascript:alert(3))');
  await page.getByRole("button", { name: "Varyant ekle" }).click();
  const row = page.locator("#varyantlar tbody tr").last();
  await row.getByLabel("Renk", { exact: true }).selectOption("Siyah");
  await row.getByLabel("Beden", { exact: true }).selectOption("Standart");
  await row.getByLabel("Stok", { exact: true }).fill("1");
  // Önizleme sekmesinde de çalışmamalı
  await page.getByRole("button", { name: "Önizle" }).first().click();
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.waitForURL(/\/yonetim\/urunler\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop();
  // Taslak ürünü mağazada görmek için yayına alma şartı (görsel) yok; içeriği yönetim önizlemesinde ve
  // ürün düzenleme sayfasında doğrularız
  await page.goto(`/yonetim/urunler/${id}`);
  await page.getByRole("button", { name: "Önizle" }).first().click();
  await expect(page.locator("main img[src='x']")).toHaveCount(0);
  await expect(page.locator("main a[href^='javascript']")).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(dialog, "hiçbir alert penceresi açılmamalı").toBe(false);
});
