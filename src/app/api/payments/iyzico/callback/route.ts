import { NextResponse, type NextRequest } from "next/server";
import { env, features } from "@/lib/env";
import { finalizeIyzicoToken } from "@/lib/payments/finalize";
import { orderToken } from "@/lib/order-access";

export const dynamic = "force-dynamic";

// iyzico, 3DS sonrası kullanıcıyı token ile buraya POST eder.
// Gövdedeki değerlere GÜVENİLMEZ: token ile iyzico'dan sunucudan sunucuya sonuç sorgulanır.
export async function POST(req: NextRequest) {
  if (!features.iyzico) return new NextResponse("Not found", { status: 404 });
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  if (!/^[A-Za-z0-9-]{10,100}$/.test(token)) {
    return NextResponse.redirect(`${env.siteUrl}/odeme?hata=odeme`, 303);
  }
  try {
    const res = await finalizeIyzicoToken(token);
    if (res.ok) {
      return NextResponse.redirect(
        `${env.siteUrl}/odeme/sonuc?no=${encodeURIComponent(res.order.orderNo)}&t=${orderToken(res.order.id)}`,
        303,
      );
    }
    console.warn("[iyzico callback] başarısız:", res.reason);
    return NextResponse.redirect(`${env.siteUrl}/odeme?hata=odeme`, 303);
  } catch (e) {
    console.error("[iyzico callback]", e);
    return NextResponse.redirect(`${env.siteUrl}/odeme?hata=odeme`, 303);
  }
}
