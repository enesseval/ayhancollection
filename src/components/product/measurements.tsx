import { Markdown } from "@/components/markdown";
import { parseMeasurementGroups, parseMeasurementRows, type MeasurementRow } from "@/lib/measurements";

// Mağaza: ürün ölçüleri. Her grup (Üst, Etek…) kendi ara başlığı ve tablosuyla ayrı gösterilir.
// "| Beden 1 | Boy 67 (cm) | …" satırları sütunlu tabloya çevrilir; başka biçimler Markdown olarak kalır.

const tr = (s: string) => s.toLocaleLowerCase("tr-TR");
/** "ÜST" → "Üst", "BEL" → "Bel"; zaten karışık yazılmışsa olduğu gibi bırakır */
function niceCase(s: string) {
  if (s !== s.toLocaleUpperCase("tr-TR")) return s;
  const l = tr(s);
  return l.charAt(0).toLocaleUpperCase("tr-TR") + l.slice(1);
}

function RowsTable({ rows }: { rows: MeasurementRow[] }) {
  // Sütunlar: satırlardaki ölçü adlarının birleşimi (ilk görülme sırası), büyük/küçük harf duyarsız
  const cols: { key: string; label: string }[] = [];
  for (const r of rows) for (const c of r.cells) {
    const key = tr(c.label);
    if (!cols.some((x) => x.key === key)) cols.push({ key, label: niceCase(c.label) });
  }
  // "Beden 1", "Beden 2" → ilk sütun başlığı "Beden", hücreler "1", "2"
  const first = rows.map((r) => r.name.split(/\s+/));
  const common = first.every((w) => w.length > 1 && tr(w[0]) === tr(first[0][0])) ? niceCase(first[0][0]) : "";
  return (
    <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <thead className="border-b border-ink/20">
          <tr>
            <th className="whitespace-nowrap py-2 pr-4 font-medium text-ink">{common || <span className="sr-only">Beden</span>}</th>
            {cols.map((c) => (
              <th key={c.key} className="whitespace-nowrap py-2 pr-4 font-medium text-ink last:pr-0">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <th scope="row" className="whitespace-nowrap border-b border-line py-2 pr-4 font-medium text-ink">
                {common ? r.name.split(/\s+/).slice(1).join(" ") : r.name}
              </th>
              {cols.map((c) => {
                const cell = r.cells.find((x) => tr(x.label) === c.key);
                return (
                  <td key={c.key} className="whitespace-nowrap border-b border-line py-2 pr-4 tabular-nums last:pr-0">
                    {cell ? cell.value ?? "✓" : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Measurements({ text }: { text: string }) {
  const groups = parseMeasurementGroups(text);
  if (!groups.length) return null;
  return (
    <div className="space-y-5 text-sm leading-6 text-ink-soft">
      {groups.map((g, i) => {
        const parsed = parseMeasurementRows(g.body);
        // Ölçü adı olmayan hücreler (örn. "| 38 | 100 |") tabloya çevrilmez, metin olarak kalır
        const usable = parsed && parsed.rows.every((r) => r.cells.every((c) => c.value !== null));
        return (
          <section key={i} aria-label={g.title ? niceCase(g.title) : undefined}>
            {g.title && <h4 className="mb-1.5 font-sans text-sm font-semibold text-ink">{niceCase(g.title)}</h4>}
            {usable ? (
              <>
                <RowsTable rows={parsed.rows} />
                {parsed.notes.length > 0 && <Markdown className="mt-2">{parsed.notes.join("\n")}</Markdown>}
              </>
            ) : (
              <Markdown>{g.body}</Markdown>
            )}
          </section>
        );
      })}
    </div>
  );
}
