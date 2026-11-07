"use client";
import { ADMIN_TRANSITIONS } from "@/lib/order-status";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmTransfer, setOrderStatus, setOrderTracking, type AdminResult } from "@/app/actions/admin";
import { ORDER_STATUS_LABEL } from "@/lib/format";
import type { Order } from "@/lib/types";

export function useAdminAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<AdminResult>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "Kaydedildi" } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  return { pending, msg, run };
}

export function Flash({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>;
}

export function OrderActions({ order }: { order: Order }) {
  const { pending, msg, run } = useAdminAction();
  const [carrier, setCarrier] = useState(order.carrier ?? "Yurtiçi Kargo");
  const [tracking, setTracking] = useState(order.trackingNo ?? "");
  const next = ADMIN_TRANSITIONS as Record<string, string[]>;
  return (
    <div className="card space-y-5 p-5">
      <h2 className="font-sans text-sm font-semibold">İşlemler</h2>
      {order.status === "awaiting_transfer" && (
        <button className="btn-primary w-full" disabled={pending} onClick={() => run(() => confirmTransfer(order.id))}>
          Havale ödemesi alındı
        </button>
      )}
      {(next[order.status] ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {next[order.status].map((s) => (
            <button
              key={s}
              disabled={pending}
              className={s === "cancelled" || s === "refunded" ? "btn-ghost text-danger" : "btn-outline"}
              onClick={() => {
                if ((s === "cancelled" || s === "refunded") && !confirm(`Sipariş "${ORDER_STATUS_LABEL[s]}" olarak işaretlensin mi?`)) return;
                run(() => setOrderStatus(order.id, s));
              }}
            >
              {ORDER_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}
      {["paid", "preparing", "shipped"].includes(order.status) && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setOrderTracking(order.id, carrier, tracking));
          }}
        >
          <p className="text-sm font-medium">Kargo bilgisi</p>
          <select className="input" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
            {["Yurtiçi Kargo", "Aras Kargo", "MNG Kargo", "PTT Kargo", "Sürat Kargo", "HepsiJet"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input className="input" placeholder="Takip numarası" value={tracking} onChange={(e) => setTracking(e.target.value)} />
          <button className="btn-primary w-full" disabled={pending || tracking.length < 4}>Kaydet ve kargoya verildi yap</button>
        </form>
      )}
      <Flash msg={msg} />
    </div>
  );
}
