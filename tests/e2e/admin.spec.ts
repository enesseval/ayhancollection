import { test, expect, addToCart, fillCheckout, loginAdmin, testPng, uniq } from "../fixtures/test";
import type { Page } from "@playwright/test";

// Yönetim paneli: kategori, beden tablosu, ürün (görsel + varyant), liste filtreleri ve kısayollar,
// sipariş durum akışı (havale → hazırlanıyor → kargo → teslim), kupon, ayarlar, e-posta önizleme
test.describe.configure({ mode: "serial" });

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function addVariant(page: Page, color: string, size: string, stock: number) {
  await page.getByRole("button", { name: "Varyant ekle" }).click();
  const row = page.locator("#varyantlar tbody tr").last();
  await row.getByLabel("Renk", { exact: true }).selectOption(color);
  await row.getByLabel("Beden", { exact: true }).selectOption(size);
  await row.getByLabel("Stok", { exact: true }).fill(String(stock));
}

test("yönetici girişi ve pano", async ({ page }) => {
  await loginAdmin(page);
  for (const t of ["Bugünkü sipariş", "Havale bekleyen", "Düşük stok"]) await expect(page.getByText(t).first()).toBeVisible();
});

test("kategori: ekle → mağazada görünür → gizle → mağazadan kalkar", async ({ page }) => {
  await loginAdmin(page);
  const name = `E2E Kategori ${uniq("k").slice(-4)}`;
  await page.goto("/yonetim/kategoriler");
  await page.getByRole("button", { name: "Yeni kategori" }).click();
  await page.locator("#cat-name").fill(name);
  const slug = await page.locator("#cat-slug").inputValue();
  expect(slug).toBe(slugOf(name));
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText(name).first()).toBeVisible();
  expect((await page.goto(`/kategori/${slug}`))?.status()).toBe(200);

  // Ayrılmış adres reddedilir
  await page.goto("/yonetim/kategoriler");
  await page.getByRole("button", { name: "Yeni kategori" }).click();
  await page.locator("#cat-name").fill("Yeni");
  await page.locator("#cat-slug").fill("yeni");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText(/özel bir sayfaya ait/)).toBeVisible();
  await page.getByRole("button", { name: "Vazgeç" }).click();

  // Gizle
  const row = page.locator("li").filter({ hasText: name }).first();
  await row.getByRole("button", { name: "Mağazada gizle" }).click();
  await expect(row.getByText("GİZLİ")).toBeVisible();
  expect((await page.goto(`/kategori/${slug}`))?.status()).toBe(404);
});

let productSlug = "";
test("ürün: yayına alma kuralı, görselli + varyantlı ürün, beden tablosu, mağazada görünüm", async ({ page }) => {
  await loginAdmin(page);
  // Beden tablosu oluştur
  const chart = `E2E Tablo ${uniq("t").slice(-4)}`;
  await page.goto("/yonetim/beden-tablolari");
  await page.getByRole("button", { name: "Yeni tablo" }).click();
  await page.locator("#chart-name").fill(chart);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("button", { name: new RegExp(chart) })).toBeVisible();

  // Görselsiz ürün yayına alınamaz
  const name = `E2E Ürün ${uniq("u").slice(-4)}`;
  await page.goto("/yonetim/urunler/yeni");
  await page.locator("#name").fill(name);
  await page.locator("#categoryId").selectOption({ index: 1 });
  await page.locator("#basePrice").fill("750");
  await page.locator("#status").selectOption("active");
  await page.locator("#sizeChartId").selectOption({ label: chart });
  // Ölçüler: takım ürün → Üst ve Etek grupları
  await page.getByRole("textbox", { name: "Grup başlığı" }).first().fill("ÜST");
  await page.getByRole("textbox", { name: "ÜST ölçüleri" }).fill("| Beden 1 | Boy 67 (cm) | Göğüs 100 (cm) |\n| Beden 2| Boy 67(cm) | Göğüs 110 (cm) |");
  await expect(async () => {
    await page.getByRole("button", { name: "Grup ekle" }).click();
    await expect(page.getByRole("textbox", { name: "Grup başlığı" })).toHaveCount(2, { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("textbox", { name: "Grup başlığı" }).nth(1).fill("Etek");
  await page.getByRole("textbox", { name: "Etek ölçüleri" }).fill("| Beden 1 | Boy 103 (cm) | BEL 68 (cm) |");
  await addVariant(page, "Siyah", "38", 5);
  await addVariant(page, "Beyaz", "40", 3);
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /Yayına almak için en az 1 görsel/ })).toBeVisible();

  // Görsel ekleyip tekrar kaydet: önce taslak, sonra görsel yüklenir, sonra yayına alınır
  await page.locator('input[type="file"]').first().setInputFiles({ name: "urun.png", mimeType: "image/png", buffer: await testPng() });
  await expect(page.getByText("KAPAK", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.waitForURL(/\/yonetim\/urunler\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.getByText(/Görseller \(1\/12\)/)).toBeVisible();
  productSlug = await page.locator("#slug").inputValue();

  // Mağaza
  await page.goto(`/urun/${productSlug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect(page.getByText("₺750,00").first()).toBeVisible();
  const img = page.locator("main img").first();
  await expect(img).toBeVisible();
  expect(await img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  // Ölçüler: her grup kendi ara başlığı ve tablosuyla
  await page.locator("details").filter({ has: page.locator("summary", { hasText: "Ölçüler" }) }).evaluate((d: HTMLDetailsElement) => (d.open = true));
  const ust = page.getByRole("region", { name: "Üst" });
  await expect(ust.getByRole("heading", { name: "Üst" })).toBeVisible();
  await expect(ust.getByRole("columnheader", { name: "Göğüs" })).toBeVisible();
  await expect(ust.getByRole("cell", { name: "110 cm" })).toBeVisible();
  const etek = page.getByRole("region", { name: "Etek" });
  await expect(etek.getByRole("columnheader", { name: "Bel" })).toBeVisible();
  await expect(etek.getByRole("cell", { name: "68 cm" })).toBeVisible();
  await page.getByRole("button", { name: "Beden tablosu" }).click();
  await expect(page.getByRole("heading", { name: chart })).toBeVisible();
  await expect(page.locator("table").first()).toBeVisible();
});

test("ürün listesi: filtreler ve kısayollar (taslağa al, arşivle, kopyala)", async ({ page }) => {
  test.skip(!productSlug, "önceki test ürün oluşturamadı");
  await loginAdmin(page);
  page.on("dialog", (d) => d.accept());
  await page.goto("/yonetim/urunler?q=E2E");
  const row = page.locator("tr").filter({ has: page.locator(`a[href^="/yonetim/urunler/"]`) }).filter({ hasText: "E2E Ürün" }).first();
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: /taslağa al/ }).click();
  await expect(row.getByText(/taslağa alındı/)).toBeVisible();
  expect((await page.request.get(`/urun/${productSlug}`)).status()).toBe(404);

  await page.goto("/yonetim/urunler?durum=taslak&q=E2E");
  await expect(page.locator("tbody tr").filter({ hasText: "E2E Ürün" }).first()).toBeVisible();
  await page.goto("/yonetim/urunler?stok=gorselsiz&q=E2E");
  await expect(page.locator("tbody").getByText(/E2E Ürün/)).toHaveCount(0); // bu ürünün görseli var

  await page.goto("/yonetim/urunler?q=E2E");
  const r2 = page.locator("tbody tr").filter({ hasText: "E2E Ürün" }).first();
  await r2.getByRole("button", { name: /kopyala/ }).click();
  await page.waitForURL(/\/yonetim\/urunler\/[0-9a-f-]{36}$/);
  await expect(page.locator("#name")).toHaveValue(/\(kopya\)/);
  const copyId = page.url().split("/").pop()!;
  const copyLink = `a[href="/yonetim/urunler/${copyId}"]`;

  // Arşivlenen satır varsayılan listeden düşebilir; satırı kimliğiyle bulup sonucu arşiv filtresinde doğrularız
  await page.goto("/yonetim/urunler?q=kopya");
  const copy = page.locator("tbody tr").filter({ has: page.locator(copyLink) });
  await copy.getByRole("button", { name: /arşivle/ }).click();
  await expect.poll(async () => {
    await page.goto("/yonetim/urunler?durum=arsiv&q=kopya");
    return page.locator(`tbody ${copyLink}`).count();
  }).toBeGreaterThan(0);
});

test("sipariş akışı: havale onayı → hazırlanıyor → kargoya verildi → teslim edildi", async ({ page }) => {
  // Müşteri gibi havale siparişi ver
  const email = `${uniq("akis")}@example.com`;
  await addToCart(page, "vizon-uzun-tunik", { size: "38" });
  await page.goto("/odeme");
  await fillCheckout(page, { email, method: "transfer" });
  await page.getByRole("button", { name: /Siparişi tamamla/ }).click();
  await expect(page.getByRole("heading", { name: /ödemenizi bekliyoruz/ })).toBeVisible();
  const orderNo = (await page.locator("main").innerText()).match(/AA-\d{4}-[A-Z0-9]{6}/)![0];

  await loginAdmin(page);
  await page.goto(`/yonetim/siparisler?q=${orderNo}`);
  await page.getByText(orderNo).first().click();
  await expect(page.getByRole("heading", { name: `Sipariş ${orderNo}` })).toBeVisible();

  await page.getByRole("button", { name: "Havale ödemesi alındı" }).click();
  await expect(page.getByText(/Ödeme onaylandı/).first()).toBeVisible();
  await page.getByRole("button", { name: "Hazırlanıyor" }).click();
  await expect(page.getByText(/Durum güncellendi/).first()).toBeVisible();
  await page.getByPlaceholder("Takip numarası").fill("E2E123456789");
  await page.getByRole("button", { name: "Kaydet ve kargoya verildi yap" }).click();
  await expect(page.getByText(/Takip no: E2E123456789/)).toBeVisible();
  await page.getByRole("button", { name: "Teslim edildi" }).click();
  await expect(page.getByText(/Durum güncellendi/).first()).toBeVisible();

  // E-posta önizlemesi bu siparişle açılır
  await page.goto("/yonetim/e-postalar");
  await expect(page.getByRole("heading", { name: "E-postalar" })).toBeVisible();
  await expect(page.locator("iframe")).toBeVisible();
});

test("kupon oluştur → sepette uygulanır; geçersiz yüzde reddedilir", async ({ page }) => {
  await loginAdmin(page);
  const code = `E2E${Date.now().toString().slice(-5)}`;
  await page.goto("/yonetim/kuponlar");
  await page.getByRole("textbox", { name: "Kod" }).fill(code);
  await page.getByRole("textbox", { name: "Yüzde" }).fill("150");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Yüzde 100'den büyük olamaz")).toBeVisible();
  await page.getByRole("textbox", { name: "Yüzde" }).fill("20");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Kupon kaydedildi")).toBeVisible();

  await addToCart(page, "vizon-uzun-tunik", { size: "40" });
  await page.goto("/sepet");
  await page.getByPlaceholder("Kupon kodu").fill(code.toLowerCase());
  await page.getByPlaceholder("Kupon kodu").press("Enter");
  await expect(page.getByText(`"${code}" kuponu uygulandı.`)).toBeVisible();
  await expect(page.getByText("-₺199,80")).toBeVisible();
});

test("tutar kuponu: min. sepet kupon tutarının en az 1,5 katı olmalı", async ({ page }) => {
  await loginAdmin(page);
  const code = `SBT${Date.now().toString().slice(-5)}`;
  await page.goto("/yonetim/kuponlar");
  await page.getByRole("textbox", { name: "Kod" }).fill(code);
  await page.getByLabel("Tür").selectOption("fixed");
  await page.getByRole("textbox", { name: "Tutar (TL)" }).fill("800");
  await expect(page.getByText("En az 1200 TL")).toBeVisible();
  await page.getByRole("textbox", { name: "Min. sepet (TL)" }).fill("1000");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText(/min\. sepet en az 1200 TL olmalı/)).toBeVisible();
  // Boş bırakılınca en düşük geçerli değer (1200 TL) kullanılır
  await page.getByRole("textbox", { name: "Min. sepet (TL)" }).fill("");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Kupon kaydedildi")).toBeVisible();

  // 999 TL'lik sepette kullanılamaz
  await addToCart(page, "vizon-uzun-tunik", { size: "40" });
  await page.goto("/sepet");
  await page.getByPlaceholder("Kupon kodu").fill(code);
  await page.getByPlaceholder("Kupon kodu").press("Enter");
  await expect(page.getByText("Bu kupon 1200 TL ve üzeri sepetlerde geçerli")).toBeVisible();
});

test("ayarlar: kargo ücreti değişince sepete yansır, hatalı IBAN reddedilir", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/yonetim/ayarlar");
  const fee = page.getByRole("textbox", { name: "Kargo ücreti (TL)" });
  const original = await fee.inputValue();
  await page.getByRole("textbox", { name: "IBAN" }).fill("TR12 3456");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText(/IBAN TR ile başlayan/)).toBeVisible();
  await page.reload();
  await fee.fill("99.9");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Ayarlar kaydedildi")).toBeVisible();

  await addToCart(page, "vizon-uzun-tunik", { size: "42" });
  await page.goto("/sepet");
  await expect(page.locator("main dl").getByText("₺99,90")).toBeVisible();

  await page.goto("/yonetim/ayarlar");
  await fee.fill(original);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Ayarlar kaydedildi")).toBeVisible();
});
