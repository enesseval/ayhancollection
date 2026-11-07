"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { deleteSizeChart, saveSizeChart } from "@/app/actions/admin";
import type { SizeChart } from "@/lib/types";
import { MarkdownField } from "./markdown-field";
import { Flash, useAdminAction } from "./order-actions";

const TEMPLATE = [
  "| Beden | Göğüs (cm) | Bel (cm) | Basen (cm) | Boy (cm) |",
  "| --- | --- | --- | --- | --- |",
  "| 38 |  |  |  |  |",
  "| 40 |  |  |  |  |",
  "| 42 |  |  |  |  |",
  "",
  "Ölçüler ürün düz zeminde serilerek alınmıştır; ±1-2 cm fark olabilir.",
].join("\n");

export function SizeChartManager({ charts }: { charts: SizeChart[] }) {
  const [editing, setEditing] = useState<SizeChart | null>(charts[0] ?? null);
  const [creating, setCreating] = useState(charts.length === 0);
  const { pending, msg, run } = useAdminAction();
  const current = creating ? null : editing;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <div className="card h-fit p-2">
        <ul className="space-y-1">
          {charts.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setEditing(c);
                  setCreating(false);
                }}
                className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${!creating && editing?.id === c.id ? "bg-ink text-white" : "hover:bg-canvas"}`}
              >
                <span className="truncate">{c.name}</span>
                <span className={`ml-2 shrink-0 text-xs ${!creating && editing?.id === c.id ? "text-white/70" : "text-muted"}`}>{c.productCount ?? 0} ürün</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setCreating(true)} className={`mt-1 flex w-full items-center gap-2 rounded px-3 py-2 text-sm ${creating ? "bg-ink text-white" : "hover:bg-canvas"}`}>
          <Plus className="h-4 w-4" /> Yeni tablo
        </button>
      </div>

      <form
        key={current?.id ?? "new"}
        className="card space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(async () => {
            const name = String(f.get("name") ?? "");
            const content = String(f.get("content") ?? "");
            const res = await saveSizeChart({ id: current?.id ?? "", name, content });
            if (res.ok && res.id) {
              setEditing({ id: res.id, name, content, productCount: current?.productCount ?? 0 });
              setCreating(false);
            }
            return res;
          });
        }}
      >
        <div>
          <label className="label" htmlFor="chart-name">Tablo adı</label>
          <input id="chart-name" name="name" className="input" required minLength={2} maxLength={60} defaultValue={current?.name ?? ""} placeholder="Örn. Bluz, Etek, Ferace, Pijama" />
        </div>
        <MarkdownField name="content" label="Tablo" rows={10} defaultValue={current?.content ?? TEMPLATE} />
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={pending}>{pending ? "Kaydediliyor…" : "Kaydet"}</button>
          {current && (
            <button
              type="button"
              className="btn-ghost text-danger"
              disabled={pending}
              onClick={() => {
                const used = current.productCount ?? 0;
                if (!confirm(`"${current.name}" silinsin mi?${used ? ` ${used} üründen kaldırılacak.` : ""}`)) return;
                run(async () => {
                  const res = await deleteSizeChart(current.id);
                  if (res.ok) setEditing(null);
                  return res;
                });
              }}
            >
              <Trash2 className="h-4 w-4" /> Sil
            </button>
          )}
          <Flash msg={msg} />
        </div>
      </form>
    </div>
  );
}
