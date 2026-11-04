import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { requireAdmin, assertSameOrigin, AdminError } from "@/lib/admin-guard";
import { rateLimit } from "@/lib/rate-limit";
import { storeProductImage } from "@/lib/media/storage";

export const dynamic = "force-dynamic";

// Vercel fonksiyon gövde limiti ~4,5 MB: istemci görseli yüklemeden önce 2000 px / JPEG %85'e sıkıştırır.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"];

export async function POST(req: NextRequest) {
  try {
    await assertSameOrigin();
    const admin = await requireAdmin();
    const rl = await rateLimit("upload", admin.id);
    if (!rl.ok) return NextResponse.json({ error: "Çok fazla yükleme, biraz bekleyin" }, { status: 429 });

    const form = await req.formData();
    const file = form.get("file");
    const productId = String(form.get("productId") ?? "");
    if (!(file instanceof File)) return NextResponse.json({ error: "Dosya yok" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Dosya 4 MB'tan büyük" }, { status: 413 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Yalnız JPEG, PNG, WebP, AVIF veya HEIC" }, { status: 415 });

    const product = await repo.getProductById(productId);
    if (!product) return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
    if (product.media.length >= 12) return NextResponse.json({ error: "Ürün başına en fazla 12 görsel" }, { status: 400 });

    const color = String(form.get("color") ?? "").slice(0, 30) || null;
    const alt = (String(form.get("alt") ?? "").trim() || `${product.name}${color ? " - " + color : ""}`).slice(0, 140);
    const focalX = Number(form.get("focalX") ?? 0.5);
    const focalY = Number(form.get("focalY") ?? 0.4);

    // sharp gerçek içeriği çözümler; uzantı/MIME sahteciliği burada yakalanır
    const media = await storeProductImage(product.id, Buffer.from(await file.arrayBuffer()), { alt, color, focalX, focalY });
    await repo.addProductMedia(product.id, media, admin.id);
    revalidatePath(`/urun/${product.slug}`);
    revalidatePath("/");
    return NextResponse.json({ media });
  } catch (e) {
    if (e instanceof AdminError) return NextResponse.json({ error: e.message }, { status: 403 });
    console.error("[upload]", e);
    return NextResponse.json({ error: "Görsel işlenemedi" }, { status: 400 });
  }
}
