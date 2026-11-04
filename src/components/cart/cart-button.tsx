"use client";
import { ShoppingBag } from "lucide-react";
import { useHydrated } from "@/components/use-hydrated";
import { cartCount, useCart } from "./store";

export function CartButton() {
  const items = useCart((s) => s.items);
  const setOpen = useCart((s) => s.setOpen);
  const hydrated = useHydrated();
  const n = hydrated ? cartCount(items) : 0;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="btn-ghost relative !px-2.5"
      aria-label={`Sepet, ${n} ürün`}
    >
      <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
      {n > 0 && (
        <span className="absolute right-0.5 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blush px-1 text-[10px] font-semibold text-ink">
          {n}
        </span>
      )}
    </button>
  );
}
