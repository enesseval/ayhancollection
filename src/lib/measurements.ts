// Ürün ölçüleri: "### Başlık" ile ayrılmış gruplar (örn. Üst, Etek) olarak tek Markdown metninde saklanır.
// Eski kayıtlarda başlıklar düz satır olarak yazılmış olabilir ("ÜST" ardından "| Beden 1 | ..." satırları);
// bunlar da grup başlığı olarak tanınır. Sunucuda ve istemcide kullanılabilir.

export type MeasurementGroup = { title: string; body: string };

const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const isPipeRow = (l: string) => (l.match(/\|/g) ?? []).length >= 2;
const isTableSeparator = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);

/** Başlığa benzeyen düz satır: kısa, çizgisiz ve hemen ardından ölçü satırları geliyor */
function looksLikeLegacyTitle(lines: string[], i: number) {
  const l = lines[i].trim();
  if (!l || l.length > 40 || l.includes("|") || /^[-*+]\s|^\d+\.\s/.test(l)) return false;
  const next = lines.slice(i + 1).find((x) => x.trim());
  return !!next && isPipeRow(next);
}

export function parseMeasurementGroups(md: string): MeasurementGroup[] {
  const lines = (md ?? "").replace(/\r\n?/g, "\n").split("\n");
  const groups: MeasurementGroup[] = [];
  let cur: { title: string; lines: string[] } = { title: "", lines: [] };
  const flush = () => {
    const body = cur.lines.join("\n").replace(/^\n+|\n+$/g, "");
    if (cur.title || body) groups.push({ title: cur.title, body });
  };
  lines.forEach((line, i) => {
    const h = line.match(HEADING);
    const title = h ? h[1].replace(/\*\*/g, "").trim() : looksLikeLegacyTitle(lines, i) ? line.trim() : null;
    if (title !== null) {
      flush();
      cur = { title, lines: [] };
    } else {
      cur.lines.push(line);
    }
  });
  flush();
  return groups;
}

export function serializeMeasurementGroups(groups: MeasurementGroup[]): string {
  return groups
    .map((g) => ({ title: g.title.replace(/[\r\n#]+/g, " ").trim(), body: g.body.replace(/\r\n?/g, "\n").trim() }))
    .filter((g) => g.title || g.body)
    .map((g) => (g.title ? `### ${g.title}\n\n${g.body}` : g.body).trim())
    .join("\n\n");
}

export type MeasurementCell = { label: string; value: string | null };
export type MeasurementRow = { name: string; cells: MeasurementCell[] };

/**
 * "| Beden 1 | Boy 67 (cm) | Göğüs 100 (cm) |" biçimindeki satırları okunur satırlara çevirir.
 * Gövdede gerçek bir Markdown tablosu ya da ölçü satırı olmayan metin varsa null döner (Markdown olarak gösterilir).
 */
export function parseMeasurementRows(body: string): { rows: MeasurementRow[]; notes: string[] } | null {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length || lines.some(isTableSeparator)) return null;
  const rowLines = lines.filter(isPipeRow);
  if (!rowLines.length) return null;
  const notes = lines.filter((l) => !isPipeRow(l));
  const rows = rowLines.map((l) => {
    const parts = l.split("|").map((c) => c.trim()).filter(Boolean);
    const [name = "", ...rest] = parts;
    return {
      name,
      cells: rest.map((c) => {
        const m = c.match(/^(.*?)\s*:?\s*(\d+(?:[.,]\d+)?)\s*\(?\s*(cm|mm|m)?\s*\)?$/i);
        return m && m[1] ? { label: m[1].trim(), value: `${m[2]}${m[3] ? ` ${m[3].toLowerCase()}` : ""}` } : { label: c, value: null };
      }),
    };
  });
  return { rows, notes };
}
