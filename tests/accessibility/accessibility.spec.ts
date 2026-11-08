import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect, addToCart, loginAdmin } from "../fixtures/test";

// Erişilebilirlik (WCAG 2.1 AA): kritik ve ciddi ihlaller olmamalı; ayrıca yapısal (landmark/başlık sırası) kurallar
const PAGES = ["/", "/kategori/tesettur-giyim", "/urun/vizon-uzun-tunik", "/sepet", "/hesabim", "/siparis-takip", "/arama?q=tunik"];
const ADMIN_PAGES = ["/yonetim", "/yonetim/urunler", "/yonetim/urunler/yeni", "/yonetim/siparisler", "/yonetim/kuponlar", "/yonetim/ayarlar"];
const STRUCTURE_RULES = new Set(["region", "landmark-one-main", "heading-order", "empty-table-header", "scrollable-region-focusable"]);

async function audit(page: Page) {
  // networkidle yerine: sayfa yüklensin ve ana içerik görünsün (RSC ön yüklemeleri networkidle'ı geciktiriyor)
  await page.waitForLoadState("load");
  await expect(page.locator("main").first()).toBeVisible();
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  const bad = res.violations.filter((v) => v.impact === "critical" || v.impact === "serious" || STRUCTURE_RULES.has(v.id));
  return bad.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const path of PAGES) {
  test(`erişilebilirlik: ${path}`, async ({ page }) => {
    if (path === "/sepet") await addToCart(page, "vizon-uzun-tunik", { size: "40" });
    await page.goto(path);
    // Sepet özeti hesaplanırken soluk gösterilir; denetim son hal üzerinde yapılmalı
    if (path === "/sepet") await expect(page.getByRole("link", { name: "Güvenli ödemeye geç" })).toBeVisible();
    const summary = await audit(page);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}

test("erişilebilirlik: mobil ürün galerisi", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/urun/vizon-uzun-tunik");
  const summary = await audit(page);
  expect(summary, summary.join("\n")).toEqual([]);
});

test("erişilebilirlik: yönetim sayfaları", async ({ page }) => {
  await loginAdmin(page);
  const all: string[] = [];
  for (const path of ADMIN_PAGES) {
    await page.goto(path);
    for (const s of await audit(page)) all.push(`${path}: ${s}`);
  }
  expect(all, all.join("\n")).toEqual([]);
});
