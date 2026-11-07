import { test, expect } from "../fixtures/test";

// Temel gezinme: sayfalar açılıyor mu, demo modunda mıyız, kırık bağlantı / görsel / konsol hatası var mı?

test("demo modunda çalışıyor (canlı veriye dokunulmuyor)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo sürüm:")).toBeVisible();
});

const PAGES = [
  { path: "/", h: /Zarafet/ },
  { path: "/kategori/tesettur-giyim", h: "Tesettür Giyim" },
  { path: "/kategori/yeni", h: "Yeni Gelenler" },
  { path: "/kategori/cok-satanlar", h: "Çok Satanlar" },
  { path: "/kategori/indirim", h: "İndirimli Ürünler" },
  { path: "/urun/vizon-uzun-tunik", h: "Vizon Uzun Tunik" },
  { path: "/arama?q=eşarp", h: /arama|Arama|eşarp/i },
  { path: "/sepet", h: "Sepetim" },
  { path: "/hesabim", h: "Hesabım" },
  { path: "/siparis-takip", h: "Sipariş Takibi" },
  { path: "/mesafeli-satis-sozlesmesi", h: /Mesafeli/ },
  { path: "/kvkk", h: /KVKK|Kişisel/ },
];

for (const p of PAGES) {
  test(`sayfa açılır: ${p.path}`, async ({ page, consoleErrors }) => {
    const res = await page.goto(p.path);
    expect(res?.status(), "HTTP durumu").toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(p.h);
    expect(consoleErrors, "konsol hatası olmamalı").toEqual([]);
  });
}

test("olmayan sayfa ve ürün 404 döner", async ({ page }) => {
  for (const path of ["/yok-boyle-bir-sayfa", "/urun/yok-boyle-bir-urun", "/kategori/yok-boyle-bir-kategori"]) {
    expect((await page.goto(path))?.status()).toBe(404);
    // Sekme başlığı da 404'ü söylemeli (hidrasyondan sonra da)
    await expect(page).toHaveTitle(/Sayfa bulunamadı/);
  }
});

test("ana sayfadaki iç bağlantılar kırık değil", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = await page.$$eval('a[href^="/"]', (as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
  expect(hrefs.length).toBeGreaterThan(10);
  const broken: string[] = [];
  for (const h of hrefs) {
    const r = await request.get(h);
    if (r.status() >= 400) broken.push(`${h} → ${r.status()}`);
  }
  expect(broken).toEqual([]);
});

test("ürün görselleri yükleniyor (kırık görsel yok)", async ({ page }) => {
  await page.goto("/kategori/tesettur-giyim");
  const imgs = page.locator("main img");
  await expect(imgs.first()).toBeVisible();
  // Görünür alandaki görsellerin hepsi gerçekten yüklenmiş olmalı
  await page.waitForLoadState("load");
  await page.waitForFunction(() => [...document.querySelectorAll("main img")].filter((i) => i.getBoundingClientRect().top < innerHeight).every((i) => (i as HTMLImageElement).complete));
  const broken = await page.$$eval("main img", (list: HTMLImageElement[]) =>
    list.filter((i) => i.getBoundingClientRect().top < innerHeight && i.complete && i.naturalWidth === 0).map((i) => i.getAttribute("src")),
  );
  expect(broken).toEqual([]);
});

test("arama ve filtre sonuç verir", async ({ page }) => {
  await page.goto("/arama?q=tunik");
  await expect(page.locator("main article").first()).toBeVisible();
  await page.goto("/kategori/tesettur-giyim?beden=38");
  const count = await page.locator("main article").count();
  expect(count).toBeGreaterThan(0);
});

test("SEO: başlık, açıklama, canonical, ürün yapısal verisi, sitemap ve robots", async ({ page, request }) => {
  await page.goto("/urun/vizon-uzun-tunik");
  await expect(page).toHaveTitle(/Vizon Uzun Tunik/);
  expect(await page.locator('meta[name="description"]').getAttribute("content")).toBeTruthy();
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toContain("/urun/vizon-uzun-tunik");
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((t) => t.includes('"@type":"Product"') && t.includes('"price"'))).toBeTruthy();
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/Disallow: \/yonetim/);
});

test("güvenlik başlıkları mevcut", async ({ request }) => {
  const r = await request.get("/");
  const h = r.headers();
  expect(h["content-security-policy"]).toBeTruthy();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBeTruthy();
});
