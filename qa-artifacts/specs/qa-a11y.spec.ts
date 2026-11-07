import AxeBuilder from "@axe-core/playwright";
import { test, addToCart, loginAdmin } from "../../tests/fixtures/test";
import { writeFileSync } from "node:fs";

// QA Aşama D — axe-core: TÜM etki seviyeleri, masaüstü + mobil, ödeme ve yönetim sayfaları dahil.
const SHOP = ["/", "/kategori/tesettur-giyim", "/urun/vizon-uzun-tunik", "/sepet", "/odeme", "/hesabim", "/siparis-takip", "/arama?q=tunik", "/sss", "/iletisim"];
const ADMIN = ["/yonetim", "/yonetim/siparisler", "/yonetim/urunler", "/yonetim/urunler/yeni", "/yonetim/kategoriler", "/yonetim/kuponlar", "/yonetim/ayarlar"];
const out: Record<string, unknown[]> = {};

for (const vp of [{ n: "desktop", w: 1280, h: 800 }, { n: "mobile", w: 390, h: 844 }]) {
  test(`axe ${vp.n}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await addToCart(page, "zebra-desen-twill-esarp");
    const pages = vp.n === "desktop" ? [...SHOP, ...ADMIN] : SHOP;
    for (const path of pages) {
      if (path === ADMIN[0]) await loginAdmin(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
      out[`${vp.n} ${path}`] = res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, targets: v.nodes.slice(0, 3).map((x) => x.target.join(" ")) }));
      console.log("[QA-AXE]", vp.n, path, res.violations.map((v) => `${v.id}(${v.impact},${v.nodes.length})`).join(" ") || "—");
    }
    writeFileSync(`qa-artifacts/axe-${vp.n}.json`, JSON.stringify(out, null, 1));
  });
}
