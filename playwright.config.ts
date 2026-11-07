import { defineConfig, devices } from "@playwright/test";

// Uçtan uca testler sitenin DEMO modunda çalışır: Supabase/iyzico anahtarı olmadan veriler bellekte
// tutulur, ödeme demo 3D Secure ekranıdır. Canlı veritabanına ASLA dokunulmaz (global-setup kontrol eder).
const PORT = Number(process.env.E2E_PORT || 3100);
const BASE = `http://localhost:${PORT}`;
// Sistemde kurulu Chrome ile çalıştırmak için: PW_CHANNEL=chrome (varsayılan: Playwright'ın Chromium'u)
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/fixtures/global-setup.ts",
  // Demo verisi tek sunucu sürecinin belleğinde: testler sırayla çalışır
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: process.env.PW_NO_VIDEO ? "off" : "retain-on-failure",
    channel,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel }, testMatch: /(smoke|cart)\.spec\.ts/ },
  ],
  webServer: {
    command: process.env.E2E_DEV ? `npx next dev -p ${PORT}` : `npm run build && npx next start -p ${PORT}`,
    url: BASE,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      // Demo modunu zorla: bu anahtarlar boşken uygulama bellek içi verilerle çalışır
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      IYZICO_API_KEY: "",
      IYZICO_SECRET_KEY: "",
      RESEND_API_KEY: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
      NEXT_PUBLIC_SITE_URL: BASE,
      SESSION_SECRET: "e2e-test-session-secret-0123456789-abcdefgh",
      CRON_SECRET: "e2e-cron-secret",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
