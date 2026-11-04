import "server-only";
import { headers } from "next/headers";
import { getAdmin } from "./auth";
import { env } from "./env";
import type { SessionUser } from "./types";

export class AdminError extends Error {}

/** Her admin Server Action / Route Handler başında çağrılır (layout kontrolüne güvenilmez). */
export async function requireAdmin(): Promise<SessionUser> {
  const { user, needsMfa } = await getAdmin();
  if (!user) throw new AdminError("Yetkisiz");
  if (needsMfa) throw new AdminError("İki adımlı doğrulama gerekli");
  return user;
}

/** Route Handler'lar için CSRF: Origin başlığı kendi sitemiz olmalı. */
export async function assertSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!origin || !host) throw new AdminError("Geçersiz istek");
  const o = new URL(origin);
  const allowed = new URL(env.siteUrl).host;
  if (o.host !== host && o.host !== allowed) throw new AdminError("Geçersiz kaynak");
}
