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
  add: (item: CartItem) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
  setCoupon: (c: string) => void;
  replaceFromServer: (items: { variantId: string; qty: number; unitPrice: number; maxQty: number }[]) => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      coupon: "",
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
      setCoupon: (coupon) => set({ coupon }),
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
    },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((a, i) => a + i.qty, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((a, i) => a + i.qty * i.unitPrice, 0);
