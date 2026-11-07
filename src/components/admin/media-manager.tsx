"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Trash2, Upload } from "lucide-react";
import { removeMedia, reorderMedia } from "@/app/actions/admin";
import type { Media } from "@/lib/types";

/**
 * Taraycıda ön sıkıştırma: telefondan gelen 8-12 MB'lık fotoğrafı uzun kenarı 2000 px,
 * JPEG %85 kaliteye indirir (~0,5-1 MB). Böylece Vercel'in 4,5 MB gövde limitine takılmaz,
 * yükleme mobil veride hızlı olur. Asıl WebP boyutları sunucuda üretilir.
 */
export async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.85));
  } catch {
    return file; // tarayıcı çözemezse (ör. HEIC) orijinali gönder
  }
}

/** Tek görseli sıkıştırıp ürüne yükler; hata varsa mesajını döndürür */
export async function uploadProductImage(productId: string, file: File, opts: { color?: string; focalY?: string } = {}): Promise<string | null> {
  const blob = await compress(file);
  if (blob.size > 4 * 1024 * 1024) return `${file.name}: dosya sıkıştırıldıktan sonra da 4 MB'tan büyük`;
  const fd = new FormData();
  fd.append("file", new File([blob], "upload.jpg", { type: blob.type || "image/jpeg" }));
  fd.append("productId", productId);
  fd.append("color", opts.color ?? "");
  fd.append("focalY", opts.focalY ?? "0.4");
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  if (res.ok) return null;
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  return j.error ?? "Yükleme başarısız";
}

export function MediaManager({ productId, productName, media, colors }: { productId: string; productName: string; media: Media[]; colors: string[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [color, setColor] = useState<string>("");
  const [focus, setFocus] = useState("0.4");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, 12 - media.length);
    for (let i = 0; i < list.length; i++) {
      setBusy(`Yükleniyor ${i + 1}/${list.length}…`);
      const err = await uploadProductImage(productId, list[i], { color, focalY: focus });
      if (err) setError(err);
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const keys = media.map((m) => m.key);
    const j = idx + dir;
    if (j < 0 || j >= keys.length) return;
    [keys[idx], keys[j]] = [keys[j], keys[idx]];
    setBusy("Sıralanıyor…");
    await reorderMedia(productId, keys);
    setBusy(null);
    router.refresh();
  };

  const del = async (key: string) => {
    if (!confirm("Görsel silinsin mi?")) return;
    setBusy("Siliniyor…");
    const r = await removeMedia(productId, key);
    if (!r.ok) setError(r.error);
    setBusy(null);
    router.refresh();
  };

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-sans text-sm font-semibold">Görseller ({media.length}/12)</h2>
          <p className="text-xs text-muted">Yüklemede 4:5 kırpılır, 4 boyutta WebP üretilir. Veritabanına yalnız dosya anahtarı yazılır.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            <span className="label !mb-1">Renk</span>
            <select className="input !min-h-10 !py-1 text-sm" value={color} onChange={(e) => setColor(e.target.value)}>
              <option value="">Genel</option>
              {colors.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="label !mb-1">Kırpma odağı</span>
            <select className="input !min-h-10 !py-1 text-sm" value={focus} onChange={(e) => setFocus(e.target.value)}>
              <option value="0.25">Üst</option>
              <option value="0.4">Orta-üst</option>
              <option value="0.5">Orta</option>
              <option value="0.7">Alt</option>
            </select>
          </label>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          <button type="button" className="btn-primary !min-h-10" disabled={!!busy || media.length >= 12} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {busy ?? "Görsel yükle"}
          </button>
        </div>
      </div>
      {error && <p className="field-error">{error}</p>}
      {media.length === 0 ? (
        <p className="rounded border border-dashed border-line p-8 text-center text-sm text-muted">Henüz görsel yok. {productName} için fotoğraf yükleyin.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {media.map((m, i) => (
            <li key={m.key} className="group relative bg-sand">
              <Image src={m.key} alt={m.alt} width={240} height={300} sizes="160px" className="aspect-[4/5] w-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 bg-white px-1.5 text-[10px] font-semibold">KAPAK</span>}
              {m.color && <span className="absolute bottom-1 left-1 bg-white/90 px-1.5 text-[10px]">{m.color}</span>}
              <div className="absolute right-1 top-1 flex flex-col gap-1">
                <button type="button" onClick={() => del(m.key)} className="rounded bg-white/90 p-1 text-danger" aria-label="Sil"><Trash2 className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded bg-white/90 p-1 disabled:opacity-30" aria-label="Sola taşı"><ArrowLeft className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === media.length - 1} className="rounded bg-white/90 p-1 disabled:opacity-30" aria-label="Sağa taşı"><ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
