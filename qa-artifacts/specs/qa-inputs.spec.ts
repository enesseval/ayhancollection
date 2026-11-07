import { test, expect, addToCart, fillCheckout, loginAdmin, uniq } from "../../tests/fixtures/test";

// QA Aşama B — hatalı girdiler, uç değerler, yönetim formları. Yalnız http://localhost:3200.
test.describe.configure({ mode: "serial" });
const SHOT = (n: string) => `qa-artifacts/screenshots/${n}.png`;
const log = (...a: unknown[]) => console.log("[QA]", ...a);
const LONG = "Ç".repeat(2100);
const EMOJI = "👗🧕✨ Ayşe 😀";
const SCRIPT = "<script>alert(1)</script>";
const SQLI = "' OR 1=1 --";

test("B1 arama: uzun metin, emoji, script, SQLi", async ({ page }) => {
  page.on("dialog", (d) => { log("B1 DIALOG!", d.message()); d.dismiss(); });
  for (const q of [LONG, EMOJI, SCRIPT, SQLI, "%", "_", "\\", "a".repeat(10000)]) {
    const r = await page.goto(`/arama?q=${encodeURIComponent(q)}`);
    const t = (await page.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 120);
    log("B1", JSON.stringify(q.slice(0, 20)), q.length, "→", r?.status(), "|", t);
  }
  await page.goto(`/arama?q=${encodeURIComponent(SQLI)}`);
  await page.screenshot({ path: SHOT("B1-search-sqli") });
});

test("B2 üyelik formu: boş, uzun, emoji, script, geçersiz e-posta", async ({ page }) => {
  const cases = [
    { fullName: "", email: "", password: "" },
    { fullName: LONG, email: `${uniq("b2")}@example.com`, password: "GecerliSifre-2026" },
    { fullName: EMOJI, email: `${uniq("b2e")}@example.com`, password: "GecerliSifre-2026" },
    { fullName: SCRIPT, email: `${uniq("b2s")}@example.com`, password: "GecerliSifre-2026" },
    { fullName: "Test Kişi", email: "gecersiz@", password: "GecerliSifre-2026" },
    { fullName: "Test Kişi", email: SQLI, password: "GecerliSifre-2026" },
    { fullName: "Test Kişi", email: `${uniq("b2p")}@example.com`, password: "a".repeat(201) },
    { fullName: "   ", email: `${uniq("b2w")}@example.com`, password: "GecerliSifre-2026" },
  ];
  for (const c of cases) {
    await page.context().clearCookies();
    await page.goto("/hesabim");
    await page.getByRole("tab", { name: "Üye ol" }).click();
    const f = page.locator("form").filter({ has: page.locator('input[name="fullName"]') });
    // Tarayıcı doğrulamasını atlayarak sunucu davranışını gör
    await f.evaluate((el: HTMLFormElement) => (el.noValidate = true));
    await f.locator('[name="fullName"]').fill(c.fullName);
    await f.locator('[name="email"]').evaluate((el: HTMLInputElement, v) => { el.type = "text"; el.value = v; }, c.email);
    await f.locator('[name="password"]').fill(c.password);
    await f.locator('[name="acceptKvkk"]').check();
    await f.getByRole("button", { name: "Üye ol" }).click();
    await page.waitForTimeout(1200);
    const t = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 200);
    log("B2", JSON.stringify({ n: c.fullName.slice(0, 15), nl: c.fullName.length, e: c.email.slice(0, 30), pl: c.password.length }), "→", t);
    if (c.fullName === EMOJI) await page.screenshot({ path: SHOT("B2-register-emoji") });
    if (c.fullName.length > 2000) await page.screenshot({ path: SHOT("B2-register-long-name") });
  }
});

test("B3 ödeme formu: hatalı telefon / e-posta / posta kodu / uzun adres / emoji / script", async ({ page }) => {
  await addToCart(page, "vizon-uzun-tunik", { size: "38" });
  const bad = [
    ["#phone", "12345"], ["#phone", "0212 111 22 33"], ["#phone", "+90 532 111 22 33"], ["#phone", "05321112233444"],
    ["#email", "a@b"], ["#email", SQLI],
    ["#postalCode", "ABCDE"], ["#line", LONG], ["#fullName", EMOJI], ["#district", SCRIPT], ["#note", LONG],
  ] as const;
  for (const [sel, val] of bad) {
    await page.goto("/odeme");
    await fillCheckout(page, { email: `${uniq("b3")}@example.com`, method: "transfer" });
    await page.locator("form").first().evaluate((el: HTMLFormElement) => (el.noValidate = true));
    await page.locator(sel).evaluate((el: HTMLInputElement, v) => { if (el.type === "email") el.type = "text"; el.removeAttribute("maxlength"); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, val);
    await page.getByRole("button", { name: /Siparişi tamamla/ }).click();
    await page.waitForTimeout(1500);
    const url = page.url().replace("http://localhost:3200", "");
    const err = await page.locator('[role="alert"]:not(#__next-route-announcer__), .text-danger').allInnerTexts().catch(() => []);
    log("B3", sel, JSON.stringify(val.slice(0, 25)), val.length, "→", url.split("&t=")[0], "|", err.join(" / ").slice(0, 200));
    if (sel === "#phone" && val === "12345") await page.screenshot({ path: SHOT("B3-checkout-bad-phone"), fullPage: true });
    if (url.startsWith("/odeme/sonuc")) {
      // sipariş oluştu: tekrar sepete ekle
      await addToCart(page, "vizon-uzun-tunik", { size: "38" });
    }
  }
});

test("B4 sipariş takibi: SQLi, script, geçersiz biçim, yanlış e-posta", async ({ page }) => {
  for (const [no, email] of [[SQLI, "a@b.com"], ["AA-2611-ABCDEF", SQLI], [SCRIPT, "x@y.com"], ["AA-2611-ZZZZZZ", "yok@example.com"], ["", ""]]) {
    await page.goto("/siparis-takip");
    await page.locator("form").first().evaluate((el: HTMLFormElement) => (el.noValidate = true));
    await page.locator("#orderNo").fill(no);
    await page.locator("#lookup-email").evaluate((el: HTMLInputElement, v) => { el.type = "text"; el.value = v; }, email);
    await page.getByRole("button", { name: /Siparişimi bul/ }).first().click();
    await page.waitForTimeout(1000);
    log("B4", JSON.stringify([no, email]), "→", (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 180));
  }
  await page.screenshot({ path: SHOT("B4-order-lookup") });
});

test("B5 sepet: kupon uç değerleri ve adet", async ({ page }) => {
  await addToCart(page, "vizon-uzun-tunik", { size: "38" });
  await page.goto("/sepet");
  for (const c of ["YOKBOYLE", SQLI, SCRIPT, "a".repeat(40), "hosgeldin10", " HOSGELDIN10 ", "KIS150"]) {
    await page.evaluate(() => { const x = JSON.parse(localStorage.getItem("aac-cart-v1")!); x.state.coupon = ""; localStorage.setItem("aac-cart-v1", JSON.stringify(x)); });
    await page.reload();
    await page.getByPlaceholder(/kupon/i).first().fill(c);
    await page.getByRole("button", { name: "Uygula" }).first().click();
    await page.waitForTimeout(1200);
    const t = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    log("B5 kupon", JSON.stringify(c.slice(0, 20)), "→", (t.match(/(Kupon[^.]{0,80}|İndirim[^₺]*₺[\d.,]+|Toplam ₺[\d.,]+)/g) ?? []).join(" | ").slice(0, 220));
  }
  await page.screenshot({ path: SHOT("B5-cart-coupon") });
  // Adet: artır sınırı (stok / 10)
  const plus = page.getByRole("button", { name: "Artır" }).first();
  for (let i = 0; i < 15; i++) await plus.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(800);
  const qty = await page.locator("main span.w-8").first().innerText().catch(() => "?");
  log("B5 15 kez artır sonrası adet:", qty, "| buton devre dışı:", await plus.isDisabled());
});

test("B6 yönetim: ürün formu uç değerleri (0 TL, negatif stok, ondalık, uzun ad, emoji, XSS)", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await loginAdmin(page);
  const cases: [string, Record<string, string>][] = [
    ["0 TL", { "#basePrice": "0" }],
    ["negatif fiyat", { "#basePrice": "-50" }],
    ["ondalık fiyat 199,99", { "#basePrice": "199,99" }],
    ["ondalık fiyat 199.999", { "#basePrice": "199.999" }],
    ["harf fiyat", { "#basePrice": "abc" }],
    ["uzun ad", { "#name": LONG }],
    ["emoji ad", { "#name": EMOJI }],
    ["script ad", { "#name": SCRIPT }],
    ["üstü çizili < fiyat", { "#basePrice": "500", "#compareAtPrice": "100" }],
  ];
  for (const [n, fields] of cases) {
    await page.goto("/yonetim/urunler/yeni");
    await page.locator("#name").fill(`QA B6 ${uniq("p").slice(-4)}`);
    await page.locator("#categoryId").selectOption({ index: 1 });
    await page.locator("#basePrice").fill("100");
    for (const [s, v] of Object.entries(fields)) await page.locator(s).fill(v).catch((e) => log("B6 doldurulamadı", s, e.message.slice(0, 80)));
    await page.getByRole("button", { name: "Varyant ekle" }).click();
    const row = page.locator("#varyantlar tbody tr").last();
    await row.getByLabel("Renk", { exact: true }).selectOption({ index: 1 });
    await row.getByLabel("Beden", { exact: true }).selectOption({ index: 1 });
    await row.getByLabel("Stok", { exact: true }).fill(n === "0 TL" ? "-5" : "3");
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await page.waitForTimeout(2000);
    const st = await page.getByRole("status").allInnerTexts().catch(() => []);
    const priceVal = await page.locator("#basePrice").inputValue();
    log("B6", n, "→ url:", page.url().replace("http://localhost:3200", ""), "| fiyat alanı:", priceVal, "| durum:", st.join(" / ").slice(0, 200));
    if (n === "0 TL") await page.screenshot({ path: SHOT("B6-product-zero-price"), fullPage: true });
  }
});

test("B7 yönetim: kaydedilmemiş değişiklik uyarısı", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/yonetim/urunler");
  await page.locator('tbody a[href^="/yonetim/urunler/"]').first().click();
  await page.waitForURL(/\/yonetim\/urunler\/[0-9a-f-]{36}$/);
  await page.locator("#name").fill("QA değişti " + Date.now());
  const dialogs: string[] = [];
  page.on("dialog", async (d) => { dialogs.push(`${d.type()}: ${d.message()}`); await d.dismiss(); });
  // 1) uygulama içi bağlantı
  await page.getByRole("link", { name: "Siparişler" }).first().click();
  await page.waitForTimeout(1200);
  const stayed1 = /\/yonetim\/urunler\//.test(page.url());
  // 2) tarayıcı geri tuşu
  await page.goBack().catch(() => {});
  await page.waitForTimeout(1200);
  const stayed2 = /\/yonetim\/urunler\/[0-9a-f-]{36}$/.test(page.url());
  // 3) sayfa yenileme (beforeunload)
  await page.reload({ timeout: 5000 }).catch(() => {});
  log("B7 diyaloglar:", JSON.stringify(dialogs), "| iç bağlantıda kaldı:", stayed1, "| geri tuşunda kaldı:", stayed2, "| url:", page.url());
});

test("B8 yönetim: kupon, kategori, beden tablosu, ayarlar uç değerleri", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/yonetim/kuponlar");
  for (const [code, val, lim] of [["QA0", "10", ""], ["QAPCT" + Date.now().toString().slice(-4), "150", ""], ["QANEG" + Date.now().toString().slice(-4), "-10", ""], ["QADEC" + Date.now().toString().slice(-4), "12,5", ""], ["QA LIM", "10", "0"], [SCRIPT, "10", ""]]) {
    await page.locator("form").first().evaluate((el: HTMLFormElement) => (el.noValidate = true));
    await page.locator("#code").fill(code);
    await page.locator("#value").fill(val);
    await page.locator("#usageLimit").fill(lim);
    await page.getByRole("button", { name: "Kaydet" }).first().click();
    await page.waitForTimeout(1000);
    log("B8 kupon", JSON.stringify([code, val, lim]), "→", (await page.getByRole("status").allInnerTexts().catch(() => [])).join(" / "));
  }
  // Sabit tutar kupon 0 TL'ye düşürüyor mu? (sabit 100000 TL)
  const big = "QABIG" + Date.now().toString().slice(-4);
  await page.locator("#ctype").selectOption("fixed");
  await page.locator("#code").fill(big);
  await page.locator("#value").fill("100000");
  await page.locator("#usageLimit").fill("");
  await page.getByRole("button", { name: "Kaydet" }).first().click();
  await page.waitForTimeout(1000);
  log("B8 sabit kupon kaydı:", (await page.getByRole("status").allInnerTexts().catch(() => [])).join(" / "));
  await addToCart(page, "vizon-uzun-tunik", { size: "38" });
  await page.goto("/sepet");
  await page.getByPlaceholder(/kupon/i).first().fill(big);
  await page.getByRole("button", { name: "Uygula" }).first().click();
  await page.waitForTimeout(1200);
  const t = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  log("B8 sabit 100.000 TL kupon sepette:", (t.match(/(İndirim[^₺]*-?₺[\d.,]+|Kargo[^₺]*₺[\d.,]+|Kargo Ücretsiz|Toplam ₺[\d.,]+)/g) ?? []).join(" | "));
  await page.screenshot({ path: SHOT("B8-fixed-coupon-zero-total") });
  // 0 TL'lik sipariş tamamlanabiliyor mu?
  await page.goto("/odeme");
  await fillCheckout(page, { email: `${uniq("zero")}@example.com`, method: "card" });
  await page.getByRole("button", { name: /Siparişi tamamla|Ödemeye geç/ }).click();
  await page.waitForTimeout(2500);
  log("B8 0 TL sipariş sonucu:", page.url().replace("http://localhost:3200", "").split("&t=")[0], (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 200));
  await page.screenshot({ path: SHOT("B8-zero-total-order") });

  // Ayarlar
  await page.goto("/yonetim/ayarlar");
  await page.locator("form").first().evaluate((el: HTMLFormElement) => (el.noValidate = true));
  for (const [sel, v] of [["#shippingFee", "-5"], ["#freeShippingThreshold", "abc"], ["#whatsapp", "0532"], ["#announcement", LONG]]) {
    const loc = page.locator(sel);
    if (!(await loc.count())) { log("B8 ayar alanı yok", sel); continue; }
    const before = await loc.inputValue();
    await loc.evaluate((el: HTMLInputElement, val) => { el.removeAttribute("maxlength"); el.value = val; }, v);
    await page.getByRole("button", { name: /Kaydet/ }).first().click();
    await page.waitForTimeout(1000);
    log("B8 ayar", sel, JSON.stringify(v.slice(0, 15)), "→", (await page.getByRole("status").allInnerTexts().catch(() => [])).join(" / ").slice(0, 160));
    await loc.evaluate((el: HTMLInputElement, val) => { el.value = val; }, before);
  }
});
