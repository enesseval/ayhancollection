import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "";
const origin = (u: string) => {
  try {
    return u ? new URL(u).origin : "";
  } catch {
    return "";
  }
};

// İçerik Güvenlik Politikası. Ödeme formu iyzico'nun kendi sayfasında açıldığı için
// iyzico script'i sitemize yüklenmez. Statik/ISR sayfaları korumak için nonce yerine
// 'unsafe-inline' (yalnız script-src'de Next'in inline bootstrap'i için) kullanılıyor; eval kapalı.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${origin(mediaBase)} ${origin(supabase)}`,
  "font-src 'self'",
  `connect-src 'self' ${origin(supabase)} ${supabase ? origin(supabase).replace("https://", "wss://") : ""} https://challenges.cloudflare.com`,
  "frame-src https://challenges.cloudflare.com",
  "form-action 'self' https://*.iyzipay.com https://*.iyzico.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
]
  .map((s) => s.replace(/\s+/g, " ").trim())
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // Vercel Image Optimization kullanılmaz: yüklemede üretilmiş WebP boyutları doğrudan sunulur.
    loader: "custom",
    loaderFile: "./src/lib/media/loader.ts",
    deviceSizes: [480, 960, 1600],
    imageSizes: [240],
    qualities: [75],
  },
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: { bodySizeLimit: "14mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
