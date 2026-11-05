import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { scryptSync, randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { env, features, sessionSecretBytes } from "./env";
import type { SessionUser } from "./types";

// İki sürücü:
// - Supabase bağlıysa: Supabase Auth (HttpOnly cookie, @supabase/ssr). Admin rolü JWT app_metadata.role'da,
//   admin için TOTP MFA (aal2) zorunlu.
// - Demo modda: imzalı (HS256) HttpOnly oturum çerezi, bellek içi kullanıcılar.

export const SESSION_COOKIE = "aac_session";
export const DEMO_PASSWORD_DEFAULT = "AyseAyhan-Demo-2026";

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// ─────────────── Supabase istemcisi (anon key + kullanıcı çerezi) ───────────────
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Component içinden çağrıldığında set edilemez; proxy oturumu yeniler.
        }
      },
    },
  });
}

// ─────────────── Demo kullanıcı deposu ───────────────
type DemoUser = SessionUser & { salt: string; hash: string };
const g = globalThis as unknown as { __aacUsers?: Map<string, DemoUser> };

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

function demoUsers(): Map<string, DemoUser> {
  if (!g.__aacUsers) {
    const pw = env.demoAdminPassword || DEMO_PASSWORD_DEFAULT;
    const m = new Map<string, DemoUser>();
    const add = (email: string, fullName: string, role: SessionUser["role"], id: string) =>
      m.set(email, { id, email, fullName, role, ...hashPassword(pw) });
    add(env.demoAdminEmail, "Ayşe Ayhan (Yönetici)", "admin", "00000000-0000-4000-a000-00000000ad01");
    add("musteri@ayseayhan.demo", "Demo Müşteri", "customer", "00000000-0000-4000-a000-00000000c001");
    g.__aacUsers = m;
  }
  return g.__aacUsers;
}

async function signSession(u: SessionUser) {
  const ttl = u.role === "admin" ? "8h" : "14d";
  return new SignJWT({ email: u.email, name: u.fullName, role: u.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(u.id)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .setAudience("aac")
    .sign(sessionSecretBytes());
}

// ─────────────── Ortak API ───────────────
export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string; pendingConfirmation?: boolean; /** şifre hatası değil, sistem kaynaklı */ systemError?: boolean };

export async function getSessionUser(): Promise<SessionUser | null> {
  if (features.supabase) {
    const sb = await supabaseServer();
    const { data } = await sb.auth.getUser(); // sunucuda doğrulanır; getSession'a güvenilmez
    if (!data.user) return null;
    const role = data.user.app_metadata?.role === "admin" ? "admin" : "customer";
    return {
      id: data.user.id,
      email: (data.user.email ?? "").toLowerCase(),
      fullName: (data.user.user_metadata?.full_name as string) ?? "",
      role,
    };
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecretBytes(), { audience: "aac", algorithms: ["HS256"] });
    return {
      id: String(payload.sub),
      email: String(payload.email),
      fullName: String(payload.name ?? ""),
      role: payload.role === "admin" ? "admin" : "customer",
    };
  } catch {
    return null;
  }
}

/**
 * Admin oturumu. İki adımlı doğrulama (TOTP) varsayılan olarak KAPALI;
 * ADMIN_REQUIRE_MFA=true ortam değişkeniyle Supabase modunda zorunlu hale getirilebilir.
 */
export async function getAdmin(): Promise<{ user: SessionUser | null; needsMfa: boolean }> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return { user: null, needsMfa: false };
  if (features.supabase && env.adminRequireMfa) {
    const sb = await supabaseServer();
    const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== "aal2") return { user, needsMfa: true };
  }
  return { user, needsMfa: false };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  if (features.supabase) {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    // Sistem kaynaklı hatalar hatalı şifre denemesi sayılmaz (kullanıcı haksız yere kilitlenmesin)
    if (error && ["email_provider_disabled", "over_request_rate_limit", "unexpected_failure"].includes(error.code ?? "")) {
      console.error("[auth] signIn", error.code);
      return { ok: false, systemError: true, error: "Giriş şu an yapılamıyor. Lütfen biraz sonra tekrar deneyin." };
    }
    // Doğrulanmamış hesap: şifre doğru olduğunda döner, hesap varlığını sızdırmaz
    if (error?.code === "email_not_confirmed")
      return { ok: false, error: "E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzdaki bağlantıya tıklayın." };
    if (error || !data.user) return { ok: false, error: "E-posta veya şifre hatalı" };
    const role = data.user.app_metadata?.role === "admin" ? "admin" : "customer";
    return {
      ok: true,
      user: { id: data.user.id, email, fullName: (data.user.user_metadata?.full_name as string) ?? "", role },
    };
  }
  const u = demoUsers().get(email);
  // Kullanıcı yoksa da hash hesapla (zamanlama farkıyla e-posta tespitini önle)
  const { hash } = hashPassword(password, u?.salt ?? "0000000000000000");
  if (!u || !timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(u.hash, "hex"))) {
    return { ok: false, error: "E-posta veya şifre hatalı" };
  }
  const user: SessionUser = { id: u.id, email: u.email, fullName: u.fullName, role: u.role };
  (await cookies()).set(SESSION_COOKIE, await signSession(user), {
    ...cookieBase,
    maxAge: user.role === "admin" ? 8 * 3600 : 14 * 86400,
  });
  return { ok: true, user };
}

// Supabase hata kodları → kullanıcıya gösterilecek mesaj
const SIGNUP_ERRORS: Record<string, string> = {
  user_already_exists: "Bu e-posta ile kayıtlı bir hesap var. Giriş yapmayı deneyin.",
  email_exists: "Bu e-posta ile kayıtlı bir hesap var. Giriş yapmayı deneyin.",
  weak_password: "Şifre çok zayıf. Daha uzun ve tahmin edilmesi zor bir şifre seçin.",
  email_address_invalid: "Bu e-posta adresine doğrulama e-postası gönderilemedi. Adresi kontrol edin.",
  email_address_not_authorized: "Doğrulama e-postası şu an gönderilemiyor. Lütfen biraz sonra tekrar deneyin.",
  over_email_send_rate_limit: "Çok fazla kayıt denemesi yapıldı. Lütfen biraz sonra tekrar deneyin.",
  over_request_rate_limit: "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.",
  signup_disabled: "Şu an yeni üyelik alınmıyor.",
  email_provider_disabled: "Şu an yeni üyelik alınmıyor. Üye olmadan sipariş verebilirsiniz.",
};

export async function register(fullName: string, email: string, password: string): Promise<AuthResult> {
  if (features.supabase) {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: `${env.siteUrl}/hesabim` },
    });
    if (error) {
      console.warn("[auth] signUp", error.code, error.status);
      return { ok: false, error: SIGNUP_ERRORS[error.code ?? ""] ?? "Kayıt şu an tamamlanamadı. Lütfen biraz sonra tekrar deneyin." };
    }
    if (!data.session)
      return { ok: false, pendingConfirmation: true, error: "Kaydınız alındı. E-postanıza gönderilen bağlantıya tıklayarak hesabınızı doğrulayın, ardından giriş yapın." };
    return { ok: true, user: { id: data.user!.id, email, fullName, role: "customer" } };
  }
  const users = demoUsers();
  if (users.has(email)) return { ok: false, error: "Bu e-posta ile kayıtlı bir hesap var" };
  const user: SessionUser = { id: randomUUID(), email, fullName, role: "customer" };
  users.set(email, { ...user, ...hashPassword(password) });
  (await cookies()).set(SESSION_COOKIE, await signSession(user), { ...cookieBase, maxAge: 14 * 86400 });
  return { ok: true, user };
}

export async function logout() {
  if (features.supabase) {
    const sb = await supabaseServer();
    await sb.auth.signOut();
  }
  (await cookies()).delete(SESSION_COOKIE);
}
