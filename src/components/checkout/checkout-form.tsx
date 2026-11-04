"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Landmark, Loader2, Lock } from "lucide-react";
import { formatTRY } from "@/lib/format";
import { TR_CITIES } from "@/lib/validation";
import { useCart } from "@/components/cart/store";
import { usePricedCart } from "@/components/cart/use-priced-cart";
import { Summary } from "@/components/cart/cart-page";
import { readUtm } from "@/components/shop/utm-capture";
import { placeOrder } from "@/app/actions/checkout";
import { Turnstile } from "./turnstile";

type Props = {
  defaultEmail: string;
  defaultName: string;
  loggedIn: boolean;
  threshold: number;
  demoPayment: boolean;
  turnstileSiteKey: string;
};

function Field({
  id,
  label,
  error,
  children,
  className = "",
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {error && <p className="field-error" id={`${id}-err`}>{error}</p>}
    </div>
  );
}

export function CheckoutForm({ defaultEmail, defaultName, loggedIn, demoPayment, turnstileSiteKey }: Props) {
  const router = useRouter();
  const { hydrated, items, priced, pending: pricing, notice, refresh } = usePricedCart();
  const coupon = useCart((s) => s.coupon);
  const [method, setMethod] = useState<"card" | "transfer">("card");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, start] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string>("");

  if (!hydrated) return <div className="h-96 animate-pulse rounded bg-sand" />;
  if (items.length === 0)
    return (
      <div className="py-16 text-center">
        <p className="text-ink-soft">Sepetiniz boş.</p>
        <Link href="/" className="btn-primary mt-6">Alışverişe dön</Link>
      </div>
    );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      email: String(f.get("email") ?? ""),
      address: {
        fullName: String(f.get("fullName") ?? ""),
        phone: String(f.get("phone") ?? ""),
        city: String(f.get("city") ?? ""),
        district: String(f.get("district") ?? ""),
        line: String(f.get("line") ?? ""),
        postalCode: String(f.get("postalCode") ?? ""),
      },
      paymentMethod: method,
      couponCode: coupon,
      note: String(f.get("note") ?? ""),
      lines: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
      acceptContract: f.get("acceptContract") === "on",
      acceptKvkk: f.get("acceptKvkk") === "on",
      marketing: f.get("marketing") === "on",
      utm: readUtm(),
      turnstileToken: turnstileToken || undefined,
    };
    setFormError(null);
    setErrors({});
    start(async () => {
      const res = await placeOrder(payload);
      if (res.ok) {
        if (/^https?:\/\//.test(res.redirectTo)) window.location.assign(res.redirectTo);
        else router.push(res.redirectTo);
        return;
      }
      setFormError(res.error);
      setErrors(res.fieldErrors ?? {});
      if (res.refreshCart) refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const err = (k: string) => errors[k];

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div className="space-y-8">
        {(formError || notice) && (
          <p role="alert" className="rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {formError ?? notice}
          </p>
        )}

        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl">1. İletişim</h2>
            {!loggedIn && (
              <Link href="/hesabim?next=/odeme" className="text-sm underline">Giriş yap</Link>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="email" label="E-posta" error={err("email")}>
              <input id="email" name="email" type="email" autoComplete="email" required defaultValue={defaultEmail} className="input" aria-invalid={!!err("email")} />
            </Field>
            <Field id="phone" label="Cep telefonu" error={err("address.phone")}>
              <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" required className="input" aria-invalid={!!err("address.phone")} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">Sipariş ve kargo bilgilendirmeleri bu adrese ve numaraya gönderilir. Üye olmadan devam edebilirsiniz.</p>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-xl">2. Teslimat adresi</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="fullName" label="Ad soyad" error={err("address.fullName")} className="sm:col-span-2">
              <input id="fullName" name="fullName" autoComplete="name" required defaultValue={defaultName} className="input" />
            </Field>
            <Field id="city" label="İl" error={err("address.city")}>
              <select id="city" name="city" required className="input" defaultValue="">
                <option value="" disabled>Seçin</option>
                {TR_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field id="district" label="İlçe" error={err("address.district")}>
              <input id="district" name="district" autoComplete="address-level2" required className="input" />
            </Field>
            <Field id="line" label="Açık adres" error={err("address.line")} className="sm:col-span-2">
              <textarea id="line" name="line" rows={3} autoComplete="street-address" required className="input" placeholder="Mahalle, cadde/sokak, bina ve daire no" />
            </Field>
            <Field id="postalCode" label="Posta kodu (isteğe bağlı)" error={err("address.postalCode")}>
              <input id="postalCode" name="postalCode" inputMode="numeric" autoComplete="postal-code" maxLength={5} className="input" />
            </Field>
            <Field id="note" label="Sipariş notu (isteğe bağlı)">
              <input id="note" name="note" maxLength={300} className="input" />
            </Field>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-xl">3. Ödeme</h2>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Ödeme yöntemi">
            {[
              { v: "card" as const, icon: CreditCard, t: "Kredi / banka kartı", d: "3D Secure · 3 ve 6 taksit" },
              { v: "transfer" as const, icon: Landmark, t: "Havale / EFT", d: "24 saat içinde ödeme" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={method === o.v}
                onClick={() => setMethod(o.v)}
                className={`flex items-center gap-3 rounded-md border p-4 text-left ${method === o.v ? "border-ink ring-1 ring-ink" : "border-line bg-white"}`}
              >
                <o.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                <span>
                  <span className="block text-sm font-medium">{o.t}</span>
                  <span className="block text-xs text-muted">{o.d}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {method === "card"
              ? demoPayment
                ? "DEMO: Kart bilgisi istenmez; bir sonraki ekranda başarılı veya başarısız ödemeyi simüle edebilirsiniz."
                : "Kart bilgileriniz iyzico'nun güvenli ödeme sayfasında alınır; sitemizde saklanmaz."
              : "Banka bilgileri sipariş sonrası gösterilir ve e-postanızla gönderilir. Ürünler 24 saat sizin için ayrılır."}
          </p>
        </section>

        <section className="space-y-3 text-sm">
          <details className="rounded-md border border-line bg-white p-4">
            <summary className="cursor-pointer font-medium">Ön bilgilendirme formu ve sipariş özeti</summary>
            <div className="mt-3 space-y-2 text-ink-soft">
              <p>
                Satıcı: Ayşe Ayhan Collection (satıcı unvanı ve adresi yayından önce eklenecektir). Sipariş edilen ürünler, KDV dahil fiyatları ve
                teslimat bilgileri aşağıdadır. Teslimden itibaren 14 gün içinde cayma hakkınız vardır.
              </p>
              <ul className="list-disc pl-5">
                {items.map((i) => (
                  <li key={i.variantId}>
                    {i.productName} ({i.color} / {i.size}) × {i.qty}
                  </li>
                ))}
              </ul>
              {priced && <p>Toplam (KDV ve kargo dahil): <b>{formatTRY(priced.total)}</b></p>}
            </div>
          </details>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="acceptContract" className="mt-1 h-4 w-4 accent-ink" />
            <span>
              <Link href="/on-bilgilendirme-formu" target="_blank" className="underline">Ön bilgilendirme formunu</Link> ve{" "}
              <Link href="/mesafeli-satis-sozlesmesi" target="_blank" className="underline">mesafeli satış sözleşmesini</Link> okudum, onaylıyorum.
            </span>
          </label>
          {err("acceptContract") && <p className="field-error">{err("acceptContract")}</p>}
          <label className="flex items-start gap-3">
            <input type="checkbox" name="acceptKvkk" className="mt-1 h-4 w-4 accent-ink" />
            <span>
              <Link href="/kvkk" target="_blank" className="underline">KVKK aydınlatma metnini</Link> okudum.
            </span>
          </label>
          {err("acceptKvkk") && <p className="field-error">{err("acceptKvkk")}</p>}
          <label className="flex items-start gap-3">
            <input type="checkbox" name="marketing" className="mt-1 h-4 w-4 accent-ink" />
            <span className="text-ink-soft">Kampanya ve yeni ürünlerden e-posta/SMS ile haberdar olmak istiyorum (isteğe bağlı).</span>
          </label>
          <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
        </section>
      </div>

      <aside className="h-fit space-y-5 rounded-md border border-line bg-white p-5 lg:sticky lg:top-6">
        <h2 className="text-xl">Sipariş özeti</h2>
        <ul className="max-h-72 space-y-3 overflow-y-auto">
          {items.map((i) => (
            <li key={i.variantId} className="flex gap-3">
              <div className="relative w-14 shrink-0 bg-sand">
                {i.imageKey && <Image src={i.imageKey} alt="" width={240} height={300} sizes="56px" className="aspect-[4/5] w-full object-cover" />}
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] text-white">{i.qty}</span>
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate">{i.productName}</p>
                <p className="text-xs text-muted">{i.color} · {i.size}</p>
              </div>
              <span className="text-sm">{formatTRY(i.unitPrice * i.qty)}</span>
            </li>
          ))}
        </ul>
        <Summary priced={priced} pending={pricing} />
        <button type="submit" disabled={submitting || pricing || !priced} className="btn-primary w-full text-base">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> İşleniyor…
            </>
          ) : method === "card" ? (
            <>Ödemeye geç {priced && `· ${formatTRY(priced.total)}`}</>
          ) : (
            <>Siparişi tamamla {priced && `· ${formatTRY(priced.total)}`}</>
          )}
        </button>
        <p className="text-center text-xs text-muted">Siparişi tamamlayarak ödeme yükümlülüğü altına girdiğinizi kabul edersiniz.</p>
      </aside>
    </form>
  );
}
