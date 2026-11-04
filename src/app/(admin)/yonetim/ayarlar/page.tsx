import { repo } from "@/lib/data";
import { features } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function AdminSettings() {
  const [settings, audit] = await Promise.all([repo.getSettings(), repo.listAudit(30)]);
  const integrations = [
    ["Veritabanı (Supabase)", features.supabase, "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"],
    ["Ödeme (iyzico)", features.iyzico, "IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL"],
    [features.r2 ? "Görsel deposu (Cloudflare R2)" : "Görsel deposu (Supabase Storage)", features.r2 || features.supabase, "Supabase bağlanınca otomatik; R2 için R2_* değişkenleri"],
    ["E-posta (Resend)", features.resend, "RESEND_API_KEY, MAIL_FROM"],
    ["Rate limit (Upstash)", features.upstash, "UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN"],
    ["Bot koruması (Turnstile)", features.turnstile, "TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
  ] as const;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Ayarlar</h1>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <SettingsForm settings={settings} />
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-sans text-sm font-semibold">Entegrasyonlar</h2>
            <ul className="space-y-3 text-sm">
              {integrations.map(([name, on, vars]) => (
                <li key={name}>
                  <div className="flex items-center justify-between">
                    <span>{name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${on ? "bg-success/10 text-success" : "bg-blush-soft"}`}>{on ? "Bağlı" : "Demo"}</span>
                  </div>
                  {!on && <p className="mt-0.5 font-mono text-[11px] text-muted">{vars}</p>}
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-sans text-sm font-semibold">İşlem kaydı</h2>
            {audit.length === 0 ? (
              <p className="text-sm text-muted">Henüz kayıt yok.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {audit.map((a, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{a.entity}: {a.action} · <span className="font-mono">{a.entityId}</span></span>
                    <span className="shrink-0 text-muted">{formatDate(a.at, true)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
