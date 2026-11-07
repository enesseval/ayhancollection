import { test, expect, addToCart, fillCheckout, login, loginAdmin, testPng, uniq, ADMIN } from "../../tests/fixtures/test";
import type { Browser, Page } from "@playwright/test";

// QA Aşama C — yalnız yerel demo sunucusu (http://localhost:3200). Her test bulguyu konsola yazar.
test.describe.configure({ mode: "serial" });
const SHOT = (n: string) => `qa-artifacts/screenshots/${n}.png`;
const CUSTOMER = { email: "musteri@ayseayhan.demo", password: ADMIN.password };
const log = (...a: unknown[]) => console.log("[QA]", ...a);

async function addVariant(page: Page, color: string, size: string, stock: number) {
  await page.getByRole("button", { name: "Varyant ekle" }).click();
  const row = page.locator("#varyantlar tbody tr").last();
  await row.getByLabel("Renk", { exact: true }).selectOption(color);
  await row.getByLabel("Beden", { exact: true }).selectOption(size);
  await row.getByLabel("Stok", { exact: true }).fill(String(stock));
}

/** Tek varyantlı (Siyah/38) yayında test ürünü oluşturur, slug döner */
async function createProduct(page: Page, stock: number, label: string): Promise<{ slug: string; id: string }> {
  await loginAdmin(page);
  await page.goto("/yonetim/urunler/yeni");
  await page.locator("#name").fill(`QA ${label} ${uniq("p").slice(-4)}`);
  await page.locator("#categoryId").selectOption({ index: 1 });
  await page.locator("#basePrice").fill("500");
  await addVariant(page, "Siyah", "38", stock);
  await page.locator('input[type="file"]').first().setInputFiles({ name: "u.png", mimeType: "image/png", buffer: await testPng() });
  await expect(page.getByText("KAPAK", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.waitForURL(/\/yonetim\/urunler\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await page.locator("#status").selectOption("active");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /kaydedildi/ }).first()).toBeVisible();
  const slug = await page.locator("#slug").inputValue();
  const id = page.url().split("/").pop()!;
  return { slug, id };
}

async function placeOrder(page: Page, slug: string, method: "card" | "transfer", email = `${uniq("qa")}@example.com`) {
  await addToCart(page, slug, { size: "38" });
  await page.goto("/odeme");
  await fillCheckout(page, { email, method });
  await page.getByRole("button", { name: /Siparişi tamamla|Ödemeye geç/ }).click();
}

async function newCtxPage(browser: Browser, ip: string) {
  const ctx = await browser.newContext({ baseURL: "http://localhost:3200", locale: "tr-TR", extraHTTPHeaders: { "x-forwarded-for": ip } });
  const p = await ctx.newPage();
  await p.addInitScript(() => localStorage.setItem("aac-consent-v1", JSON.stringify({ analytics: false, marketing: false, at: new Date().toISOString() })));
  return p;
}

// ---------------------------------------------------------------- Yetki
test("C1 müşteri oturumuyla /yonetim/* ve upload API", async ({ page }) => {
  await login(page, CUSTOMER.email, CUSTOMER.password);
  const paths = ["/yonetim", "/yonetim/siparisler", "/yonetim/urunler", "/yonetim/urunler/yeni", "/yonetim/kategoriler", "/yonetim/beden-tablolari", "/yonetim/kuponlar", "/yonetim/ayarlar", "/yonetim/e-postalar", "/yonetim/siparisler/00000000-0000-4000-a000-000000000001"];
  for (const p of paths) {
    const r = await page.goto(p);
    const txt = (await page.locator("main").innerText().catch(() => "")).slice(0, 80).replace(/\s+/g, " ");
    log("C1", p, "→", r?.status(), new URL(page.url()).pathname, "|", txt);
    expect(new URL(page.url()).pathname.startsWith("/yonetim") && /Pano|Ürünler|Siparişler|Ayarlar/.test(txt) && r?.status() === 200).toBeFalsy();
  }
  await page.screenshot({ path: SHOT("C1-customer-yonetim") });
  const up = await page.request.post("/api/admin/upload", {
    headers: { origin: "http://localhost:3200" },
    multipart: { productId: "00000000-0000-4000-a000-000000000000", file: { name: "x.png", mimeType: "image/png", buffer: await testPng() } },
  });
  log("C1 upload (müşteri, aynı origin):", up.status(), await up.text());
  expect(up.status()).toBe(403);
});

// Admin Server Action'larını yakalayıp başka oturumla yeniden oynatma
let settingsAction: { id: string; body: string; ct: string } | null = null;
let statusAction: { id: string; ct: string; url: string } | null = null;
test("C2 admin Server Action (saveSettings) müşteri/anonim oturumla yeniden oynatılamaz", async ({ page, browser }) => {
  await loginAdmin(page);
  await page.goto("/yonetim/ayarlar");
  page.on("request", (r) => {
    const h = r.headers();
    if (r.method() === "POST" && h["next-action"] && !settingsAction) settingsAction = { id: h["next-action"], body: r.postData() ?? "", ct: h["content-type"] ?? "" };
  });
  await page.getByRole("button", { name: /Kaydet/ }).first().click();
  await expect.poll(() => !!settingsAction).toBeTruthy();
  log("C2 yakalanan action", settingsAction!.id, settingsAction!.body.slice(0, 160));
  for (const who of ["anon", "customer"] as const) {
    const p = await newCtxPage(browser, "10.9.9." + (who === "anon" ? 1 : 2));
    if (who === "customer") await login(p, CUSTOMER.email, CUSTOMER.password);
    const tampered = settingsAction!.body.replace(/"announcement":"[^"]*"/, '"announcement":"QA-HACKED"');
    const r = await p.request.post("/yonetim/ayarlar", {
      headers: { "next-action": settingsAction!.id, "content-type": settingsAction!.ct, accept: "text/x-component", origin: "http://localhost:3200" },
      data: tampered,
    });
    const t = await r.text();
    log("C2", who, r.status(), t.slice(0, 200).replace(/\n/g, " "));
    await p.context().close();
  }
  const home = await page.request.get("/");
  expect(await home.text()).not.toContain("QA-HACKED");
});

// ---------------------------------------------------------------- Sipariş gizliliği
test("C3 başka siparişin sonuç sayfası (imzasız / değiştirilmiş / başka siparişin t'si)", async ({ page, browser }) => {
  await placeOrder(page, "vizon-uzun-tunik", "transfer");
  await expect(page.getByRole("heading", { name: /ödemenizi bekliyoruz/ })).toBeVisible();
  const u1 = new URL(page.url());
  await page.context().clearCookies();
  await placeOrder(page, "vizon-uzun-tunik", "transfer");
  await expect(page.getByRole("heading", { name: /ödemenizi bekliyoruz/ })).toBeVisible();
  const u2 = new URL(page.url());
  const no1 = u1.searchParams.get("no")!, t1 = u1.searchParams.get("t")!, t2 = u2.searchParams.get("t")!;
  const other = await newCtxPage(browser, "10.9.9.3");
  await login(other, CUSTOMER.email, CUSTOMER.password);
  const cases: [string, string][] = [
    ["imzasız (müşteri oturumu)", `/odeme/sonuc?no=${no1}`],
    ["t değiştirilmiş (son karakter)", `/odeme/sonuc?no=${no1}&t=${t1.slice(0, -1)}${t1.endsWith("A") ? "B" : "A"}`],
    ["t kısaltılmış", `/odeme/sonuc?no=${no1}&t=${t1.slice(0, 10)}`],
    ["başka siparişin t'si", `/odeme/sonuc?no=${no1}&t=${t2}`],
    ["t dizi (t[]=)", `/odeme/sonuc?no=${no1}&t=${t1}&t=x`],
    ["no küçük harf + doğru t", `/odeme/sonuc?no=${no1.toLowerCase()}&t=${t1}`],
    ["demo ödeme başka sipariş", `/odeme/demo?o=00000000-0000-4000-a000-000000000001&t=${t1}`],
  ];
  for (const [n, url] of cases) {
    const r = await other.goto(url);
    log("C3", n, "→", r?.status());
    if (!n.includes("küçük") && !n.includes("dizi")) expect(r?.status()).toBe(404);
  }
  await other.goto(`/odeme/sonuc?no=${no1}`);
  await other.screenshot({ path: SHOT("C3-idor-404") });
  await other.context().close();
});

// ---------------------------------------------------------------- Sepet manipülasyonu
test("C4 localStorage sepet: fiyat / adet / stok manipülasyonu", async ({ page }) => {
  await addToCart(page, "vizon-uzun-tunik", { size: "38" });
  const orig = await page.evaluate(() => JSON.parse(localStorage.getItem("aac-cart-v1")!));
  const item = orig.state.items[0];
  log("C4 orijinal kalem", JSON.stringify(item));
  const variants: [string, Record<string, unknown>][] = [
    ["unitPrice=1", { unitPrice: 1 }],
    ["qty=999 maxQty=999", { qty: 999, maxQty: 999 }],
    ["qty=-3", { qty: -3 }],
    ["qty=2.5", { qty: 2.5 }],
    ["qty='5' (string)", { qty: "5" }],
    ["variantId sahte", { variantId: "00000000-0000-4000-a000-0000000000ff" }],
  ];
  for (const [n, patch] of variants) {
    await page.evaluate(([o, p]) => {
      const c = structuredClone(o);
      c.state.items = [{ ...c.state.items[0], ...p }];
      localStorage.setItem("aac-cart-v1", JSON.stringify(c));
    }, [orig, patch] as const);
    await page.goto("/sepet");
    await page.waitForTimeout(1500);
    const main = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const totals = main.match(/(Ara toplam|Toplam)[^₺]*₺[\d.,]+/g);
    const stored = await page.evaluate(() => localStorage.getItem("aac-cart-v1"));
    log("C4", n, "| sepet:", totals?.join(" ; "), "| boş mu:", /Sepetiniz boş/.test(main), "| kayıt:", stored?.slice(0, 160));
    await page.screenshot({ path: SHOT(`C4-cart-${n.replace(/[^a-z0-9]+/gi, "_")}`) });
  }
  // Manipüle fiyatla sipariş → sunucu gerçek fiyatı uygulamalı
  await page.evaluate((o) => {
    const c = structuredClone(o);
    c.state.items[0].unitPrice = 1;
    localStorage.setItem("aac-cart-v1", JSON.stringify(c));
  }, orig);
  await page.goto("/odeme");
  await fillCheckout(page, { email: `${uniq("c4")}@example.com`, method: "transfer" });
  await page.getByRole("button", { name: /Siparişi tamamla|Ödemeye geç/ }).click();
  await expect(page.getByRole("heading", { name: /ödemenizi bekliyoruz/ })).toBeVisible();
  log("C4 sipariş toplamı:", (await page.locator("main").innerText()).match(/₺[\d.,]+/)?.[0], "(orijinal birim fiyat:", item.unitPrice, ")");
});

// ---------------------------------------------------------------- Açık yönlendirme
test("C5 next parametresiyle açık yönlendirme", async ({ page }) => {
  const nexts = ["https://evil.example", "//evil.example", "/\\evil.example", "/\t/evil.example", "/\n/evil.example", "/%2F/evil.example", "\\\\evil.example", "/ /evil.example", "javascript:alert(1)", "/hesabim?x=1#//evil.example"];
  const res: string[] = [];
  for (const n of nexts) {
    await page.context().clearCookies();
    await page.goto(`/hesabim?next=${encodeURIComponent(n)}`);
    const form = page.locator("form").filter({ has: page.locator('input[type="password"]') }).first();
    await form.locator('input[type="email"]').fill(CUSTOMER.email);
    await form.locator('input[type="password"]').fill(CUSTOMER.password);
    await form.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForTimeout(2500);
    res.push(`${JSON.stringify(n)} → ${page.url()}`);
    log("C5", JSON.stringify(n), "→", page.url());
    if (!page.url().startsWith("http://localhost:3200")) await page.screenshot({ path: SHOT("C5-open-redirect") });
  }
  expect(res.filter((r) => /evil\.example\/?$|→ https?:\/\/evil/.test(r) && !r.includes("localhost:3200"))).toEqual([]);
});

// ---------------------------------------------------------------- XSS
test("C6 XSS: ödeme alanları → yönetim sipariş detayı, duyuru şeridi, kategori, beden tablosu", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", async (d) => { dialogs.push(d.message()); await d.dismiss(); });
  const P = `<img src=x onerror=alert('xss')><script>alert('s')</script>"'><svg onload=alert(1)>`;
  await addToCart(page, "vizon-uzun-tunik", { size: "38" });
  await page.goto("/odeme");
  await fillCheckout(page, { email: `${uniq("xss")}@example.com`, method: "transfer" });
  await page.getByLabel("Ad soyad").fill("Ali " + P.slice(0, 60));
  await page.getByLabel("İlçe").fill(P.slice(0, 55));
  await page.getByPlaceholder("Mahalle, cadde/sokak, bina ve daire no").fill("Mah. " + P);
  const note = page.locator('#note');
  if (await note.count()) await note.fill(P);
  await page.getByRole("button", { name: /Siparişi tamamla|Ödemeye geç/ }).click();
  await expect(page.getByRole("heading", { name: /ödemenizi bekliyoruz/ })).toBeVisible();
  const orderNo = (await page.locator("main").innerText()).match(/AA-\d{4}-[A-Z0-9]{6}/)![0];
  await loginAdmin(page);
  await page.goto(`/yonetim/siparisler?q=${orderNo}`);
  await page.getByText(orderNo).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: SHOT("C6-xss-admin-order"), fullPage: true });
  await page.goto("/yonetim/e-postalar");
  await page.waitForTimeout(800);
  // Duyuru
  await page.goto("/yonetim/ayarlar");
  const ann = page.locator('[name="announcement"], #announcement').first();
  if (await ann.count()) {
    await ann.fill(P.slice(0, 150));
    await page.getByRole("button", { name: /Kaydet/ }).first().click();
    await page.waitForTimeout(800);
    await page.goto("/");
    await page.waitForTimeout(800);
    await page.screenshot({ path: SHOT("C6-xss-announcement") });
    await page.goto("/yonetim/ayarlar");
    await ann.fill("");
    await page.getByRole("button", { name: /Kaydet/ }).first().click();
  }
  log("C6 tetiklenen diyaloglar:", JSON.stringify(dialogs));
  expect(dialogs).toEqual([]);
});

// ---------------------------------------------------------------- Hesap kilidi
test("C7 hesap kilidi: 5 hatalı deneme, doğru şifre, IP değiştirme", async ({ browser }) => {
  const victim = `${uniq("lock")}@example.com`;
  // kullanıcı oluştur
  const reg = await newCtxPage(browser, "10.7.0.1");
  await reg.goto("/hesabim");
  await reg.getByRole("tab", { name: "Üye ol" }).click();
  const f = reg.locator("form").filter({ has: reg.locator('input[name="fullName"]') });
  await f.locator('[name="fullName"]').fill("Kilit Test");
  await f.locator('[name="email"]').fill(victim);
  await f.locator('[name="password"]').fill("DogruSifre-2026");
  await f.locator('[name="acceptKvkk"]').check();
  await f.getByRole("button", { name: "Üye ol" }).click();
  await expect(reg.getByText("Siparişlerim")).toBeVisible();
  await reg.context().close();

  const att = await newCtxPage(browser, "10.7.0.2");
  const msgs: string[] = [];
  for (let i = 1; i <= 6; i++) {
    await login(att, victim, `yanlis-${i}`);
    msgs.push(`${i}: ${(await att.locator('[role="alert"]:not(#__next-route-announcer__)').first().innerText()).trim()}`);
  }
  await att.screenshot({ path: SHOT("C7-lockout") });
  await login(att, victim, "DogruSifre-2026");
  msgs.push(`doğru şifre (aynı IP): ${(await att.locator('[role="alert"]:not(#__next-route-announcer__)').first().innerText({ timeout: 3000 }).catch(() => "GİRİŞ BAŞARILI"))}`);
  await att.context().close();
  const other = await newCtxPage(browser, "10.7.0.99");
  await login(other, victim, "DogruSifre-2026");
  msgs.push(`doğru şifre (farklı X-Forwarded-For): ${(await other.locator('[role="alert"]:not(#__next-route-announcer__)').first().innerText({ timeout: 3000 }).catch(() => "GİRİŞ BAŞARILI"))}`);
  await other.context().close();
  log("C7", msgs.join("\n     "));

  // IP katmanı ve dakikalık login limiti: X-Forwarded-For her istekte değişirse sayaç sıfırlanıyor mu?
  let lockedIp = 0;
  for (let i = 0; i < 25; i++) {
    const p = await newCtxPage(browser, `10.8.${i}.1`); // her deneme farklı sahte IP
    await login(p, `${uniq("spray")}@example.com`, "x");
    const t = await p.locator('[role="alert"]:not(#__next-route-announcer__)').first().innerText();
    if (/Çok fazla/.test(t)) lockedIp++;
    await p.context().close();
  }
  log("C7 25 farklı sahte IP ile 25 hatalı deneme → engellenen:", lockedIp);
  const same = await newCtxPage(browser, "10.6.6.6");
  let sameBlocked = 0;
  for (let i = 0; i < 12; i++) {
    await login(same, `${uniq("spray2")}@example.com`, "x");
    if (/Çok fazla/.test(await same.locator('[role="alert"]:not(#__next-route-announcer__)').first().innerText())) sameBlocked++;
  }
  log("C7 aynı IP ile 12 hatalı deneme (farklı e-postalar) → engellenen:", sameBlocked);
  await same.context().close();
});

// ---------------------------------------------------------------- Stok yarışı
let raceProduct = { slug: "", id: "" };
test("C8 son ürünü iki sekmeden aynı anda satın alma", async ({ page, browser }) => {
  raceProduct = await createProduct(page, 1, "Yaris");
  log("C8 ürün", raceProduct.slug);
  const a = await newCtxPage(browser, "10.5.0.1");
  const b = await newCtxPage(browser, "10.5.0.2");
  for (const p of [a, b]) {
    await addToCart(p, raceProduct.slug, { size: "38" });
    await p.goto("/odeme");
    await fillCheckout(p, { email: `${uniq("race")}@example.com`, method: "card" });
  }
  await Promise.all([a, b].map((p) => p.getByRole("button", { name: /Siparişi tamamla|Ödemeye geç/ }).click()));
  await Promise.all([a, b].map((p) => p.waitForTimeout(3000)));
  const out = [];
  for (const [n, p] of [["A", a], ["B", b]] as const) {
    const alert = await p.locator('[role="alert"]:not(#__next-route-announcer__)').first().innerText({ timeout: 3000 }).catch(() => "");
    out.push(`${n}: ${p.url().replace("http://localhost:3200", "")} ${alert}`);
    await p.screenshot({ path: SHOT(`C8-race-${n}`), timeout: 5000 }).catch(() => {});
  }
  log("C8", out.join(" || "));
  expect(out.filter((o) => o.includes("/odeme/demo")).length).toBe(1);
  await a.context().close();
  await b.context().close();
});

// ---------------------------------------------------------------- İş mantığı: durum geçişleri / stok iadesi
test("C9 ödenmiş sipariş iptal edilince stok geri dönüyor mu? + sunucu tarafı durum geçiş kuralı", async ({ page, browser }) => {
  const prod = await createProduct(page, 1, "Iptal");
  const cust = await newCtxPage(browser, "10.4.0.1");
  await placeOrder(cust, prod.slug, "card");
  await cust.waitForURL(/\/odeme\/demo/);
  await cust.getByRole("button", { name: /Ödemeyi onayla/ }).click();
  await cust.waitForURL(/\/odeme\/sonuc/);
  const orderNo = (await cust.locator("main").innerText()).match(/AA-\d{4}-[A-Z0-9]{6}/)![0];
  const disabledBefore = await (await cust.goto(`/urun/${prod.slug}`), cust.getByRole("radiogroup", { name: "Beden" }).getByRole("radio").first().isDisabled());
  log("C9 ödeme sonrası 38 bedeni devre dışı mı:", disabledBefore);

  // Admin: iptal et (arayüzde paid → cancelled izinli)
  page.on("dialog", (d) => d.accept());
  page.on("request", (r) => {
    const h = r.headers();
    if (r.method() === "POST" && h["next-action"] && /siparisler\//.test(r.url()) && (r.postData() ?? "").includes("cancelled") && !statusAction)
      statusAction = { id: h["next-action"], ct: h["content-type"] ?? "", url: r.url() };
  });
  await page.goto(`/yonetim/siparisler?q=${orderNo}`);
  await page.getByText(orderNo).first().click();
  await page.getByRole("button", { name: "İptal edildi" }).click();
  await expect(page.getByText(/Durum güncellendi/).first()).toBeVisible();
  await page.screenshot({ path: SHOT("C9-paid-cancelled") });
  await cust.goto(`/urun/${prod.slug}`);
  const disabledAfter = await cust.getByRole("radiogroup", { name: "Beden" }).getByRole("radio").first().isDisabled();
  log("C9 iptal sonrası 38 bedeni hâlâ devre dışı mı (stok iade edilmedi mi):", disabledAfter);
  await cust.screenshot({ path: SHOT("C9-stock-after-cancel") });

  // Sunucu tarafı geçiş kuralı: arayüzde olmayan cancelled → delivered geçişini doğrudan action ile dene
  if (statusAction) {
    const orderId = statusAction.url.split("/").pop()!;
    const r = await page.request.post(statusAction.url, {
      headers: { "next-action": statusAction.id, "content-type": statusAction.ct, accept: "text/x-component", origin: "http://localhost:3200" },
      data: JSON.stringify([orderId, "paid"]),
    });
    log("C9 cancelled → paid doğrudan action:", r.status(), (await r.text()).slice(-160).replace(/\n/g, " "));
    await page.reload();
    const status = (await page.locator("body").innerText()).match(/Ödendi|İptal edildi|Hazırlanıyor/g)?.join(",");
    log("C9 sipariş sayfasındaki durum:", status);
    await page.screenshot({ path: SHOT("C9-cancelled-to-paid") });
  }
  await cust.context().close();
});

// ---------------------------------------------------------------- Kupon kullanım limiti yarışı
test("C10 kullanım limiti 1 olan kupon iki eşzamanlı siparişte", async ({ page, browser }) => {
  await loginAdmin(page);
  const code = `QA${Date.now().toString().slice(-6)}`;
  await page.goto("/yonetim/kuponlar");
  await page.locator('[name="code"], #code').first().fill(code);
  await page.locator('[name="value"], #value').first().fill("10");
  const lim = page.locator('[name="usageLimit"], #usageLimit').first();
  await lim.fill("1");
  await page.getByRole("button", { name: /Kaydet/ }).first().click();
  await expect(page.getByText(/Kupon kaydedildi/)).toBeVisible();
  const ps = [await newCtxPage(browser, "10.3.0.1"), await newCtxPage(browser, "10.3.0.2")];
  for (const p of ps) {
    await addToCart(p, "vizon-uzun-tunik", { size: "38" });
    await p.evaluate((c) => { const s = JSON.parse(localStorage.getItem("aac-cart-v1")!); s.state.coupon = c; localStorage.setItem("aac-cart-v1", JSON.stringify(s)); }, code);
    await p.goto("/odeme");
    await fillCheckout(p, { email: `${uniq("cpn")}@example.com`, method: "transfer" });
  }
  await Promise.all(ps.map((p) => p.getByRole("button", { name: /Siparişi tamamla|Ödemeye geç/ }).click()));
  await Promise.all(ps.map((p) => p.waitForTimeout(3000)));
  const res = [];
  for (const p of ps) {
    const m = await p.locator("main").innerText();
    res.push(`${p.url().includes("/odeme/sonuc") ? "SİPARİŞ OLUŞTU" : "RED"} ${/İndirim[^\n]*/.exec(m)?.[0] ?? ""} ${await p.locator('[role="alert"]:not(#__next-route-announcer__)').first().innerText({ timeout: 3000 }).catch(() => "")}`);
  }
  log("C10", res.join(" || "));
  await page.goto("/yonetim/kuponlar");
  log("C10 kupon satırı:", (await page.locator("tr", { hasText: code }).first().innerText({ timeout: 3000 }).catch(() => "?")).replace(/\s+/g, " "));
  await page.screenshot({ path: SHOT("C10-coupon-race") });
  for (const p of ps) await p.context().close();
});
