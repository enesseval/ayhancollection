import { NextResponse, type NextRequest } from "next/server";
import { features } from "@/lib/env";
import { verifyWebhookSignature } from "@/lib/payments/iyzico";
import { finalizeIyzicoToken } from "@/lib/payments/finalize";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __aacEvents?: Set<string> };

// Yedek kanal: kullanıcı callback'e dönmeden tarayıcıyı kapatsa bile sipariş kesinleşir.
// X-IYZ-SIGNATURE-V3 HMAC-SHA256 ile doğrulanır; işlem idempotenttir.
export async function POST(req: NextRequest) {
  if (!features.iyzico) return new NextResponse(null, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!body) return new NextResponse(null, { status: 400 });
  if (!verifyWebhookSignature(req.headers.get("x-iyz-signature-v3"), body)) {
    console.warn("[iyzico webhook] imza doğrulanamadı");
    return new NextResponse(null, { status: 401 });
  }
  const eventId = `${body.iyziEventType}:${body.iyziPaymentId ?? body.paymentId}:${body.status}`;
  g.__aacEvents ??= new Set();
  if (g.__aacEvents.has(eventId)) return NextResponse.json({ ok: true, duplicate: true });
  g.__aacEvents.add(eventId);

  if (body.token && body.status === "SUCCESS") {
    try {
      await finalizeIyzicoToken(body.token);
    } catch (e) {
      console.error("[iyzico webhook]", e);
      g.__aacEvents.delete(eventId);
      return new NextResponse(null, { status: 500 }); // iyzico tekrar dener
    }
  }
  return NextResponse.json({ ok: true });
}
