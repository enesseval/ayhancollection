import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { repo } from "@/lib/data";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

// Süresi dolan stok rezervlerini serbest bırakır. Vercel Cron, CRON_SECRET'i Bearer olarak gönderir.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.cronSecret}`;
  if (!env.cronSecret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return new NextResponse(null, { status: 401 });
  }
  const released = await repo.releaseExpiredReservations();
  return NextResponse.json({ released });
}
