"use client";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

// Supabase modunda yönetici için TOTP iki adımlı doğrulama (aal2) zorunludur.
export function MfaGate() {
  const [sb] = useState(() =>
    createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
  );
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (verified) return setFactorId(verified.id);
      const { data: enrolled, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Yönetici" });
      if (error) return setError(error.message);
      setFactorId(enrolled.id);
      setQr(enrolled.totp.qr_code);
    })();
  }, [sb]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) return setError("Kod doğrulanamadı, tekrar deneyin.");
    window.location.reload();
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <form onSubmit={verify} className="w-full max-w-sm space-y-4 rounded-lg border border-line bg-white p-6">
        <h1 className="text-2xl">İki adımlı doğrulama</h1>
        {qr ? (
          <>
            <p className="text-sm text-ink-soft">Authenticator uygulamanızla (Google Authenticator, 1Password vb.) bu kodu okutun:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="TOTP QR kodu" className="mx-auto h-48 w-48" />
          </>
        ) : (
          <p className="text-sm text-ink-soft">Authenticator uygulamanızdaki 6 haneli kodu girin.</p>
        )}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="input text-center font-mono text-xl tracking-[0.4em]"
          placeholder="000000"
          aria-label="Doğrulama kodu"
        />
        {error && <p className="field-error">{error}</p>}
        <button className="btn-primary w-full" disabled={code.length !== 6}>Doğrula</button>
      </form>
    </div>
  );
}
