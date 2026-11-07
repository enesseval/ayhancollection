"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Minus, Plus, Trash2, Tag } from "lucide-react";
import { formatTRY } from "@/lib/format";
import { useCart } from "./store";
import { usePricedCart } from "./use-priced-cart";
import { FreeShippingBar } from "./cart-drawer";

export function Summary({
  priced,
  pending,
  showCoupon = true,
}: {
  priced: ReturnType<typeof usePricedCart>["priced"];
  pending: boolean;
  showCoupon?: boolean;
}) {
  const coupon = useCart((s) => s.coupon);
  const setCoupon = useCart((s) => s.setCoupon);
  const [code, setCode] = useState(coupon);
  const couponMsg = useCart((s) => s.couponError);
  const applied = !!priced?.couponCode && priced.couponCode === coupon;
  return (
    <div className={`space-y-3 text-sm transition-opacity ${pending ? "opacity-60" : ""}`}>
      {showCoupon && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setCoupon(code.trim().toUpperCase());
          }}
        >
          <label className="sr-only" htmlFor="coupon">Kupon kodu</label>
          <div className="relative flex-1">
            <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id="coupon"
              className="input !pl-9 uppercase"
              placeholder="Kupon kodu"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={24}
              autoComplete="off"
            />
          </div>
          {applied ? (
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setCoupon("");
                setCode("");
              }}
            >
              Kaldır
            </button>
          ) : (
            <button className="btn-outline" type="submit">Uygula</button>
          )}
        </form>
      )}
      {couponMsg && <p className="field-error" role="alert">{couponMsg}</p>}
      {applied && <p className="text-success">&quot;{priced.couponCode}&quot; kuponu uygulandı.</p>}
      <dl className="space-y-2 border-t border-line pt-3">
        <div className="flex justify-between">
          <dt>Ara toplam</dt>
          <dd>{priced ? formatTRY(priced.subtotal) : "…"}</dd>
        </div>
        {!!priced?.discount && (
          <div className="flex justify-between text-success">
            <dt>İndirim</dt>
            <dd>-{formatTRY(priced.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt>Kargo</dt>
          <dd>{priced ? (priced.shipping ? formatTRY(priced.shipping) : "Ücretsiz") : "…"}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
          <dt>Toplam</dt>
          <dd>{priced ? formatTRY(priced.total) : "…"}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted">KDV dahildir.</p>
    </div>
  );
}

export function CartPageClient({ threshold }: { threshold: number }) {
  const { hydrated, items, priced, pending, notice } = usePricedCart();
  const { setQty, remove } = useCart();

  if (!hydrated) return <div className="h-64 animate-pulse rounded bg-sand" />;
  if (items.length === 0)
    return (
      <div className="py-16 text-center">
        <p className="text-ink-soft">Sepetiniz boş.</p>
        <Link href="/" className="btn-primary mt-6">Alışverişe başla</Link>
      </div>
    );

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div>
        {notice && <p className="mb-4 rounded border border-blush bg-blush-soft px-4 py-3 text-sm" role="status">{notice}</p>}
        <ul className="divide-y divide-line border-y border-line">
          {items.map((i) => {
            const line = priced?.lines.find((l) => l.variantId === i.variantId);
            return (
              <li key={i.variantId} className="flex gap-4 py-5">
                <Link href={`/urun/${i.productSlug}`} className="w-24 shrink-0 bg-sand sm:w-28">
                  {i.imageKey && <Image src={i.imageKey} alt={i.productName} width={240} height={300} sizes="112px" className="aspect-[4/5] w-full object-cover" />}
                </Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex justify-between gap-3">
                    <div>
                      <Link href={`/urun/${i.productSlug}`} className="font-medium hover:underline">{i.productName}</Link>
                      <p className="mt-1 text-sm text-muted">{i.color} · {i.size}</p>
                      <p className="mt-1 text-sm">{formatTRY(line?.unitPrice ?? i.unitPrice)}</p>
                    </div>
                    <button onClick={() => remove(i.variantId)} className="self-start text-muted hover:text-danger" aria-label={`${i.productName} kaldır`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center border border-line bg-white">
                      <button className="p-2.5 disabled:opacity-40" onClick={() => setQty(i.variantId, i.qty - 1)} disabled={i.qty <= 1} aria-label="Azalt">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm">{i.qty}</span>
                      <button className="p-2.5 disabled:opacity-40" onClick={() => setQty(i.variantId, i.qty + 1)} disabled={i.qty >= Math.min(i.maxQty, 10)} aria-label="Artır">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="font-semibold">{formatTRY(line?.lineTotal ?? i.qty * i.unitPrice)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <aside className="h-fit space-y-5 rounded-md border border-line bg-white p-5 lg:sticky lg:top-24">
        <FreeShippingBar subtotal={(priced?.subtotal ?? 0) - (priced?.discount ?? 0)} threshold={threshold} />
        <Summary priced={priced} pending={pending} />
        <Link href="/odeme" className="btn-primary w-full text-base">Güvenli ödemeye geç</Link>
        <p className="text-center text-xs text-muted">3D Secure ile güvenli ödeme · 14 gün iade</p>
      </aside>
    </div>
  );
}
