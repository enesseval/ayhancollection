import { defineConfig, devices } from "@playwright/test";

// QA keşif/güvenlik testleri — YALNIZ yerel demo sunucusuna (http://localhost:3200) gider.
// Sunucu elle başlatılır: `npx next build && npx next start -p 3200` (Supabase/iyzico/Resend anahtarları boş).
export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  outputDir: "./test-results",
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3200",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
});
