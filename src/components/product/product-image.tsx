import Image from "next/image";
import { thumbHashToAverageRGBA, thumbHashToDataURL } from "thumbhash";
import type { Media } from "@/lib/types";

// Sunucu bileşeni: ThumbHash'i burada data URL'e çevirir (istemciye ~1 KB'lık bulanık önizleme gider).
export function thumbDataUrl(hash: string | null | undefined): string | undefined {
  if (!hash) return undefined;
  try {
    return thumbHashToDataURL(Buffer.from(hash, "base64"));
  } catch {
    return undefined;
  }
}

/** ThumbHash'ten ortalama renk: kartlarda HTML'i şişirmeden yer tutucu (birkaç byte). */
export function thumbAvgColor(hash: string | null | undefined): string | undefined {
  if (!hash) return undefined;
  try {
    const { r, g, b } = thumbHashToAverageRGBA(Buffer.from(hash, "base64"));
    return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
  } catch {
    return undefined;
  }
}

export function ProductImage({
  media,
  sizes,
  preload = false,
  className = "",
}: {
  media: Media | undefined;
  sizes: string;
  preload?: boolean;
  className?: string;
}) {
  if (!media) {
    return <div className={`aspect-[4/5] w-full bg-sand ${className}`} aria-hidden="true" />;
  }
  // Bulanık önizleme yalnız öne yüklenen (LCP) görsellerde; diğerlerinde ortalama renk
  const ph = preload ? thumbDataUrl(media.thumbhash) : undefined;
  return (
    <Image
      src={media.key}
      alt={media.alt}
      width={media.width}
      height={media.height}
      sizes={sizes}
      preload={preload}
      fetchPriority={preload ? "high" : undefined}
      loading={preload ? undefined : "lazy"}
      placeholder={ph ? (ph as `data:image/${string}`) : "empty"}
      style={{ backgroundColor: thumbAvgColor(media.thumbhash) }}
      className={`aspect-[4/5] h-auto w-full object-cover ${className}`}
    />
  );
}
