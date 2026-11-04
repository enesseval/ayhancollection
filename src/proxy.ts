import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// - Supabase bağlıysa oturum çerezlerini yeniler (süresi dolan erişim token'ı).
// - /yonetim için oturum çerezi yoksa erken yönlendirme yapar (asıl yetki kontrolü sunucu tarafında).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let hasSession = !!request.cookies.get("aac_session");

  if (url && key && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    hasSession = !!data.user;
  }

  if (request.nextUrl.pathname.startsWith("/yonetim") && !hasSession) {
    const to = request.nextUrl.clone();
    to.pathname = "/hesabim";
    to.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|media/|api/media|favicon.ico|robots.txt|sitemap.xml).*)"],
};
