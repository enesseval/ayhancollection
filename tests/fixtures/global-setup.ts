import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Güvenlik kilidi: testler yalnız DEMO modunda çalışır. Ortam dosyalarında canlı Supabase / iyzico
// anahtarı varsa testler başlamaz (aksi halde canlı siparişler, stoklar ve kuponlar değişebilir).
export default function globalSetup() {
  const risky = ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "IYZICO_SECRET_KEY", "RESEND_API_KEY"];
  for (const f of [".env", ".env.local", ".env.production", ".env.production.local", ".env.test", ".env.test.local"]) {
    const p = join(process.cwd(), f);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    const hit = risky.filter((k) => new RegExp(`^\\s*${k}\\s*=\\s*\\S+`, "m").test(text));
    if (hit.length) {
      throw new Error(
        `[e2e] ${f} dosyasında ${hit.join(", ")} tanımlı. Testler canlı servislere gidebilir; ` +
          `bu dosyayı geçici olarak yeniden adlandırın (ör. ${f}.bak) ve tekrar deneyin.`,
      );
    }
  }
}
