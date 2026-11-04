// next/image özel loader'ı: Vercel görsel dönüşümü HİÇ kullanılmaz (ücretsiz kotayı korur).
// src olarak depolama anahtarı verilir; istenen genişliğe en yakın, yüklemede üretilmiş WebP döner.
import { mediaUrl } from "../format";

export default function mediaLoader({ src, width }: { src: string; width: number; quality?: number }) {
  if (src.startsWith("/") || src.startsWith("http") || src.startsWith("data:")) return src;
  return mediaUrl(src, width);
}
