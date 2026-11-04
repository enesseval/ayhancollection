"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";

type Item = { href: string; label: string; children: { href: string; label: string }[] };

export function MobileNav({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <>
      <button type="button" className="btn-ghost !px-2.5" aria-label="Menüyü aç" aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" strokeWidth={1.5} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menü">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-canvas shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <span className="font-serif text-lg tracking-[0.18em]">MENÜ</span>
              <button type="button" className="btn-ghost !px-2.5" aria-label="Menüyü kapat" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              <Link href="/kategori/yeni" className="block px-3 py-3 font-medium">
                Yeni Gelenler
              </Link>
              {items.map((it) =>
                it.children.length ? (
                  <details key={it.href} className="group border-t border-line">
                    <summary className="flex cursor-pointer items-center justify-between px-3 py-3 font-medium">
                      {it.label}
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="pb-2 pl-3">
                      <Link href={it.href} className="block px-3 py-2 text-sm text-ink-soft">
                        Tümü
                      </Link>
                      {it.children.map((c) => (
                        <Link key={c.href} href={c.href} className="block px-3 py-2 text-sm text-ink-soft">
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </details>
                ) : (
                  <Link key={it.href} href={it.href} className="block border-t border-line px-3 py-3 font-medium">
                    {it.label}
                  </Link>
                ),
              )}
              <div className="mt-4 border-t border-line pt-4 text-sm">
                <Link href="/hesabim" className="block px-3 py-2">Hesabım</Link>
                <Link href="/siparis-takip" className="block px-3 py-2">Sipariş Takibi</Link>
                <Link href="/iletisim" className="block px-3 py-2">İletişim</Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
