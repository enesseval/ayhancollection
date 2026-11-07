"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { formatTRY } from "@/lib/format";
import { useHydrated } from "@/components/use-hydrated";
import { cartSubtotal, useCart } from "./store";

export function FreeShippingBar({ subtotal, threshold }: { subtotal: number; threshold: number }) {
  const remaining = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  return (
    <div className="space-y-2">
      <p className="text-sm">
        {remaining > 0 ? (
          <>
            Ücretsiz kargo için <b>{formatTRY(remaining)}</b> daha ekleyin
          </>
        ) : (
          <b>Kargonuz ücretsiz!</b>
        )}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-rose transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CartDrawer({ freeShippingThreshold }: { freeShippingThreshold: number }) {
  const { items, open, setOpen, setQty, remove } = useCart();
  const hydrated = useHydrated();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, setOpen]);

  if (!hydrated || !open) return null;
  const subtotal = cartSubtotal(items);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Sepetim">
      <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
      <aside className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-xl bg-canvas shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-xl">Sepetim</h2>
          <button className="btn-ghost !px-2" onClick={() => setOpen(false)} aria-label="Sepeti kapat">
            <X className="h-5 w-5" />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
            <p className="text-ink-soft">Sepetiniz şu an boş.</p>
            <Link href="/kategori/yeni" className="btn-primary" onClick={() => setOpen(false)}>
              Yeni gelenlere göz atın
            </Link>
          </div>
        ) : (
          <>
            <div className="border-b border-line px-5 py-4">
              <FreeShippingBar subtotal={subtotal} threshold={freeShippingThreshold} />
            </div>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {items.map((i) => (
                <li key={i.variantId} className="flex gap-3 py-4">
                  <Link href={`/urun/${i.productSlug}`} onClick={() => setOpen(false)} className="w-20 shrink-0 bg-sand transition-opacity hover:opacity-85">
                    {i.imageKey && (
                      <Image src={i.imageKey} alt={i.productName} width={240} height={300} sizes="80px" className="aspect-[4/5] w-full object-cover" />
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{i.productName}</p>
                      <button onClick={() => remove(i.variantId)} aria-label={`${i.productName} ürününü kaldır`} className="text-muted hover:text-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {i.color} · {i.size}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center border border-line">
                        <button className="p-2 transition-colors hover:bg-sand disabled:opacity-40 disabled:hover:bg-transparent" onClick={() => setQty(i.variantId, i.qty - 1)} disabled={i.qty <= 1} aria-label="Azalt">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm" aria-live="polite">{i.qty}</span>
                        <button className="p-2 transition-colors hover:bg-sand disabled:opacity-40 disabled:hover:bg-transparent" onClick={() => setQty(i.variantId, i.qty + 1)} disabled={i.qty >= Math.min(i.maxQty, 10)} aria-label="Artır">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold">{formatTRY(i.unitPrice * i.qty)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-3 border-t border-line bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex justify-between text-sm">
                <span>Ara toplam</span>
                <span className="font-semibold">{formatTRY(subtotal)}</span>
              </div>
              <p className="text-xs text-muted">Kargo ve indirimler ödeme adımında hesaplanır.</p>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/sepet" className="btn-outline" onClick={() => setOpen(false)}>
                  Sepete git
                </Link>
                <Link href="/odeme" className="btn-primary" onClick={() => setOpen(false)}>
                  Ödemeye geç
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
