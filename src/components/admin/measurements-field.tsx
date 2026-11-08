"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { MarkdownField } from "./markdown-field";
import { Measurements } from "@/components/product/measurements";
import { parseMeasurementGroups, serializeMeasurementGroups, type MeasurementGroup } from "@/lib/measurements";

// Ürün ölçüleri: "Ölçüler" ana başlığı altında gruplar (örn. Üst, Etek).
// Her grubun bir ara başlığı ve ölçü metni var; + ile yeni grup eklenir.
// Kaydedilen değer: "### Üst\n\n…\n\n### Etek\n\n…" (Markdown) — mağaza bunu gruplara ayırıp gösterir.

type Row = MeasurementGroup & { key: number };
let seq = 0;

export function MeasurementsField({ defaultValue = "", sizes = [], onChange }: { defaultValue?: string; sizes?: string[]; onChange?: () => void }) {
  const [groups, setGroups] = useState<Row[]>(() => {
    const parsed = parseMeasurementGroups(defaultValue);
    return (parsed.length ? parsed : [{ title: "", body: "" }]).map((g) => ({ ...g, key: seq++ }));
  });
  const value = useMemo(() => serializeMeasurementGroups(groups), [groups]);

  const update = (key: number, patch: Partial<MeasurementGroup>) => {
    setGroups((gs) => gs.map((g) => (g.key === key ? { ...g, ...patch } : g)));
    onChange?.();
  };
  const add = () => {
    const key = seq++;
    setGroups((gs) => [...gs, { title: "", body: "", key }]);
    onChange?.();
    requestAnimationFrame(() => document.getElementById(`mg-title-${key}`)?.focus());
  };
  const remove = (key: number) => {
    const g = groups.find((x) => x.key === key);
    if (g && (g.title.trim() || g.body.trim()) && !confirm(`"${g.title || "Başlıksız"}" ölçü grubu silinsin mi?`)) return;
    const fresh = seq++;
    setGroups((gs) => (gs.length > 1 ? gs.filter((x) => x.key !== key) : [{ title: "", body: "", key: fresh }]));
    onChange?.();
  };
  const move = (i: number, d: -1 | 1) => {
    setGroups((gs) => {
      const j = i + d;
      if (j < 0 || j >= gs.length) return gs;
      const next = [...gs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    onChange?.();
  };

  return (
    <div role="group" aria-labelledby="measurements-label">
      <input type="hidden" name="measurements" value={value} />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span id="measurements-label" className="label !mb-0">Ölçüler</span>
        <button type="button" onClick={add} className="btn-outline !min-h-8 !px-2.5 !py-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Grup ekle
        </button>
      </div>
      <p className="mb-2 text-[11px] text-muted">
        Takım ürünlerde her parça için ayrı grup açın (örn. <b>Üst</b>, <b>Etek</b>). Tek parçalı üründe başlığı boş bırakabilirsiniz.
        Satır biçimi: <span className="font-mono">| Beden 1 | Boy 67 (cm) | Göğüs 100 (cm) |</span>
      </p>
      <div className="space-y-3">
        {groups.map((g, i) => (
          <div key={g.key} className="rounded border border-line bg-canvas/50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <label className="sr-only" htmlFor={`mg-title-${g.key}`}>Grup başlığı</label>
              <input
                id={`mg-title-${g.key}`}
                className="input !min-h-9 flex-1 !py-1.5 font-medium"
                placeholder={groups.length > 1 ? "Başlık (örn. Etek)" : "Başlık (isteğe bağlı, örn. Üst)"}
                value={g.title}
                maxLength={40}
                onChange={(e) => update(g.key, { title: e.target.value })}
              />
              {groups.length > 1 && (
                <>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 text-ink-soft hover:bg-white disabled:opacity-30" aria-label="Yukarı taşı">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === groups.length - 1} className="rounded p-1.5 text-ink-soft hover:bg-white disabled:opacity-30" aria-label="Aşağı taşı">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </>
              )}
              <button type="button" onClick={() => remove(g.key)} className="rounded p-1.5 text-ink-soft hover:bg-white hover:text-danger" aria-label={`${g.title || "Başlıksız"} grubunu sil`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <MarkdownField
              id={`mg-body-${g.key}`}
              label={`${g.title || "Ölçüler"} ölçüleri`}
              hideLabel
              rows={3}
              defaultValue={g.body}
              sizes={sizes}
              onValueChange={(v) => update(g.key, { body: v })}
              renderPreview={(v) => <Measurements text={serializeMeasurementGroups([{ title: g.title, body: v }])} />}
              placeholder={"| Beden 1 | Boy 67 (cm) | Göğüs 100 (cm) |\n| Beden 2 | Boy 67 (cm) | Göğüs 110 (cm) |"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
