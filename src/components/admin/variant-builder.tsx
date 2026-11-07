"use client";
import { useMemo, useState } from "react";
import { Check, Grid3x3, Plus, X } from "lucide-react";
import { PALETTE, colorHexFor, colorKey } from "@/lib/colors";

// Varyant oluşturucu (matris): renkler ve bedenler hazır listeden SEÇİLİR,
// "Matris oluştur" ile renk × beden tablosu oluşur. Her hücre bir varyanttır:
// hücre boşsa o renkte o beden yoktur, sayı yazılıysa o kadar stok vardır (0 = tükendi).

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
    if (!r.color.trim() || !r.size.trim()) continue;
    if (!colors.some((c) => colorKey(c.name) === colorKey(r.color))) colors.push({ name: r.color.trim(), hex: r.colorHex });
    if (!sizes.some((s) => sizeKey(s) === sizeKey(r.size))) sizes.push(r.size.trim());
    cells[cellKey(r.color, r.size)] = { id: r.id, sku: r.sku, stock: r.stock, priceOverride: r.priceOverride };
  }
  const group = SIZE_GROUPS.findIndex((g) => sizes.length > 0 && sizes.every((s) => g.sizes.some((x) => sizeKey(x) === sizeKey(s))));
  return { colors, sizes, cells, group: group >= 0 ? group : 0 };
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
  const [sizes, setSizes] = useState<string[]>(init.sizes);
  // Matristeki dolu hücreler; anahtarı olmayan hücre = o renkte o beden yok
  const [cells, setCells] = useState<Record<string, Cell>>(init.cells);
  const [group, setGroup] = useState(init.group);

  const orderedSizes = useMemo(() => sortSizes(sizes), [sizes]);

  const rows: VariantRow[] = colors.flatMap((c, ci) =>
    orderedSizes.flatMap((s, si) => {
      const cell = cells[cellKey(c.name, s)];
      if (!cell) return [];
      return [
        {
          id: cell.id,
          sku: cell.sku || `${skuBase}-${ci + 1}${String(si + 1).padStart(2, "0")}-${s.replace(/[^A-Z0-9]/gi, "")}`.toUpperCase(),
          size: s,
          color: c.name,
          colorHex: c.hex,
          stock: cell.stock,
          priceOverride: cell.priceOverride,
        },
      ];
    }),
  );

  /** Matriste hiç bedeni olmayan renk (kaydetmeden önce uyarı için) */
  const colorWithoutSize = colors.find((c) => !rows.some((r) => colorKey(r.color) === colorKey(c.name)))?.name ?? null;
  const allSizes = sortSizes([...new Set(rows.map((r) => r.size))]);

  return { colors, setColors, sizes, setSizes, orderedSizes, cells, setCells, group, setGroup, rows, colorWithoutSize, allSizes };
}

export function VariantBuilder({ vb }: { vb: ReturnType<typeof useVariantBuilder> }) {
  const { colors, setColors, sizes, setSizes, orderedSizes, cells, setCells, group, setGroup, rows } = vb;
  const [newColor, setNewColor] = useState<{ name: string; hex: string } | null>(null);
  const [customSize, setCustomSize] = useState("");
  const [defaultStock, setDefaultStock] = useState("1");
  const [note, setNote] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);

  const hasColor = (n: string) => colors.some((c) => colorKey(c.name) === colorKey(n));
  const toggleColor = (c: ColorSel) =>
    setColors((list) => (hasColor(c.name) ? list.filter((x) => colorKey(x.name) !== colorKey(c.name)) : [...list, c]));
  const hasSize = (s: string) => sizes.some((x) => sizeKey(x) === sizeKey(s));
  const toggleSize = (s: string) => setSizes((list) => (hasSize(s) ? list.filter((x) => sizeKey(x) !== sizeKey(s)) : [...list, s]));

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

  /** Seçili tüm renk × beden kombinasyonlarını oluşturur; dolu hücrelere dokunmaz */
  const buildMatrix = () => {
    if (colors.length === 0 || sizes.length === 0) {
      setNote(colors.length === 0 ? "Önce en az bir renk seçin." : "Önce en az bir beden seçin.");
      return;
    }
    const n = Math.max(0, Math.floor(Number(defaultStock) || 0));
    const next = { ...cells };
    let added = 0;
    for (const c of colors)
      for (const s of sizes) {
        const k = cellKey(c.name, s);
        if (!next[k]) {
          next[k] = { id: "", sku: "", stock: n, priceOverride: "" };
          added++;
        }
      }
    setCells(next);
    setNote(
      added
        ? `${colors.length} renk × ${sizes.length} beden matrisi hazır (${added} yeni hücre). Olmayan bedenlerin kutusunu boşaltın.`
        : "Matris zaten dolu; yeni renk veya beden eklerseniz tekrar basın.",
    );
  };

  const setCellValue = (color: string, size: string, raw: string) =>
    setCells((m) => {
      const k = cellKey(color, size);
      // Boş bırakılan hücre = bu renkte bu beden yok
      if (raw.trim() === "") {
        const next = { ...m };
        delete next[k];
        return next;
      }
      const stock = Math.max(0, Math.floor(Number(raw) || 0));
      return { ...m, [k]: { ...(m[k] ?? { id: "", sku: "", priceOverride: "" }), stock } };
    });
  const patchCell = (color: string, size: string, patch: Partial<Cell>) =>
    setCells((m) => {
      const k = cellKey(color, size);
      return m[k] ? { ...m, [k]: { ...m[k], ...patch } } : m;
    });

  return (
    <div className="space-y-6">
      {/* 1. Renkler */}
      <div>
        <p className="label">1. Renkler <span className="font-normal text-muted">(birden fazla seçebilirsiniz)</span></p>
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

      {/* 2. Bedenler */}
      <div>
        <p className="label">2. Bedenler <span className="font-normal text-muted">(üründe olan tüm bedenleri seçin)</span></p>
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

      {/* 3. Matris */}
      <div>
        <div className="mb-2 flex flex-wrap items-end gap-2">
          <p className="label !mb-0 mr-auto">3. Stok matrisi</p>
          <label className="flex items-center gap-2 text-xs text-muted">
            Her hücreye stok
            <input type="number" min={0} value={defaultStock} onChange={(e) => setDefaultStock(e.target.value)} className="input !min-h-9 !w-20 !py-1 text-base sm:text-sm" aria-label="Matris için varsayılan stok" />
          </label>
          <button type="button" onClick={buildMatrix} className="btn-outline !min-h-9">
            <Grid3x3 className="h-4 w-4" /> Matris oluştur
          </button>
        </div>
        {note && <p className="mb-2 text-xs text-ink-soft" role="status">{note}</p>}

        {colors.length === 0 || orderedSizes.length === 0 ? (
          <p className="rounded border border-dashed border-line p-4 text-center text-sm text-muted">Renk ve beden seçip “Matris oluştur”a basın.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-line">
            <table className="text-sm">
              <thead className="bg-canvas text-xs text-muted">
                <tr>
                  <th className="sticky left-0 z-10 bg-canvas px-3 py-2 text-left font-medium">Renk \ Beden</th>
                  {orderedSizes.map((s) => (
                    <th key={s} className="min-w-16 px-1.5 py-2 text-center font-medium">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colors.map((c) => {
                  const empty = !orderedSizes.some((s) => cells[cellKey(c.name, s)]);
                  return (
                    <tr key={c.name} className="border-t border-line">
                      <th className={`sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-normal ${empty ? "text-danger" : ""}`}>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <label className="relative h-5 w-5 shrink-0 cursor-pointer overflow-hidden rounded-full border border-black/10" style={{ background: c.hex }} title="Renk tonunu değiştir">
                            <input
                              type="color"
                              value={c.hex}
                              onChange={(e) => setColors((l) => l.map((x) => (colorKey(x.name) === colorKey(c.name) ? { ...x, hex: e.target.value } : x)))}
                              className="absolute inset-0 cursor-pointer opacity-0"
                              aria-label={`${c.name} renk tonu`}
                            />
                          </label>
                          {c.name}
                        </span>
                      </th>
                      {orderedSizes.map((s) => {
                        const cell = cells[cellKey(c.name, s)];
                        return (
                          <td key={s} className="px-1.5 py-1.5 text-center">
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={cell ? cell.stock : ""}
                              placeholder="—"
                              onChange={(e) => setCellValue(c.name, s, e.target.value)}
                              className={`input !min-h-9 !w-16 !px-1 !py-1 text-center text-base sm:text-sm ${
                                !cell ? "!border-dashed !bg-canvas" : cell.stock === 0 ? "!border-danger/40" : ""
                              }`}
                              aria-label={`${c.name} ${s} stok`}
                              title={cell ? "Boşaltırsanız bu renkte bu beden olmaz" : "Bu renkte bu beden yok. Stok yazarak ekleyin."}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted">
          Boş hücre (—) = o renkte o beden yok. 0 = var ama tükendi. Örn. Siyah&apos;ta yalnız 36-38 varsa diğer hücreleri boşaltın.
        </p>

        {rows.length > 0 && (
          <div className="mt-3">
            <button type="button" onClick={() => setAdvanced((v) => !v)} className="text-xs text-muted underline underline-offset-2">
              {advanced ? "Özel fiyat ve SKU'yu gizle" : `Özel fiyat / SKU düzenle (${rows.length} varyant)`}
            </button>
            {advanced && (
              <div className="mt-2 space-y-1.5">
                {rows.map((r) => (
                  <div key={r.color + r.size} className="grid grid-cols-[minmax(6rem,1fr)_7rem_minmax(8rem,1.4fr)] items-center gap-2 text-xs">
                    <span className="truncate font-medium">{r.color} · {r.size}</span>
                    <input
                      inputMode="decimal"
                      value={r.priceOverride}
                      placeholder="Özel fiyat"
                      onChange={(e) => patchCell(r.color, r.size, { priceOverride: e.target.value })}
                      className="input !min-h-8 !py-1 text-base sm:text-sm"
                      aria-label={`${r.color} ${r.size} özel fiyat`}
                    />
                    <input
                      value={r.sku}
                      onChange={(e) => patchCell(r.color, r.size, { sku: e.target.value.toUpperCase() })}
                      className="input !min-h-8 !py-1 font-mono text-base sm:text-xs"
                      aria-label={`${r.color} ${r.size} SKU`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
