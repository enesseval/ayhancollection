"use client";
import { useEffect, useState, useTransition } from "react";
import { priceCartAction, type PricedCartView } from "@/app/actions/cart";
import { useCart } from "./store";
import { useHydrated } from "@/components/use-hydrated";

/** Sepeti sunucuda fiyatlatır, stok/fiyat değişikliklerini yerel sepete yansıtır. */
export function usePricedCart() {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const coupon = useCart((s) => s.coupon);
  const replaceFromServer = useCart((s) => s.replaceFromServer);
  const rejectCoupon = useCart((s) => s.rejectCoupon);
  const [priced, setPriced] = useState<PricedCartView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify(items.map((i) => [i.variantId, i.qty])) + coupon + nonce;

  useEffect(() => {
    if (!hydrated) return;
    start(async () => {
      const res = await priceCartAction({ lines: items.map((i) => ({ variantId: i.variantId, qty: i.qty })), coupon: coupon || undefined });
      setPriced(res);
      // Geçersiz kupon sepette tutulmaz; sadece hata mesajı gösterilir
      if (coupon && !res.couponCode && res.couponError) rejectCoupon(res.couponError);
      const changed =
        res.removed.length > 0 ||
        res.lines.some((l) => {
          const local = items.find((i) => i.variantId === l.variantId);
          return !local || local.qty !== l.qty || local.unitPrice !== l.unitPrice;
        });
      if (changed) {
        replaceFromServer(res.lines.map((l) => ({ variantId: l.variantId, qty: l.qty, unitPrice: l.unitPrice, maxQty: l.maxQty })));
        setNotice(
          res.removed.length
            ? "Sepetinizdeki bazı ürünler tükendiği için kaldırıldı."
            : "Stok veya fiyat değişikliği nedeniyle sepetiniz güncellendi.",
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, key]);

  const refresh = () => setNonce((n) => n + 1);
  return { hydrated, items, priced, pending, notice, refresh };
}
