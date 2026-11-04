import "server-only";
import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, features } from "../env";
import { processImage } from "./process";
import type { Media } from "../types";

// Görsel depolama sürücüsü (öncelik sırası):
// - R2 anahtarları varsa: Cloudflare R2.
// - Supabase bağlıysa: Supabase Storage "media" bucket'ı (public okuma, yazma yalnız service role).
// - İkisi de yoksa (demo): sunucu belleği; /api/media üzerinden sunulur, sunucu yeniden başlayınca silinir.
// Her durumda dosyalar içerik hash'li adla ve 1 yıllık immutable önbellekle yazılır.
// Veritabanına hiçbir zaman görsel byte'ı yazılmaz; yalnız anahtar + boyut + thumbhash.

const g = globalThis as unknown as { __aacMem?: Map<string, Buffer>; __aacS3?: S3Client; __aacSb?: SupabaseClient };
export const STORAGE_BUCKET = "media";
const WIDTHS = [240, 480, 960, 1600];

function sbStorage() {
  g.__aacSb ??= createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return g.__aacSb.storage.from(STORAGE_BUCKET);
}

export function memMedia() {
  g.__aacMem ??= new Map();
  return g.__aacMem;
}

function s3() {
  g.__aacS3 ??= new S3Client({
    region: "auto",
    endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.r2AccessKeyId, secretAccessKey: env.r2SecretAccessKey },
  });
  return g.__aacS3;
}

export async function storeProductImage(
  productId: string,
  input: Buffer,
  meta: { alt: string; color: string | null; focalX?: number; focalY?: number },
): Promise<Media> {
  const processed = await processImage(input, { focalX: meta.focalX, focalY: meta.focalY });
  const hash = createHash("sha256").update(processed.files[processed.files.length - 1].buffer).digest("hex").slice(0, 16);
  const baseKey = `p/${productId}/${hash}`;

  if (features.r2) {
    await Promise.all(
      processed.files.map((f) =>
        s3().send(
          new PutObjectCommand({
            Bucket: env.r2Bucket,
            Key: `${baseKey}-${f.width}.webp`,
            Body: f.buffer,
            ContentType: "image/webp",
            CacheControl: "public, max-age=31536000, immutable",
          }),
        ),
      ),
    );
    return { key: baseKey, width: processed.width, height: processed.height, thumbhash: processed.thumbhash, alt: meta.alt, color: meta.color };
  }

  if (features.supabase) {
    // Küçük kaynak görselde eksik büyük boyutlar en büyük mevcut dosyayla doldurulur (URL'ler her zaman çözülsün)
    for (const w of WIDTHS) {
      const f = processed.files.find((x) => x.width >= w) ?? processed.files[processed.files.length - 1];
      const { error } = await sbStorage().upload(`${baseKey}-${w}.webp`, f.buffer, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true,
      });
      if (error) throw new Error("Görsel yüklenemedi: " + error.message);
    }
    return { key: baseKey, width: processed.width, height: processed.height, thumbhash: processed.thumbhash, alt: meta.alt, color: meta.color };
  }

  const mem = memMedia();
  const key = `mem/${baseKey}`;
  // Boyut eksikse (küçük kaynak görsel) en büyük mevcut boyutu tüm geniş isteklere ver
  const widths = [240, 480, 960, 1600];
  for (const w of widths) {
    const f = processed.files.find((x) => x.width >= w) ?? processed.files[processed.files.length - 1];
    mem.set(`${key}-${w}.webp`, f.buffer);
  }
  return { key, width: processed.width, height: processed.height, thumbhash: processed.thumbhash, alt: meta.alt, color: meta.color };
}

export async function deleteProductImage(key: string) {
  if (key.startsWith("seed/")) return;
  if (key.startsWith("mem/")) {
    for (const w of [240, 480, 960, 1600]) memMedia().delete(`${key}-${w}.webp`);
    return;
  }
  if (!features.r2 && features.supabase) {
    await sbStorage().remove(WIDTHS.map((w) => `${key}-${w}.webp`));
    return;
  }
  if (features.r2) {
    await s3().send(
      new DeleteObjectsCommand({
        Bucket: env.r2Bucket,
        Delete: { Objects: [240, 480, 960, 1600].map((w) => ({ Key: `${key}-${w}.webp` })) },
      }),
    );
  }
}
