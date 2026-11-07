"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Dinamik sayfalarda notFound() sonrası hidrasyon <title>'ı genel site başlığıyla değiştiriyor.
 * Sayfada 404 işareti ([data-not-found]) varsa sekme başlığı onun değerine sabitlenir.
 */
export function NotFoundTitle() {
  const pathname = usePathname();
  useEffect(() => {
    const apply = () => {
      const t = document.querySelector<HTMLElement>("[data-not-found]")?.dataset.notFound;
      if (t && document.title !== t) document.title = t;
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { subtree: true, childList: true, characterData: true });
    const timer = setTimeout(() => mo.disconnect(), 4000);
    return () => {
      clearTimeout(timer);
      mo.disconnect();
    };
  }, [pathname]);
  return null;
}
