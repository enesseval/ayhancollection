"use client";
import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string };
  }
}

/** Cloudflare Turnstile (site anahtarı yoksa hiçbir şey render etmez). */
export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const render = () => {
    if (!siteKey || rendered.current || !ref.current || !window.turnstile) return;
    rendered.current = true;
    window.turnstile.render(ref.current, { sitekey: siteKey, callback: onToken, language: "tr", appearance: "interaction-only" });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(render, [siteKey]);
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={render} />
      <div ref={ref} />
    </>
  );
}
