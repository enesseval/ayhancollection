import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Package, ShoppingBag, Ticket, Settings, ExternalLink, Mail, LogOut, Ruler } from "lucide-react";
import { getAdmin } from "@/lib/auth";
import { isDemoData } from "@/lib/data";
import { features } from "@/lib/env";
import { logoutAction } from "@/app/actions/account";
import { MfaGate } from "@/components/admin/mfa-gate";

export const metadata: Metadata = { title: "Yönetim", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/yonetim", label: "Pano", icon: LayoutDashboard },
  { href: "/yonetim/siparisler", label: "Siparişler", icon: ShoppingBag },
  { href: "/yonetim/urunler", label: "Ürünler", icon: Package },
  { href: "/yonetim/beden-tablolari", label: "Beden tabloları", icon: Ruler },
  { href: "/yonetim/kuponlar", label: "Kuponlar", icon: Ticket },
  { href: "/yonetim/e-postalar", label: "E-postalar", icon: Mail },
  { href: "/yonetim/ayarlar", label: "Ayarlar", icon: Settings },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, needsMfa } = await getAdmin();
  if (!user) redirect("/hesabim?next=/yonetim");
  if (needsMfa) return <MfaGate />;

  return (
    <div className="min-h-dvh bg-[#F5F2EE] lg:grid lg:grid-cols-[230px_1fr]">
      <aside className="border-b border-line bg-white lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center justify-between px-4 lg:h-16">
          <Link href="/yonetim" className="whitespace-nowrap font-serif text-base tracking-[0.12em]">AYŞE AYHAN</Link>
          <span className="rounded bg-sand px-2 py-0.5 text-[10px] font-semibold tracking-wider">YÖNETİM</span>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:pb-0">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="flex shrink-0 items-center gap-2.5 rounded px-3 py-2.5 text-sm hover:bg-canvas">
              <n.icon className="h-4 w-4" strokeWidth={1.6} /> {n.label}
            </Link>
          ))}
          <Link href="/" target="_blank" className="flex shrink-0 items-center gap-2.5 rounded px-3 py-2.5 text-sm text-muted hover:bg-canvas">
            <ExternalLink className="h-4 w-4" strokeWidth={1.6} /> Mağazayı aç
          </Link>
          {/* Mobilde yan panel alt kısmı gizli: çıkış burada */}
          <form action={logoutAction} className="shrink-0 lg:hidden">
            <button className="flex items-center gap-2.5 rounded px-3 py-2.5 text-sm text-muted hover:bg-canvas">
              <LogOut className="h-4 w-4" strokeWidth={1.6} /> Çıkış
            </button>
          </form>
        </nav>
        <div className="hidden px-4 pt-6 text-xs text-muted lg:block">
          <p className="truncate">{user.email}</p>
          <form action={logoutAction}>
            <button className="mt-2 underline">Çıkış yap</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        {(isDemoData || !features.iyzico) && (
          <div className="border-b border-blush bg-blush-soft px-4 py-2 text-xs">
            <b>Demo mod:</b>{" "}
            {[
              isDemoData && "veriler bellekte (Supabase bağlanınca kalıcı olur)",
              !features.iyzico && "ödemeler simülasyon",
              !features.r2 && !features.supabase && "yüklenen görseller geçici",
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
