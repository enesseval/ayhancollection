"use client";
import Link from "next/link";
import { useState } from "react";
import { useHydrated } from "@/components/use-hydrated";

// KVKK Çerez Rehberi: zorunlu olmayan çerezler (analitik/pazarlama) onaydan önce YÜKLENMEZ.
// Onay durumu localStorage'da tutulur; analitik scriptleri bu değere bakarak yüklenir.
const KEY = "aac-consent-v1";
export type Consent = { analytics: boolean; marketing: boolean; at: string };

export function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Consent) : null;
  } catch {
    return null;
  }
}

export function CookieBanner() {
  const hydrated = useHydrated();
  const [done, setDone] = useState(false);
  const [prefs, setPrefs] = useState(false);
  const [a, setA] = useState(false);
  const [m, setM] = useState(false);

  if (!hydrated || done || readConsent()) return null;

  const save = (analytics: boolean, marketing: boolean) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ analytics, marketing, at: new Date().toISOString() }));
    } catch {}
    setDone(true);
  };

  return (
    <div role="dialog" aria-label="Çerez tercihleri" className="fixed inset-x-3 bottom-3 z-[55] mx-auto max-w-xl rounded-lg border border-line bg-white p-4 shadow-xl sm:p-5">
      <p className="text-sm leading-6 text-ink-soft">
        Sitenin çalışması için zorunlu çerezler kullanıyoruz. Onay verirseniz deneyiminizi iyileştirmek için analitik ve pazarlama
        çerezleri de kullanırız. Ayrıntılar: <Link href="/cerez-politikasi" className="underline">Çerez Politikası</Link>.
      </p>
      {prefs && (
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2 opacity-70">
            <input type="checkbox" checked disabled /> Zorunlu çerezler (her zaman açık)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={a} onChange={(e) => setA(e.target.checked)} /> Analitik çerezler
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={m} onChange={(e) => setM(e.target.checked)} /> Pazarlama çerezleri
          </label>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-primary flex-1" onClick={() => save(true, true)}>
          Tümünü kabul et
        </button>
        <button className="btn-outline flex-1" onClick={() => save(false, false)}>
          Yalnız zorunlu
        </button>
        {prefs ? (
          <button className="btn-ghost w-full" onClick={() => save(a, m)}>
            Tercihlerimi kaydet
          </button>
        ) : (
          <button className="btn-ghost w-full" onClick={() => setPrefs(true)}>
            Tercihleri yönet
          </button>
        )}
      </div>
    </div>
  );
}
