"use client";
import { useRef, useState } from "react";
import { Bold, Heading, List, ListOrdered, Table, Eye, Pencil } from "lucide-react";
import { Markdown } from "@/components/markdown";

// Yönetim paneli için Markdown alanı: araç çubuğu + canlı önizleme.
// Kaydedilen değer düz Markdown metnidir; mağazada aynı görüntüleyiciyle gösterilir.

type Props = {
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
  /** "Ölçü tablosu" butonu için varyantlardaki bedenler */
  sizes?: string[];
};

export function MarkdownField({ name, label, defaultValue = "", rows = 5, placeholder, sizes = [] }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  /** Seçili metni sarar ya da imleç konumuna ekler */
  const apply = (fn: (selected: string) => { text: string; select?: [number, number] }) => {
    const el = ta.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const { text, select } = fn(value.slice(start, end));
    const next = value.slice(0, start) + text + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      const [a, b] = select ?? [text.length, text.length];
      el.setSelectionRange(start + a, start + b);
    });
  };

  /** Satır başına ekler (liste/başlık); seçim birden çok satırsa hepsine uygular */
  const linePrefix = (prefix: (i: number) => string, fallback: string) =>
    apply((sel) => {
      const before = value.slice(0, ta.current?.selectionStart ?? 0);
      const needsNewline = before.length > 0 && !before.endsWith("\n");
      const lines = (sel || fallback).split("\n");
      const text = (needsNewline ? "\n" : "") + lines.map((l, i) => prefix(i) + l.replace(/^(#{1,6}\s|[-*+]\s|\d+\.\s)/, "")).join("\n");
      return { text };
    });

  const tableTemplate = () => {
    const list = sizes.length ? sizes : ["38", "40", "42"];
    return [
      "| Beden | Boy (cm) | Göğüs (cm) | Basen (cm) |",
      "| --- | --- | --- | --- |",
      ...list.map((s) => `| ${s} |  |  |  |`),
    ].join("\n");
  };

  const TOOLS = [
    { id: "bold", icon: Bold, title: "Kalın" },
    { id: "heading", icon: Heading, title: "Ara başlık" },
    { id: "ul", icon: List, title: "Madde listesi" },
    { id: "ol", icon: ListOrdered, title: "Numaralı liste" },
    { id: "table", icon: Table, title: "Ölçü tablosu ekle" },
  ] as const;

  function runTool(id: (typeof TOOLS)[number]["id"]) {
    if (id === "bold") return apply((s) => ({ text: `**${s || "kalın yazı"}**`, select: [2, 2 + (s || "kalın yazı").length] }));
    if (id === "heading") return linePrefix(() => "### ", "Ara başlık");
    if (id === "ul") return linePrefix(() => "- ", "Madde");
    if (id === "ol") return linePrefix((i) => `${i + 1}. `, "Madde");
    const before = value.slice(0, ta.current?.selectionStart ?? value.length);
    const pre = before.length === 0 ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    apply(() => ({ text: `${pre}${tableTemplate()}\n` }));
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="label !mb-0" htmlFor={name}>{label}</label>
        <div className="flex rounded border border-line bg-white p-0.5 text-xs">
          <button type="button" onClick={() => setPreview(false)} className={`flex items-center gap-1 rounded px-2 py-1 ${!preview ? "bg-ink text-white" : "hover:bg-canvas"}`}>
            <Pencil className="h-3 w-3" /> Yaz
          </button>
          <button type="button" onClick={() => setPreview(true)} className={`flex items-center gap-1 rounded px-2 py-1 ${preview ? "bg-ink text-white" : "hover:bg-canvas"}`}>
            <Eye className="h-3 w-3" /> Önizle
          </button>
        </div>
      </div>

      {/* Değer her zaman forma gider (önizleme modunda da) */}
      <input type="hidden" name={name} value={value} />

      {preview ? (
        <div className="min-h-24 rounded border border-line bg-canvas p-3">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-muted">Henüz bir şey yazılmadı.</p>}
        </div>
      ) : (
        <div className="rounded border border-line bg-white focus-within:border-ink">
          <div className="flex flex-wrap gap-0.5 border-b border-line p-1" role="toolbar" aria-label={`${label} biçimlendirme`}>
            {TOOLS.map((t) => (
              <button key={t.id} type="button" title={t.title} aria-label={t.title} onClick={() => runTool(t.id)} className="rounded p-1.5 text-ink-soft hover:bg-canvas hover:text-ink">
                <t.icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <textarea
            ref={ta}
            id={name}
            rows={rows}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="block w-full resize-y border-0 bg-transparent p-3 font-mono text-base leading-6 outline-none sm:text-[13px]"
          />
        </div>
      )}
      <p className="mt-1 text-[11px] text-muted">
        <b>**kalın**</b> · <b>### Başlık</b> · <b>- madde</b> · tablo için tablo butonunu kullanın. Önizle ile mağazadaki görünümü kontrol edin.
      </p>
    </div>
  );
}
