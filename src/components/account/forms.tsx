"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { loginAction, lookupOrderAction, registerAction, type FormState } from "@/app/actions/account";

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="field-error">{msg}</p> : null;
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button className="btn-primary w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />} {children}
    </button>
  );
}

export function AuthForms({ next, demoHint }: { next: string; demoHint: string | null }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loginState, loginFn, loginPending] = useActionState<FormState, FormData>(loginAction, null);
  const [regState, regFn, regPending] = useActionState<FormState, FormData>(registerAction, null);
  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 grid grid-cols-2 border-b border-line" role="tablist">
        {(["login", "register"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 py-3 text-sm font-medium ${tab === t ? "border-ink" : "border-transparent text-muted transition-colors hover:text-ink"}`}
          >
            {t === "login" ? "Giriş yap" : "Üye ol"}
          </button>
        ))}
      </div>
      {demoHint && <p className="mb-4 rounded bg-blush-soft px-3 py-2 text-xs leading-5">{demoHint}</p>}
      {tab === "login" ? (
        <form action={loginFn} className="space-y-4" noValidate>
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="l-email" className="label">E-posta</label>
            <input id="l-email" name="email" type="email" autoComplete="email" className="input" required defaultValue={loginState?.values?.email} />
            <Err msg={loginState?.fieldErrors?.email} />
          </div>
          <div>
            <label htmlFor="l-pw" className="label">Şifre</label>
            <input id="l-pw" name="password" type="password" autoComplete="current-password" className="input" required />
            <Err msg={loginState?.fieldErrors?.password} />
          </div>
          {loginState?.error && <p role="alert" className="field-error">{loginState.error}</p>}
          <Submit pending={loginPending}>Giriş yap</Submit>
        </form>
      ) : (
        <form action={regFn} className="space-y-4" noValidate>
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="r-name" className="label">Ad soyad</label>
            <input id="r-name" name="fullName" autoComplete="name" className="input" required defaultValue={regState?.values?.fullName} />
            <Err msg={regState?.fieldErrors?.fullName} />
          </div>
          <div>
            <label htmlFor="r-email" className="label">E-posta</label>
            <input id="r-email" name="email" type="email" autoComplete="email" className="input" required defaultValue={regState?.values?.email} />
            <Err msg={regState?.fieldErrors?.email} />
          </div>
          <div>
            <label htmlFor="r-pw" className="label">Şifre</label>
            <input id="r-pw" name="password" type="password" autoComplete="new-password" minLength={10} className="input" required />
            <p className="mt-1 text-xs text-muted">En az 10 karakter, harf ve rakam içermeli.</p>
            <Err msg={regState?.fieldErrors?.password} />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="acceptKvkk" className="mt-1 h-4 w-4 accent-ink" />
            <span>
              <Link href="/kvkk" className="underline" target="_blank">KVKK aydınlatma metnini</Link> ve{" "}
              <Link href="/uyelik-sozlesmesi" className="underline" target="_blank">üyelik sözleşmesini</Link> okudum.
            </span>
          </label>
          <Err msg={regState?.fieldErrors?.acceptKvkk} />
          {regState?.error && <p role="alert" className="field-error">{regState.error}</p>}
          {regState?.notice && <p role="status" className="rounded bg-canvas p-3 text-sm text-success">{regState.notice}</p>}
          <Submit pending={regPending}>Üye ol</Submit>
        </form>
      )}
    </div>
  );
}

export function OrderLookupForm({ defaultNo }: { defaultNo: string }) {
  const [state, fn, pending] = useActionState<FormState, FormData>(lookupOrderAction, null);
  return (
    <form action={fn} className="mx-auto max-w-md space-y-4" noValidate>
      <div>
        <label htmlFor="orderNo" className="label">Sipariş numarası</label>
        <input id="orderNo" name="orderNo" defaultValue={state?.values?.orderNo ?? defaultNo} placeholder="AA-2611-XXXXXX" className="input font-mono uppercase" required />
        <Err msg={state?.fieldErrors?.orderNo} />
      </div>
      <div>
        <label htmlFor="lookup-email" className="label">Siparişte kullandığınız e-posta</label>
        <input id="lookup-email" name="email" type="email" autoComplete="email" className="input" required defaultValue={state?.values?.email} />
        <Err msg={state?.fieldErrors?.email} />
      </div>
      {state?.error && <p role="alert" className="field-error">{state.error}</p>}
      <Submit pending={pending}>Siparişimi bul</Submit>
    </form>
  );
}
