"use client";
import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
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
  const sizes: string[] = [];
  const cells: Record<string, Cell> = {};
  for (const r of rows) {
    if (r.color.trim() && !colors.some((c) => colorKey(c.name) === colorKey(r.color))) colors.push({ name: r.color.trim(), hex: r.colorHex });
    if (r.size.trim() && !sizes.some((s) => sizeKey(s) === sizeKey(r.size))) sizes.push(r.size.trim());
    cells[cellKey(r.color, r.size)] = { id: r.id, sku: r.sku, stock: r.stock, priceOverride: r.priceOverride };
  }
  const group = SIZE_GROUPS.findIndex((g) => sizes.length > 0 && sizes.every((s) => g.sizes.some((x) => sizeKey(x) === sizeKey(s))));
  return { colors, sizes, cells, group: group >= 0 ? group : 0 };
}

export function useVariantBuilder(initial: VariantRow[], skuBase: string) {
  const init = useMemo(() => initVariantState(initial), [initial]);
  const [colors, setColors] = useState<ColorSel[]>(init.colors);
  const [sizes, setSizes] = useState<string[]>(init.sizes);
  const [cells, setCells] = useState<Record<string, Cell>>(init.cells);
  const [group, setGroup] = useState(init.group);

  // Bedenleri grup sırasına göre diz (özel bedenler sonda, eklenme sırasıyla)
  const orderedSizes = useMemo(() => {
    const order = SIZE_GROUPS.flatMap((g) => g.sizes).map(sizeKey);
    return [...sizes].sort((a, b) => {
      const ia = order.indexOf(sizeKey(a));
      const ib = order.indexOf(sizeKey(b));
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  }, [sizes]);

  const rows: VariantRow[] = colors.flatMap((c, ci) =>
    orderedSizes.map((s, si) => {
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

  return { colors, setColors, sizes, setSizes, orderedSizes, cells, setCells, group, setGroup, rows };
}

export function VariantBuilder({ vb }: { vb: ReturnType<typeof useVariantBuilder> }) {
  const { colors, setColors, sizes, setSizes, orderedSizes, setCells, group, setGroup, rows } = vb;
  const [newColor, setNewColor] = useState<{ name: string; hex: string } | null>(null);
  const [customSize, setCustomSize] = useState("");
  const [bulk, setBulk] = useState("");

  const hasColor = (n: string) => colors.some((c) => colorKey(c.name) === colorKey(n));
  const toggleColor = (c: ColorSel) =>
    setColors((list) => (hasColor(c.name) ? list.filter((x) => colorKey(x.name) !== colorKey(c.name)) : [...list, c]));
  const hasSize = (s: string) => sizes.some((x) => sizeKey(x) === sizeKey(s));
  const toggleSize = (s: string) => setSizes((list) => (hasSize(s) ? list.filter((x) => sizeKey(x) !== sizeKey(s)) : [...list, s]));

  const setCell = (color: string, size: string, patch: Partial<Cell>) =>
    setCells((m) => {
      const k = cellKey(color, size);
      const row = rows.find((r) => cellKey(r.color, r.size) === k)!;
      const base: Cell = (k in m ? m[k] : undefined) ?? { id: row.id, sku: row.id ? row.sku : "", stock: row.stock, priceOverride: row.priceOverride };
      return { ...m, [k]: { ...base, ...patch } };
    });

  // Seçili ama paletin dışında kalan (özel) renkler de çip olarak görünsün
  const customColors = colors.filter((c) => !PALETTE.some((p) => colorKey(p.name) === colorKey(c.name)));
  const customSizes = sizes.filter((s) => !SIZE_GROUPS[group].sizes.some((x) => sizeKey(x) === sizeKey(s)));

  const addCustomColor = () => {
    if (!newColor || !newColor.name.trim()) return;
    const name = newColor.name.trim().replace(/^./, (c) => c.toLocaleUpperCase("tr-TR"));
    if (!hasColor(name)) setColors((l) => [...l, { name, hex: newColor.hex }]);
    setNewColor(null);
  };
  const addCustomSize = () => {
    const s = customSize.trim();
    if (s && !hasSize(s)) setSizes((l) => [...l, s]);
    setCustomSize("");
  };

  return (
    <div className="space-y-5">
      {/* 1. Renkler */}
      <div>
        <p className="label">1. Renkler <span className="font-normal text-muted">(en az bir renk seçin)</span></p>
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
        {colors.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
            <span>Seçilen renklerin tonunu ayarlayın:</span>
            {colors.map((c) => (
              <label key={c.name} className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={c.hex}
                  onChange={(e) => setColors((l) => l.map((x) => (colorKey(x.name) === colorKey(c.name) ? { ...x, hex: e.target.value } : x)))}
                  className="h-6 w-6 rounded border border-line p-0"
                  aria-label={`${c.name} renk tonu`}
                />
                {c.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 2. Bedenler */}
      <div>
        <p className="label">2. Bedenler <span className="font-normal text-muted">(en az bir beden seçin)</span></p>
        <div className="mb-2 flex flex-wrap gap-1 rounded bg-canvas p-1 text-xs" role="tablist" aria-label="Beden tipi">
          {SIZE_GROUPS.map((g, i) => (
            <button key={g.label} type="button" role="tab" aria-selected={group === i} onClick={() => setGroup(i)} className={`rounded px-3 py-1.5 ${group === i ? "bg-white font-medium shadow-sm" : "text-muted"}`}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[...SIZE_GROUPS[group].sizes, ...customSizes].map((s) => {
            const on = hasSize(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSize(s)}
                aria-pressed={on}
                className={`min-h-9 min-w-12 border px-3 text-sm transition-colors ${on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}
              >
                {s}
              </button>
            );
          })}
          <span className="flex items-center gap-1 border border-dashed border-ink/40 bg-white pl-2">
            <input
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomSize();
                }
              }}
              placeholder="Diğer (ör. 90x90 cm)"
              className="w-36 border-0 bg-transparent py-1.5 text-base outline-none sm:text-sm"
              aria-label="Özel beden"
            />
            <button type="button" onClick={addCustomSize} className="px-2 py-1.5" aria-label="Bedeni ekle"><Plus className="h-4 w-4" /></button>
          </span>
        </div>
      </div>

      {/* 3. Stok tablosu */}
      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <p className="label !mb-0">3. Stok {rows.length > 0 && <span className="font-normal text-muted">({rows.length} varyant)</span>}</p>
          {rows.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <input type="number" min={0} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="Adet" className="input !min-h-8 !w-20 !py-1 text-base sm:text-sm" aria-label="Tümüne uygulanacak stok" />
              <button
                type="button"
                className="btn-outline !min-h-8 !px-3 !py-1 text-xs"
                onClick={() => {
                  const n = Math.max(0, Math.floor(Number(bulk)));
                  if (!Number.isFinite(n) || bulk === "") return;
                  for (const r of rows) setCell(r.color, r.size, { stock: n });
                }}
              >
                Tümüne uygula
              </button>
            </div>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="rounded border border-dashed border-line p-4 text-center text-sm text-muted">Renk ve beden seçtiğinizde stok tablosu burada oluşur.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-canvas text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Renk / Beden</th>
                  <th className="px-3 py-2 font-medium">Stok</th>
                  <th className="px-3 py-2 font-medium">Özel fiyat (TL)</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                </tr>
              </thead>
              <tbody>
                {colors.map((c) => (
                  <ColorBlock key={c.name} color={c} sizes={orderedSizes} rows={rows} onCell={setCell} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-1 text-[11px] text-muted">
          Stoku 0 olan bedenler mağazada üstü çizili (tükendi) görünür. Özel fiyat boşsa ürün fiyatı geçerlidir.
        </p>
      </div>
    </div>
  );
}

function ColorBlock({
  color,
  sizes,
  rows,
  onCell,
}: {
  color: ColorSel;
  sizes: string[];
  rows: VariantRow[];
  onCell: (color: string, size: string, patch: Partial<Cell>) => void;
}) {
  return (
    <>
      <tr className="border-t border-line bg-white/60">
        <td colSpan={4} className="px-3 py-2 text-xs font-semibold">
          <span className="mr-2 inline-block h-3 w-3 rounded-full border border-black/10 align-[-1px]" style={{ background: color.hex }} />
          {color.name}
        </td>
      </tr>
      {sizes.map((s) => {
        const r = rows.find((x) => colorKey(x.color) === colorKey(color.name) && sizeKey(x.size) === sizeKey(s))!;
        return (
          <tr key={s} className="border-t border-line/60">
            <td className="px-3 py-1.5 pl-8">{s}</td>
            <td className="px-3 py-1.5">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={r.stock}
                onChange={(e) => onCell(color.name, s, { stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                className={`input !min-h-9 !w-24 !py-1 text-base sm:text-sm ${r.stock === 0 ? "!border-danger/40" : ""}`}
                aria-label={`${color.name} ${s} stok`}
              />
            </td>
            <td className="px-3 py-1.5">
              <input
                inputMode="decimal"
                value={r.priceOverride}
                placeholder="—"
                onChange={(e) => onCell(color.name, s, { priceOverride: e.target.value })}
                className="input !min-h-9 !w-28 !py-1 text-base sm:text-sm"
                aria-label={`${color.name} ${s} özel fiyat`}
              />
            </td>
            <td className="px-3 py-1.5">
              <input
                value={r.sku}
                onChange={(e) => onCell(color.name, s, { sku: e.target.value.toUpperCase() })}
                className="input !min-h-9 !w-40 !py-1 font-mono text-base sm:text-xs"
                aria-label={`${color.name} ${s} SKU`}
              />
            </td>
          </tr>
        );
      })}
    </>
  );
}
