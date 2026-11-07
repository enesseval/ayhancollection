"use client";
import { useEffect, useMemo, useRef } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from "lucide-react";

// Yeni ürün sayfasında görseller ürün kaydedilmeden seçilir; "Kaydet" ile ürün oluşturulur
// ve görseller hemen ardından yüklenir.
export function PendingImages({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-sans text-sm font-semibold">Görseller ({files.length}/12)</h2>
          <p className="text-xs text-muted">Seçtiğiniz görseller ürün kaydedilince yüklenir. İlk görsel kapak olur. Yayına almak için en az 1 görsel gerekir.</p>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            onChange([...files, ...picked].slice(0, 12));
            e.target.value = "";
          }}
        />
        <button type="button" className="btn-primary !min-h-10" disabled={files.length >= 12} onClick={() => input.current?.click()}>
          <ImagePlus className="h-4 w-4" /> Görsel seç
        </button>
      </div>
      {files.length === 0 ? (
        <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-2 rounded border border-dashed border-line py-10 text-sm text-muted hover:border-ink">
          <ImagePlus className="h-6 w-6" /> Görsel seçmek için dokunun
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {files.map((f, i) => (
            <div key={urls[i]} className="relative overflow-hidden rounded border border-line bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element -- yerel önizleme (blob:) */}
              <img src={urls[i]} alt={f.name} className="aspect-[4/5] w-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold">KAPAK</span>}
              <div className="absolute right-1 top-1 flex flex-col gap-1">
                <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="rounded bg-white/95 p-1 text-danger" aria-label="Görseli kaldır"><Trash2 className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded bg-white/95 p-1 disabled:opacity-40" aria-label="Öne al"><ArrowLeft className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === files.length - 1} className="rounded bg-white/95 p-1 disabled:opacity-40" aria-label="Arkaya al"><ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
