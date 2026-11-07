import type { OrderStatus } from "./types";

// Yönetimin elle yapabileceği durum geçişleri (arayüz ve sunucu AYNI tabloyu kullanır).
// "Ödendi" durumuna yalnız ödeme onayıyla (kart/havale) geçilir; buradan geçilemez.
export const ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending_payment: ["cancelled"],
  awaiting_transfer: ["cancelled"],
  paid: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (ADMIN_TRANSITIONS[from] ?? []).includes(to);
}

/** Bu duruma hangi durumlardan gelinebilir (koşullu güncelleme için) */
export function allowedFrom(to: OrderStatus): OrderStatus[] {
  return (Object.keys(ADMIN_TRANSITIONS) as OrderStatus[]).filter((f) => ADMIN_TRANSITIONS[f]!.includes(to));
}

/** Kargo bilgisi girilebilecek durumlar */
export const TRACKABLE: OrderStatus[] = ["paid", "preparing", "shipped"];
