// Görsel boru hattı: bir kez, yükleme anında çalışır.
// - EXIF/konum verisini atar (sharp varsayılan olarak metadata yazmaz)
// - 4:5 oranına odak noktasına göre kırpar
// - 240 / 480 / 960 / 1600 px genişlikte WebP üretir (kalite 72)
// - ~30 byte'lık ThumbHash bulanık önizleme üretir
// Not: Göreli import kullanılır; seed scripti node ile doğrudan çalıştırır.
import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";

export const MEDIA_WIDTHS = [240, 480, 960, 1600] as const;
export const MEDIA_RATIO = 4 / 5; // genişlik / yükseklik
export const WEBP_QUALITY = 72;
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export type ProcessedImage = {
  width: number;
  height: number;
  thumbhash: string;
  files: { width: number; buffer: Buffer }[];
};

export async function processImage(
  input: Buffer,
  opts: { focalX?: number; focalY?: number } = {},
): Promise<ProcessedImage> {
  const fx = clamp(opts.focalX ?? 0.5);
  const fy = clamp(opts.focalY ?? 0.4);

  // .rotate() EXIF yönünü uygular; çıktıya metadata yazılmaz (withMetadata çağrılmıyor).
  const base = sharp(input, { failOn: "error", limitInputPixels: 60_000_000 }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("Görsel okunamadı");
  if (!["jpeg", "png", "webp", "avif", "heif", "svg"].includes(meta.format ?? "")) {
    throw new Error("Desteklenmeyen görsel türü");
  }

  // EXIF yönü 5-8 ise en/boy yer değiştirir
  const swap = (meta.orientation ?? 1) >= 5;
  const srcW = swap ? meta.height : meta.width;
  const srcH = swap ? meta.width : meta.height;

  // 4:5 kırpma alanı
  let cropW = srcW;
  let cropH = Math.round(srcW / MEDIA_RATIO);
  if (cropH > srcH) {
    cropH = srcH;
    cropW = Math.round(srcH * MEDIA_RATIO);
  }
  const left = Math.round(Math.min(Math.max(fx * srcW - cropW / 2, 0), srcW - cropW));
  const top = Math.round(Math.min(Math.max(fy * srcH - cropH / 2, 0), srcH - cropH));

  const cropped = await base
    .extract({ left, top, width: cropW, height: cropH })
    .toBuffer();

  const widths = MEDIA_WIDTHS.filter((w) => w <= cropW || w === MEDIA_WIDTHS[0]);
  const files = await Promise.all(
    widths.map(async (w) => ({
      width: w,
      buffer: await sharp(cropped)
        .resize({ width: w, height: Math.round(w / MEDIA_RATIO), fit: "cover" })
        .webp({ quality: WEBP_QUALITY, effort: 5, smartSubsample: true })
        .toBuffer(),
    })),
  );

  const small = await sharp(cropped)
    .resize(80, 100, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hash = rgbaToThumbHash(small.info.width, small.info.height, small.data);

  const largest = widths[widths.length - 1];
  return {
    width: largest,
    height: Math.round(largest / MEDIA_RATIO),
    thumbhash: Buffer.from(hash).toString("base64"),
    files,
  };
}

function clamp(n: number) {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));
}
