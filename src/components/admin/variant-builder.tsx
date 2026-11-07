"use client";
import { useMemo, useState } from "react";
import { Check, Copy, Plus, X } from "lucide-react";
import { PALETTE, colorHexFor, colorKey } from "@/lib/colors";

// Varyant oluşturucu: renk ve beden SEÇİLİR, tablo seçimden otomatik oluşur.
// Ayrı bir "matris oluştur" adımı yok; her renk × beden için bir satır vardır.

export type VariantRow = {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  stock: number;
  priceOverride: string;
};

type Cell = { id: string; sku: string; stock: number; priceOverride: string };
type ColorSel = { name: string; hex: string };

export const SIZE_GROUPS: { label: string; sizes: string[] }[] = [
  { label: "Numara", sizes: ["34", "36", "38", "40", "42", "44", "46", "48", "50", "52", "54"] },
  { label: "Harf", sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"] },
  { label: "Beden no", sizes: ["1", "2", "3", "4", "5", "6"] },
  { label: "Standart", sizes: ["Standart"] },
];

const sizeKey = (s: string) => s.trim().toLocaleUpperCase("tr-TR");
const cellKey = (c: string, s: string) => `${colorKey(c)}|${sizeKey(s)}`;

/** Mevcut varyantlardan başlangıç durumu (eski ürünler düzenlenebilsin) */
export function initVariantState(rows: VariantRow[]) {
  const colors: ColorSel[] = [];
  const sizesByColor: Record<string, string[]> = {};
  const cells: Record<string, Cell> = {};
  for (const r of rows) {
    if (!r.color.trim()) continue;
    const ck = colorKey(r.color);
    if (!colors.some((c) => colorKey(c.name) === ck)) colors.push({ name: r.color.trim(), hex: r.colorHex });
    const list = (sizesByColor[ck] ??= []);
    if (r.size.trim() && !list.some((s) => sizeKey(s) === sizeKey(r.size))) list.push(r.size.trim());
    cells[cellKey(r.color, r.size)] = { id: r.id, sku: r.sku, stock: r.stock, priceOverride: r.priceOverride };
  }
  const all = Object.values(sizesByColor).flat();
  const group = SIZE_GROUPS.findIndex((g) => all.length > 0 && all.every((s) => g.sizes.some((x) => sizeKey(x) === sizeKey(s))));
  return { colors, sizesByColor, cells, group: group >= 0 ? group : 0 };
}

const SIZE_ORDER = SIZE_GROUPS.flatMap((g) => g.sizes).map(sizeKey);
export function sortSizes(list: string[]) {
  return [...list].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(sizeKey(a));
    const ib = SIZE_ORDER.indexOf(sizeKey(b));
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

export function useVariantBuilder(initial: VariantRow[], skuBase: string) {
  const init = useMemo(() => initVariantState(initial), [initial]);
  const [colors, setColors] = useState<ColorSel[]>(init.colors);
  // Her rengin kendi beden listesi (ör. Siyah 36-38, Beyaz 40-44)
  const [sizesByColor, setSizesByColor] = useState<Record<string, string[]>>(init.sizesByColor);
  const [cells, setCells] = useState<Record<string, Cell>>(init.cells);
  const [group, setGroup] = useState(init.group);

  const sizesOf = (color: string) => sortSizes(sizesByColor[colorKey(color)] ?? []);

  const rows: VariantRow[] = colors.flatMap((c, ci) =>
    sizesOf(c.name).map((s, si) => {
      const cell = cells[cellKey(c.name, s)];
      return {
        id: cell?.id ?? "",
        sku: cell?.sku || `${skuBase}-${ci + 1}${String(si + 1).padStart(2, "0")}-${s.replace(/[^A-Z0-9]/gi, "")}`.toUpperCase(),
        size: s,
        color: c.name,
        colorHex: c.hex,
        stock: cell?.stock ?? 0,
        priceOverride: cell?.priceOverride ?? "",
      };
    }),
  );

  /** Bedeni seçilmemiş renk varsa adı (kaydetmeden önce uyarı için) */
  const colorWithoutSize = colors.find((c) => sizesOf(c.name).length === 0)?.name ?? null;
  const allSizes = sortSizes([...new Set(rows.map((r) => r.size))]);

  return { colors, setColors, sizesByColor, setSizesByColor, sizesOf, cells, setCells, group, setGroup, rows, colorWithoutSize, allSizes };
}

export function VariantBuilder({ vb }: { vb: ReturnType<typeof useVariantBuilder> }) {
  const { colors, setColors, setSizesByColor, sizesOf, setCells, group, setGroup, rows } = vb;
  const [newColor, setNewColor] = useState<{ name: string; hex: string } | null>(null);
  const [bulk, setBulk] = useState("");

  const hasColor = (n: string) => colors.some((c) => colorKey(c.name) === colorKey(n));
  const toggleColor = (c: ColorSel) =>
    setColors((list) => (hasColor(c.name) ? list.filter((x) => colorKey(x.name) !== colorKey(c.name)) : [...list, c]));

  const toggleSize = (color: string, size: string) =>
    setSizesByColor((m) => {
      const ck = colorKey(color);
      const list = m[ck] ?? [];
      const has = list.some((x) => sizeKey(x) === sizeKey(size));
      return { ...m, [ck]: has ? list.filter((x) => sizeKey(x) !== sizeKey(size)) : [...list, size] };
    });
  const copySizesToAll = (color: string) =>
    setSizesByColor((m) => {
      const src = m[colorKey(color)] ?? [];
      const next = { ...m };
      for (const c of colors) next[colorKey(c.name)] = [...src];
      return next;
    });

  const setCell = (color: string, size: string, patch: Partial<Cell>) =>
    setCells((m) => {
      const k = cellKey(color, size);
      const row = rows.find((r) => cellKey(r.color, r.size) === k)!;
      const base: Cell = (k in m ? m[k] : undefined) ?? { id: row.id, sku: row.id ? row.sku : "", stock: row.stock, priceOverride: row.priceOverride };
      return { ...m, [k]: { ...base, ...patch } };
    });

  const customColors = colors.filter((c) => !PALETTE.some((p) => colorKey(p.name) === colorKey(c.name)));

  const addCustomColor = () => {
    if (!newColor || !newColor.name.trim()) return;
    const name = newColor.name.trim().replace(/^./, (c) => c.toLocaleUpperCase("tr-TR"));
    if (!hasColor(name)) setColors((l) => [...l, { name, hex: newColor.hex }]);
    setNewColor(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Renkler */}
      <div>
        <p className="label">1. Renk seçin <span className="font-normal text-muted">(birden fazla seçebilirsiniz)</span></p>
        <div className="flex flex-wrap gap-2">
          {[...PALETTE, ...customColors].map((p) => {
            const on = hasColor(p.name);
            const hex = colors.find((c) => colorKey(c.name) === colorKey(p.name))?.hex ?? p.hex;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => toggleColor({ name: p.name, hex })}
                aria-pressed={on}
                className={`flex min-h-9 items-center gap-2 rounded-full border px-2.5 py-1 text-sm transition-colors ${on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}
              >
                <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: hex }} />
                {p.name}
                {on && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
          {newColor ? (
            <span className="flex items-center gap-1.5 rounded-full border border-ink bg-white py-1 pl-1.5 pr-1">
              <input type="color" value={newColor.hex} onChange={(e) => setNewColor({ ...newColor, hex: e.target.value })} className="h-7 w-7 rounded-full border-0 p-0" aria-label="Yeni renk kodu" />
              <input
                autoFocus
                value={newColor.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setNewColor({ name, hex: colorHexFor(name) ?? newColor.hex });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomColor();
                  }
                }}
                placeholder="Renk adı"
                className="w-28 border-0 bg-transparent text-base outline-none sm:text-sm"
              />
              <button type="button" onClick={addCustomColor} className="rounded-full bg-ink px-2.5 py-1 text-xs text-white">Ekle</button>
              <button type="button" onClick={() => setNewColor(null)} aria-label="Vazgeç" className="p-1 text-muted"><X className="h-3.5 w-3.5" /></button>
            </span>
          ) : (
            <button type="button" onClick={() => setNewColor({ name: "", hex: "#888888" })} className="flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-ink/40 px-3 text-sm hover:border-ink">
              <Plus className="h-3.5 w-3.5" /> Yeni renk
            </button>
          )}
        </div>
      </div>

      {/* 2. Her renk için bedenler ve stok */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="label !mb-0">2. Her renk için beden ve stok</p>
          <div className="flex flex-wrap gap-1 rounded bg-canvas p-1 text-xs" role="tablist" aria-label="Beden tipi">
            {SIZE_GROUPS.map((g, i) => (
              <button key={g.label} type="button" role="tab" aria-selected={group === i} onClick={() => setGroup(i)} className={`rounded px-3 py-1.5 ${group === i ? "bg-white font-medium shadow-sm" : "text-muted"}`}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {colors.length === 0 ? (
          <p className="rounded border border-dashed border-line p-4 text-center text-sm text-muted">Önce yukarıdan en az bir renk seçin.</p>
        ) : (
          <div className="space-y-3">
            {colors.map((c) => (
              <ColorCard
                key={c.name}
                color={c}
                groupSizes={SIZE_GROUPS[group].sizes}
                selected={sizesOf(c.name)}
                rows={rows.filter((r) => colorKey(r.color) === colorKey(c.name))}
                multi={colors.length > 1}
                onToggleSize={(s) => toggleSize(c.name, s)}
                onCopyToAll={() => copySizesToAll(c.name)}
                onHex={(hex) => setColors((l) => l.map((x) => (colorKey(x.name) === colorKey(c.name) ? { ...x, hex } : x)))}
                onRemove={() => toggleColor(c)}
                onCell={(s, patch) => setCell(c.name, s, patch)}
              />
            ))}
          </div>
        )}

        {rows.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">Toplam {rows.length} varyant ·</span>
            <input type="number" min={0} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="Adet" className="input !min-h-8 !w-20 !py-1 text-base sm:text-sm" aria-label="Tümüne uygulanacak stok" />
            <button
              type="button"
              className="btn-outline !min-h-8 !px-3 !py-1 text-xs"
              onClick={() => {
                if (bulk === "") return;
                const n = Math.max(0, Math.floor(Number(bulk)));
                for (const r of rows) setCell(r.color, r.size, { stock: n });
              }}
            >
              Tüm bedenlere bu stoğu yaz
            </button>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted">Stoku 0 olan beden mağazada tükendi görünür. Özel fiyat boşsa ürün fiyatı geçerlidir.</p>
      </div>
    </div>
  );
}

function ColorCard({
  color,
  groupSizes,
  selected,
  rows,
  multi,
  onToggleSize,
  onCopyToAll,
  onHex,
  onRemove,
  onCell,
}: {
  color: ColorSel;
  groupSizes: string[];
  selected: string[];
  rows: VariantRow[];
  multi: boolean;
  onToggleSize: (s: string) => void;
  onCopyToAll: () => void;
  onHex: (hex: string) => void;
  onRemove: () => void;
  onCell: (size: string, patch: Partial<Cell>) => void;
}) {
  const [custom, setCustom] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const has = (s: string) => selected.some((x) => sizeKey(x) === sizeKey(s));
  const extra = selected.filter((s) => !groupSizes.some((g) => sizeKey(g) === sizeKey(s)));
  const addCustom = () => {
    const s = custom.trim();
    if (s && !has(s)) onToggleSize(s);
    setCustom("");
  };

  return (
    <div className={`rounded border bg-white p-3 ${selected.length === 0 ? "border-danger/40" : "border-line"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-full border border-black/10" style={{ background: color.hex }} title="Renk tonunu değiştir">
          <input type="color" value={color.hex} onChange={(e) => onHex(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`${color.name} renk tonu`} />
        </label>
        <b className="text-sm">{color.name}</b>
        <span className="text-xs text-muted">{selected.length ? `${selected.length} beden` : "beden seçin"}</span>
        <span className="ml-auto flex items-center gap-1">
          {multi && selected.length > 0 && (
            <button type="button" onClick={onCopyToAll} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-ink-soft hover:bg-canvas" title="Bu bedenleri tüm renklere uygula">
              <Copy className="h-3.5 w-3.5" /> Tüm renklere uygula
            </button>
          )}
          <button type="button" onClick={onRemove} className="rounded p-1 text-muted hover:text-danger" aria-label={`${color.name} rengini kaldır`}>
            <X className="h-4 w-4" />
          </button>
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[...groupSizes, ...extra].map((s) => {
          const on = has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => onToggleSize(s)}
              aria-pressed={on}
              className={`min-h-9 min-w-11 border px-2.5 text-sm transition-colors ${on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}
            >
              {s}
            </button>
          );
        })}
        <span className="flex items-center border border-dashed border-ink/40 pl-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Diğer"
            className="w-20 border-0 bg-transparent py-1.5 text-base outline-none sm:text-sm"
            aria-label={`${color.name} için özel beden`}
          />
          <button type="button" onClick={addCustom} className="px-2 py-1.5" aria-label="Bedeni ekle"><Plus className="h-4 w-4" /></button>
        </span>
      </div>

      {rows.length > 0 && (
        <div className="mt-3">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
            {rows.map((r) => (
              <label key={r.size} className="rounded border border-line p-2 text-xs">
                <span className="mb-1 block font-medium">{r.size}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={r.stock}
                  onChange={(e) => onCell(r.size, { stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  className={`input !min-h-8 !py-1 text-base sm:text-sm ${r.stock === 0 ? "!border-danger/40" : ""}`}
                  aria-label={`${color.name} ${r.size} stok`}
                />
                <span className="mt-0.5 block text-[10px] text-muted">stok</span>
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setAdvanced((v) => !v)} className="mt-2 text-xs text-muted underline underline-offset-2">
            {advanced ? "Özel fiyat ve SKU'yu gizle" : "Özel fiyat / SKU düzenle"}
          </button>
          {advanced && (
            <div className="mt-2 space-y-1.5">
              {rows.map((r) => (
                <div key={r.size} className="grid grid-cols-[3.5rem_1fr_1.4fr] items-center gap-2 text-xs">
                  <span className="font-medium">{r.size}</span>
                  <input
                    inputMode="decimal"
                    value={r.priceOverride}
                    placeholder="Özel fiyat"
                    onChange={(e) => onCell(r.size, { priceOverride: e.target.value })}
                    className="input !min-h-8 !py-1 text-base sm:text-sm"
                    aria-label={`${color.name} ${r.size} özel fiyat`}
                  />
                  <input
                    value={r.sku}
                    onChange={(e) => onCell(r.size, { sku: e.target.value.toUpperCase() })}
                    className="input !min-h-8 !py-1 font-mono text-base sm:text-xs"
                    aria-label={`${color.name} ${r.size} SKU`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
