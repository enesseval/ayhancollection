"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveSettings } from "@/app/actions/admin";
import type { BankAccount, Settings } from "@/lib/types";
import { Flash, useAdminAction } from "./order-actions";

export function SettingsForm({ settings }: { settings: Settings }) {
  const { pending, msg, run } = useAdminAction();
  const [banks, setBanks] = useState<BankAccount[]>(settings.bankAccounts);
  return (
    <form
      className="card h-fit space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const tl = (k: string) => Math.round(Number(String(f.get(k) ?? "0").replace(",", ".")) * 100);
        run(() =>
          saveSettings({
            shippingFee: tl("shippingFee"),
            freeShippingThreshold: tl("freeShippingThreshold"),
            whatsapp: String(f.get("whatsapp") ?? "").replace(/\D/g, ""),
            instagram: String(f.get("instagram") ?? "").replace(/^@/, ""),
            announcement: String(f.get("announcement") ?? ""),
            bankAccounts: banks,
          }),
        );
      }}
    >
      <h2 className="font-sans text-sm font-semibold">Mağaza</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="shippingFee">Kargo ücreti (TL)</label>
          <input id="shippingFee" name="shippingFee" inputMode="decimal" className="input" defaultValue={settings.shippingFee / 100} />
        </div>
        <div>
          <label className="label" htmlFor="freeShippingThreshold">Ücretsiz kargo eşiği (TL)</label>
          <input id="freeShippingThreshold" name="freeShippingThreshold" inputMode="decimal" className="input" defaultValue={settings.freeShippingThreshold / 100} />
        </div>
        <div>
          <label className="label" htmlFor="whatsapp">WhatsApp (90…)</label>
          <input id="whatsapp" name="whatsapp" className="input" defaultValue={settings.whatsapp} />
        </div>
        <div>
          <label className="label" htmlFor="instagram">Instagram kullanıcı adı</label>
          <input id="instagram" name="instagram" className="input" defaultValue={settings.instagram} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="announcement">Duyuru çubuğu</label>
        <input id="announcement" name="announcement" maxLength={160} className="input" defaultValue={settings.announcement} />
      </div>
      <h2 className="pt-2 font-sans text-sm font-semibold">Havale/EFT hesapları</h2>
      {banks.map((b, i) => (
        <div key={i} className="grid gap-2 rounded bg-canvas p-3 sm:grid-cols-[1fr_1fr_1.6fr_auto]">
          <input className="input" placeholder="Banka" value={b.bank} onChange={(e) => setBanks((x) => x.map((y, j) => (j === i ? { ...y, bank: e.target.value } : y)))} aria-label="Banka" />
          <input className="input" placeholder="Hesap sahibi" value={b.holder} onChange={(e) => setBanks((x) => x.map((y, j) => (j === i ? { ...y, holder: e.target.value } : y)))} aria-label="Hesap sahibi" />
          <input className="input font-mono" placeholder="TR.." value={b.iban} onChange={(e) => setBanks((x) => x.map((y, j) => (j === i ? { ...y, iban: e.target.value } : y)))} aria-label="IBAN" />
          <button type="button" className="p-2 text-muted hover:text-danger" onClick={() => setBanks((x) => x.filter((_, j) => j !== i))} aria-label="Hesabı sil"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      {banks.length < 4 && (
        <button type="button" className="btn-ghost" onClick={() => setBanks((x) => [...x, { bank: "", holder: "", iban: "" }])}><Plus className="h-4 w-4" /> Hesap ekle</button>
      )}
      <button className="btn-primary w-full" disabled={pending}>Kaydet</button>
      <Flash msg={msg} />
    </form>
  );
}
