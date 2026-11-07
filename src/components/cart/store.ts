"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Sepet istemcide (localStorage) tutulur; fiyatlar YALNIZCA görüntüleme içindir.
// Sunucu her işlemde fiyatı ve stoku veri katmanından yeniden hesaplar.

export type CartItem = {
  variantId: string;
  qty: number;
  productSlug: string;
  productName: string;
  size: string;
  color: string;
  unitPrice: number;
  imageKey: string | null;
  maxQty: number;
};

type CartState = {
  items: CartItem[];
  open: boolean;
  coupon: string;
  /** Sunucunun reddettiği kuponun hata mesajı (kalıcı değil) */
  couponError: string | null;
  rejectCoupon: (msg: string) => void;
  add: (item: CartItem) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
  setCoupon: (c: string) => void;
  replaceFromServer: (items: { variantId: string; qty: number; unitPrice: number; maxQty: number }[]) => void;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

function sanitizeItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CartItem[] = [];
  for (const r of raw.slice(0, 30)) {
    if (!r || typeof r !== "object") continue;
    const i = r as Record<string, unknown>;
    if (typeof i.variantId !== "string" || !UUID.test(i.variantId) || seen.has(i.variantId)) continue;
    if (typeof i.qty !== "number" || !Number.isFinite(i.qty)) continue;
    const maxQty = typeof i.maxQty === "number" && Number.isFinite(i.maxQty) ? Math.max(1, Math.min(Math.floor(i.maxQty), 10)) : 10;
    const qty = Math.max(1, Math.min(Math.floor(i.qty), maxQty));
    seen.add(i.variantId);
    out.push({
      variantId: i.variantId,
      qty,
      maxQty,
      productSlug: str(i.productSlug),
      productName: str(i.productName),
      size: str(i.size, 40),
      color: str(i.color, 40),
      unitPrice: typeof i.unitPrice === "number" && Number.isFinite(i.unitPrice) && i.unitPrice >= 0 ? i.unitPrice : 0,
      imageKey: typeof i.imageKey === "string" ? i.imageKey : null,
    });
  }
  return out;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      coupon: "",
      couponError: null,
      rejectCoupon: (msg) => set({ coupon: "", couponError: msg }),
      add: (item) =>
        set((s) => {
          const existing = s.items.find((i) => i.variantId === item.variantId);
          const items = existing
            ? s.items.map((i) =>
                i.variantId === item.variantId ? { ...i, qty: Math.min(i.qty + item.qty, item.maxQty, 10) } : i,
              )
            : [...s.items, { ...item, qty: Math.min(item.qty, item.maxQty, 10) }];
          return { items: items.slice(0, 30), open: true };
        }),
      setQty: (variantId, qty) =>
        set((s) => ({
          items: s.items.map((i) => (i.variantId === variantId ? { ...i, qty: Math.max(1, Math.min(qty, i.maxQty, 10)) } : i)),
        })),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      clear: () => set({ items: [], coupon: "" }),
      setOpen: (open) => set({ open }),
      setCoupon: (coupon) => set({ coupon, couponError: null }),
      replaceFromServer: (server) =>
        set((s) => ({
          items: s.items
            .map((i) => {
              const sv = server.find((x) => x.variantId === i.variantId);
              return sv ? { ...i, qty: sv.qty, unitPrice: sv.unitPrice, maxQty: sv.maxQty } : null;
            })
            .filter(Boolean) as CartItem[],
        })),
    }),
    {
      name: "aac-cart-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items, coupon: s.coupon }),
      version: 1,
      // localStorage elle bozulmuş/eski olabilir: geçersiz satırlar atılır, adetler sınırlanır
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { items?: unknown; coupon?: unknown };
        return {
          ...current,
          items: sanitizeItems(p.items),
          coupon: typeof p.coupon === "string" ? p.coupon.slice(0, 24) : "",
        };
      },
    },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((a, i) => a + i.qty, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((a, i) => a + i.qty * i.unitPrice, 0);
