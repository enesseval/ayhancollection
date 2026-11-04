"use client";
import { useState } from "react";
import { saveCoupon } from "@/app/actions/admin";
import type { Coupon } from "@/lib/types";
import { Flash, useAdminAction } from "./order-actions";

export function CouponForm({ coupons }: { coupons: Coupon[] }) {
  const { pending, msg, run } = useAdminAction();
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const key = editing?.id ?? "new";

  return (
    <form
      key={key}
      className="card h-fit space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const value = Number(String(f.get("value")).replace(",", "."));
        const limit = String(f.get("usageLimit") ?? "").trim();
        run(() =>
          saveCoupon({
            id: editing?.id ?? "",
            code: String(f.get("code") ?? ""),
            type,
            value: type === "percent" ? Math.round(value) : Math.round(value * 100),
            minSubtotal: Math.round(Number(String(f.get("minSubtotal") || 0).replace(",", ".")) * 100),
            endsAt: String(f.get("endsAt") ?? ""),
            usageLimit: limit ? Number(limit) : null,
            active: f.get("active") === "on",
          }),
        );
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-sm font-semibold">{editing ? `${editing.code} düzenle` : "Yeni kupon"}</h2>
        <select
          className="input !min-h-9 !w-auto !py-1 text-xs"
          value={editing?.id ?? ""}
          onChange={(e) => {
            const c = coupons.find((x) => x.id === e.target.value) ?? null;
            setEditing(c);
            setType(c?.type ?? "percent");
          }}
          aria-label="Düzenlenecek kupon"
        >
          <option value="">+ Yeni</option>
          {coupons.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="code">Kod</label>
        <input id="code" name="code" className="input font-mono uppercase" defaultValue={editing?.code} required pattern="[A-Za-z0-9]{3,24}" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="ctype">Tür</label>
          <select id="ctype" className="input" value={type} onChange={(e) => setType(e.target.value as "percent" | "fixed")}>
            <option value="percent">Yüzde (%)</option>
            <option value="fixed">Tutar (TL)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="value">{type === "percent" ? "Yüzde" : "Tutar (TL)"}</label>
          <input id="value" name="value" inputMode="decimal" className="input" required defaultValue={editing ? (editing.type === "percent" ? editing.value : editing.value / 100) : ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="minSubtotal">Min. sepet (TL)</label>
          <input id="minSubtotal" name="minSubtotal" inputMode="decimal" className="input" defaultValue={editing ? editing.minSubtotal / 100 : ""} />
        </div>
        <div>
          <label className="label" htmlFor="usageLimit">Kullanım limiti</label>
          <input id="usageLimit" name="usageLimit" type="number" min={1} className="input" defaultValue={editing?.usageLimit ?? ""} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="endsAt">Bitiş tarihi</label>
        <input id="endsAt" name="endsAt" type="date" className="input" defaultValue={editing?.endsAt?.slice(0, 10) ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={editing?.active ?? true} className="h-4 w-4 accent-ink" /> Aktif</label>
      <button className="btn-primary w-full" disabled={pending}>Kaydet</button>
      <Flash msg={msg} />
    </form>
  );
}
