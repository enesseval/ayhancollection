import { NextResponse, type NextRequest } from "next/server";
import { memMedia } from "@/lib/media/storage";

export const dynamic = "force-dynamic";

// Yalnız demo modu: R2 bağlanmadan yüklenen görselleri sunucu belleğinden sunar.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const path = key.join("/");
  if (!/^mem\/p\/[0-9a-f-]{36}\/[0-9a-f]{16}-(240|480|960|1600)\.webp$/.test(path)) {
    return new NextResponse(null, { status: 404 });
  }
  const buf = memMedia().get(path);
  if (!buf) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}
