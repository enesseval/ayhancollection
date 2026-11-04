"use client";
import { useEffect } from "react";

// İlk girişteki UTM parametrelerini saklar (hangi Reels'in satış getirdiğini ölçmek için). PII içermez.
export const UTM_KEY = "aac-utm";

export function UtmCapture() {
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
        const v = sp.get(k);
        if (v) utm[k] = v.slice(0, 100);
      }
      if (!utm.utm_source && /instagram\.com/.test(document.referrer)) utm.utm_source = "instagram";
      if (Object.keys(utm).length) sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
    } catch {}
  }, []);
  return null;
}

export function readUtm(): Record<string, string> | undefined {
  try {
    const raw = sessionStorage.getItem(UTM_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}
