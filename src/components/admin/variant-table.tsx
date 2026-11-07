"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2, Wand2 } from "lucide-react";
import { PALETTE, colorHexFor, colorKey } from "@/lib/colors";

// Varyant tablosu (klasik görünüm): her satır bir renk + beden + stok.
// Renk ve beden serbest metin değil; tanımlı listelerden seçilir:
//  - Renk: hazır renkler + "Yeni renk ekle…" (listenin en altında)
//  - Beden: başlıklı gruplar (Numara / Harf / Beden no / Standart) + "Diğer beden…"
// Üstteki "Matris oluştur" seçilen renk × beden kombinasyonlarını tabloya ekler.

export type VariantRow = {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  stock: number;
  priceOverride: string;
};

type Opt = { name: string; hex: string };

export const SIZE_GROUPS: { label: string; sizes: string[] }[] = [
  { label: "Numara", sizes: ["34", "36", "38", "40", "42", "44", "46", "48", "50", "52", "54"] },
  { label: "Harf", sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"] },
  { label: "Beden no", sizes: ["1", "2", "3", "4", "5", "6"] },
  { label: "Standart", sizes: ["Standart"] },
];
const ALL_PRESET_SIZES = SIZE_GROUPS.flatMap((g) => g.sizes);
const sizeKey = (s: string) => s.trim().toLocaleUpperCase("tr-TR");
const NEW_COLOR = "__yeni_renk__";
const NEW_SIZE = "__yeni_beden__";

export function sortSizes(list: string[]) {
  const order = ALL_PRESET_SIZES.map(sizeKey);
  return [...list].sort((a, b) => {
    const ia = order.indexOf(sizeKey(a));
    const ib = order.indexOf(sizeKey(b));
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

export function useVariantRows(initial: VariantRow[], skuBase: string) {
  const [rows, setRows] = useState<VariantRow[]>(initial);
  // Paletin dışında kalan renkler (eski ürünlerden gelen ya da "Yeni renk" ile eklenen)
  const [customColors, setCustomColors] = useState<Opt[]>(() => {
    const out: Opt[] = [];
    for (const r of initial)
      if (r.color && !PALETTE.some((p) => colorKey(p.name) === colorKey(r.color)) && !out.some((o) => colorKey(o.name) === colorKey(r.color)))
        out.push({ name: r.color, hex: r.colorHex });
    return out;
  });
  const [customSizes, setCustomSizes] = useState<string[]>(() =>
    [...new Set(initial.map((r) => r.size).filter((s) => s && !ALL_PRESET_SIZES.some((x) => sizeKey(x) === sizeKey(s))))],
  );

  const colorOptions = useMemo(() => [...PALETTE, ...customColors], [customColors]);
  const allSizes = sortSizes([...new Set(rows.map((r) => r.size).filter(Boolean))]);
  const incomplete = rows.findIndex((r) => !r.color || !r.size);
  const duplicate = (() => {
    const seen = new Set<string>();
    for (const r of rows) {
      const k = `${colorKey(r.color)}|${sizeKey(r.size)}`;
      if (r.color && r.size && seen.has(k)) return `${r.color} / ${r.size}`;
      seen.add(k);
    }
    return null;
  })();

  const autoSku = (color: string, size: string, i: number) => {
    const ci = colorOptions.findIndex((o) => colorKey(o.name) === colorKey(color)) + 1;
    return `${skuBase}-${ci || i + 1}${String(i + 1).padStart(2, "0")}-${size.replace(/[^A-Z0-9]/gi, "")}`.toUpperCase();
  };

  return { rows, setRows, colorOptions, customColors, setCustomColors, customSizes, setCustomSizes, allSizes, incomplete, duplicate, autoSku };
}

export function VariantTable({ vt }: { vt: ReturnType<typeof useVariantRows> }) {
  const { rows, setRows, colorOptions, setCustomColors, customSizes, setCustomSizes, autoSku } = vt;
  const [mColors, setMColors] = useState<string[]>([]);
  const [mSizes, setMSizes] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  // "Yeni renk / Diğer beden" mini formu: hangi satır (ya da matris: -1) için açık
  const [newColor, setNewColor] = useState<{ row: number; name: string; hex: string } | null>(null);
  const [newSize, setNewSize] = useState<{ row: number; value: string } | null>(null);

  const hexFor = (name: string) =>
    rows.find((r) => colorKey(r.color) === colorKey(name))?.colorHex ??
    colorOptions.find((o) => colorKey(o.name) === colorKey(name))?.hex ??
    colorHexFor(name) ??
    "#888888";

  const update = (i: number, patch: Partial<VariantRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setColor = (i: number, name: string) => {
    const r = rows[i];
    update(i, { color: name, colorHex: hexFor(name), ...(r.id ? {} : { sku: autoSku(name, r.size, i) }) });
  };
  const setSize = (i: number, size: string) => {
    const r = rows[i];
    update(i, { size, ...(r.id ? {} : { sku: autoSku(r.color, size, i) }) });
  };
  // Renk kodu renge aittir: aynı renkteki tüm satırlara uygulanır
  const setHex = (color: string, hex: string) => {
    setRows((r) => r.map((x) => (colorKey(x.color) === colorKey(color) ? { ...x, colorHex: hex } : x)));
    setCustomColors((l) => l.map((o) => (colorKey(o.name) === colorKey(color) ? { ...o, hex } : o)));
  };

  const confirmNewColor = () => {
    if (!newColor) return;
    const name = newColor.name.trim().replace(/^./, (c) => c.toLocaleUpperCase("tr-TR"));
    if (name.length < 2) return;
    if (!colorOptions.some((o) => colorKey(o.name) === colorKey(name))) setCustomColors((l) => [...l, { name, hex: newColor.hex }]);
    if (newColor.row >= 0) update(newColor.row, { color: name, colorHex: newColor.hex });
    else setMColors((l) => (l.includes(name) ? l : [...l, name]));
    setNewColor(null);
  };
  const confirmNewSize = () => {
    if (!newSize) return;
    const s = newSize.value.trim();
    if (!s) return;
    if (!ALL_PRESET_SIZES.concat(customSizes).some((x) => sizeKey(x) === sizeKey(s))) setCustomSizes((l) => [...l, s]);
    if (newSize.row >= 0) setSize(newSize.row, s);
    else setMSizes((l) => (l.includes(s) ? l : [...l, s]));
    setNewSize(null);
  };

  const buildMatrix = () => {
    if (!mColors.length || !mSizes.length) {
      setNote(!mColors.length ? "Matris için en az bir renk işaretleyin." : "Matris için en az bir beden işaretleyin.");
      return;
    }
    const add: VariantRow[] = [];
    for (const c of mColors)
      for (const s of sortSizes(mSizes)) {
        if (rows.some((r) => colorKey(r.color) === colorKey(c) && sizeKey(r.size) === sizeKey(s))) continue;
        add.push({ id: "", color: c, colorHex: hexFor(c), size: s, stock: 0, priceOverride: "", sku: autoSku(c, s, rows.length + add.length) });
      }
    setRows((r) => [...r, ...add]);
    setNote(add.length ? `${add.length} varyant eklendi. Stokları girin; olmayan kombinasyonları silin.` : "Bu kombinasyonların hepsi zaten tabloda.");
  };

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="space-y-4">
      {/* Matris: renk ve bedenleri işaretleyip tabloya toplu ekle */}
      <div className="grid gap-3 rounded bg-canvas p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <CheckDropdown label="Renkler" summary={mColors.length ? mColors.join(", ") : "Renk seçin"}>
          {colorOptions.map((o) => (
            <label key={o.name} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-canvas">
              <input type="checkbox" className="h-4 w-4 accent-ink" checked={mColors.includes(o.name)} onChange={() => setMColors((l) => toggle(l, o.name))} />
              <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: o.hex }} />
              {o.name}
            </label>
          ))}
          <button type="button" onClick={(e) => { e.currentTarget.closest("details")?.removeAttribute("open"); setNewColor({ row: -1, name: "", hex: "#888888" }); }} className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-sm font-medium">
            <Plus className="h-4 w-4" /> Yeni renk ekle…
          </button>
        </CheckDropdown>
        <CheckDropdown label="Bedenler" summary={mSizes.length ? sortSizes(mSizes).join(", ") : "Beden seçin"}>
          {[...SIZE_GROUPS, ...(customSizes.length ? [{ label: "Diğer", sizes: customSizes }] : [])].map((g) => (
            <div key={g.label}>
              <p className="sticky top-0 bg-white px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.label}</p>
              <div className="flex flex-wrap gap-x-1 px-2">
                {g.sizes.map((s) => (
                  <label key={s} className="flex min-w-14 items-center gap-1.5 px-1 py-1 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-ink" checked={mSizes.includes(s)} onChange={() => setMSizes((l) => toggle(l, s))} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button type="button" onClick={(e) => { e.currentTarget.closest("details")?.removeAttribute("open"); setNewSize({ row: -1, value: "" }); }} className="mt-1 flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-sm font-medium">
            <Plus className="h-4 w-4" /> Diğer beden ekle…
          </button>
        </CheckDropdown>
        <button type="button" className="btn-outline" onClick={buildMatrix}><Wand2 className="h-4 w-4" /> Matris oluştur</button>
        {note && <p className="text-xs text-ink-soft sm:col-span-3" role="status">{note}</p>}
      </div>

      {/* Yeni renk / beden mini formları */}
      {newColor && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-ink bg-white p-2">
          <input type="color" value={newColor.hex} onChange={(e) => setNewColor({ ...newColor, hex: e.target.value })} className="h-9 w-10 rounded border border-line" aria-label="Yeni renk kodu" />
          <input
            autoFocus
            className="input !min-h-9 max-w-52 !py-1 text-base sm:text-sm"
            placeholder="Renk adı (ör. Yağ yeşili)"
            value={newColor.name}
            onChange={(e) => setNewColor({ ...newColor, name: e.target.value, hex: colorHexFor(e.target.value) ?? newColor.hex })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmNewColor();
              }
            }}
          />
          <button type="button" className="btn-primary !min-h-9" onClick={confirmNewColor}>Rengi ekle</button>
          <button type="button" className="btn-ghost !min-h-9" onClick={() => setNewColor(null)}>Vazgeç</button>
        </div>
      )}
      {newSize && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-ink bg-white p-2">
          <input
            autoFocus
            className="input !min-h-9 max-w-52 !py-1 text-base sm:text-sm"
            placeholder="Beden (ör. 90x90 cm)"
            value={newSize.value}
            onChange={(e) => setNewSize({ ...newSize, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmNewSize();
              }
            }}
          />
          <button type="button" className="btn-primary !min-h-9" onClick={confirmNewSize}>Bedeni ekle</button>
          <button type="button" className="btn-ghost !min-h-9" onClick={() => setNewSize(null)}>Vazgeç</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-2 pr-2 font-medium">Renk</th>
              <th className="py-2 pr-2 font-medium">Kod</th>
              <th className="py-2 pr-2 font-medium">Beden</th>
              <th className="py-2 pr-2 font-medium">SKU</th>
              <th className="py-2 pr-2 font-medium">Stok</th>
              <th className="py-2 pr-2 font-medium">Özel fiyat (TL)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1.5 pr-2">
                  <select
                    className={`input !min-h-9 !py-1 text-base sm:text-sm ${!r.color ? "!border-danger/50" : ""}`}
                    value={r.color}
                    onChange={(e) => (e.target.value === NEW_COLOR ? setNewColor({ row: i, name: "", hex: "#888888" }) : setColor(i, e.target.value))}
                    aria-label="Renk"
                  >
                    <option value="" disabled>Renk seçin</option>
                    {colorOptions.map((o) => (
                      <option key={o.name} value={o.name}>{o.name}</option>
                    ))}
                    <option value={NEW_COLOR}>＋ Yeni renk ekle…</option>
                  </select>
                </td>
                <td className="py-1.5 pr-2">
                  <input type="color" className="h-9 w-12 rounded border border-line" value={r.colorHex} onChange={(e) => setHex(r.color, e.target.value)} aria-label="Renk kodu" disabled={!r.color} />
                </td>
                <td className="py-1.5 pr-2">
                  <select
                    className={`input !min-h-9 !w-32 !py-1 text-base sm:text-sm ${!r.size ? "!border-danger/50" : ""}`}
                    value={r.size}
                    onChange={(e) => (e.target.value === NEW_SIZE ? setNewSize({ row: i, value: "" }) : setSize(i, e.target.value))}
                    aria-label="Beden"
                  >
                    <option value="" disabled>Beden seçin</option>
                    {SIZE_GROUPS.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.sizes.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </optgroup>
                    ))}
                    {customSizes.length > 0 && (
                      <optgroup label="Diğer">
                        {customSizes.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </optgroup>
                    )}
                    <option value={NEW_SIZE}>＋ Diğer beden ekle…</option>
                  </select>
                </td>
                <td className="py-1.5 pr-2"><input className="input !min-h-9 !py-1 font-mono text-base sm:text-xs" value={r.sku} onChange={(e) => update(i, { sku: e.target.value.toUpperCase() })} aria-label="SKU" /></td>
                <td className="py-1.5 pr-2"><input type="number" min={0} inputMode="numeric" className={`input !min-h-9 !w-24 !py-1 text-base sm:text-sm ${r.stock === 0 ? "!border-danger/40" : ""}`} value={r.stock} onChange={(e) => update(i, { stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} aria-label="Stok" /></td>
                <td className="py-1.5 pr-2"><input inputMode="decimal" className="input !min-h-9 !w-28 !py-1 text-base sm:text-sm" value={r.priceOverride} placeholder="—" onChange={(e) => update(i, { priceOverride: e.target.value })} aria-label="Özel fiyat" /></td>
                <td className="py-1.5"><button type="button" className="p-2 text-muted hover:text-danger" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label="Varyantı sil"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-muted">Üstten renk ve beden işaretleyip “Matris oluştur”a basın ya da tek tek “Varyant ekle” ile ekleyin.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => setRows((r) => [...r, { id: "", sku: "", size: "", color: r[r.length - 1]?.color ?? "", colorHex: r[r.length - 1]?.colorHex ?? "#888888", stock: 0, priceOverride: "" }])}
      >
        <Plus className="h-4 w-4" /> Varyant ekle
      </button>
    </div>
  );
}

/** Açılır onay kutusu listesi (çoklu seçim). Dışarı tıklayınca veya Esc ile kapanır. */
function CheckDropdown({ label, summary, children }: { label: string; summary: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("focusin", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("focusin", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <div>
      <p className="label">{label}</p>
      <details ref={ref} className="group relative">
        <summary className="input flex cursor-pointer list-none items-center justify-between gap-2 !py-2">
          <span className="truncate">{summary}</span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded border border-line bg-white py-1 shadow-lg">{children}</div>
      </details>
    </div>
  );
}
