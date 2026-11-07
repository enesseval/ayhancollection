import AxeBuilder from "@axe-core/playwright";
import { test, expect, addToCart } from "../fixtures/test";

// Erişilebilirlik (WCAG 2.1 AA): kritik ve ciddi ihlaller olmamalı
const PAGES = ["/", "/kategori/tesettur-giyim", "/urun/vizon-uzun-tunik", "/sepet", "/hesabim", "/siparis-takip", "/arama"];

for (const path of PAGES) {
  test(`erişilebilirlik: ${path}`, async ({ page }) => {
    if (path === "/sepet") await addToCart(page, "vizon-uzun-tunik", { size: "40" });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = res.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    const summary = serious.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}
