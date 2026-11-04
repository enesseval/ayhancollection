import "server-only";

// Sunucu ortam değişkenleri. Bir entegrasyonun anahtarları yoksa ilgili özellik güvenli bir
// "demo" moduna düşer; anahtar eklendiği anda gerçek entegrasyon devreye girer.

const e = process.env;

export const env = {
  siteUrl: (e.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  sessionSecret: e.SESSION_SECRET || "",

  supabaseUrl: e.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceKey: e.SUPABASE_SERVICE_ROLE_KEY || "",

  iyzicoApiKey: e.IYZICO_API_KEY || "",
  iyzicoSecretKey: e.IYZICO_SECRET_KEY || "",
  iyzicoBaseUrl: e.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com",

  r2AccountId: e.R2_ACCOUNT_ID || "",
  r2AccessKeyId: e.R2_ACCESS_KEY_ID || "",
  r2SecretAccessKey: e.R2_SECRET_ACCESS_KEY || "",
  r2Bucket: e.R2_BUCKET || "",

  resendApiKey: e.RESEND_API_KEY || "",
  mailFrom: e.MAIL_FROM || "Ayşe Ayhan Collection <siparis@example.com>",

  upstashUrl: e.UPSTASH_REDIS_REST_URL || "",
  upstashToken: e.UPSTASH_REDIS_REST_TOKEN || "",

  turnstileSecret: e.TURNSTILE_SECRET_KEY || "",

  revalidateToken: e.REVALIDATE_TOKEN || "",
  cronSecret: e.CRON_SECRET || "",

  // Demo mod giriş bilgileri (Supabase bağlanana kadar)
  demoAdminEmail: (e.DEMO_ADMIN_EMAIL || "admin@ayseayhan.demo").toLowerCase(),
  demoAdminPassword: e.DEMO_ADMIN_PASSWORD || "",
};

export const features = {
  supabase: !!(env.supabaseUrl && env.supabaseAnonKey && env.supabaseServiceKey),
  iyzico: !!(env.iyzicoApiKey && env.iyzicoSecretKey),
  r2: !!(env.r2AccountId && env.r2AccessKeyId && env.r2SecretAccessKey && env.r2Bucket),
  resend: !!env.resendApiKey,
  upstash: !!(env.upstashUrl && env.upstashToken),
  turnstile: !!env.turnstileSecret,
};

export function sessionSecretBytes(): Uint8Array {
  const s = env.sessionSecret;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error("SESSION_SECRET en az 32 karakter olmalı");
    }
    return new TextEncoder().encode("dev-only-insecure-secret-change-me-0123456789");
  }
  return new TextEncoder().encode(s);
}
