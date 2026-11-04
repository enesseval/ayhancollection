"use client";
import { useEffect } from "react";
import { useCart } from "@/components/cart/store";

export function ClearCartOnMount() {
  const clear = useCart((s) => s.clear);
  useEffect(() => clear(), [clear]);
  return null;
}
