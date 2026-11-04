import Link from "next/link";
import { MessageCircle, Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { InstagramIcon as Instagram } from "@/components/icons";
import { Logo } from "@/components/brand/logo";
import type { Settings } from "@/lib/types";

export function TrustBand() {
  const items = [
    { icon: Truck, title: "Türkiye'nin her yerine kargo", text: "1.500 TL üzeri ücretsiz" },
    { icon: RotateCcw, title: "14 gün içinde iade", text: "Koşulsuz cayma hakkı" },
    { icon: ShieldCheck, title: "Güvenli ödeme", text: "3D Secure · iyzico altyapısı" },
  ];
  return (
    <section className="border-y border-line bg-white">
      <div className="container-x grid gap-6 py-8 sm:grid-cols-3">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blush-soft">
              <Icon className="h-5 w-5 text-rose" strokeWidth={1.5} />
            </span>
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-sm text-muted">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Footer({ settings }: { settings: Settings }) {
  const cols = [
    {
      title: "Alışveriş",
      links: [
        ["Yeni Gelenler", "/kategori/yeni"],
        ["Tesettür Giyim", "/kategori/tesettur-giyim"],
        ["Eşarp & Şal", "/kategori/esarp-sal"],
        ["Pijama & Ev Giyim", "/kategori/pijama-ev-giyim"],
        ["Erkek", "/kategori/erkek"],
      ],
    },
    {
      title: "Yardım",
      links: [
        ["Sipariş Takibi", "/siparis-takip"],
        ["İade ve Değişim", "/iade-degisim"],
        ["Kargo ve Teslimat", "/kargo-teslimat"],
        ["Sıkça Sorulan Sorular", "/sss"],
        ["İletişim", "/iletisim"],
      ],
    },
    {
      title: "Kurumsal",
      links: [
        ["Hakkımızda", "/hakkimizda"],
        ["KVKK Aydınlatma Metni", "/kvkk"],
        ["Gizlilik ve Çerez Politikası", "/cerez-politikasi"],
        ["Mesafeli Satış Sözleşmesi", "/mesafeli-satis-sozlesmesi"],
        ["Ön Bilgilendirme Formu", "/on-bilgilendirme-formu"],
        ["Üyelik Sözleşmesi", "/uyelik-sozlesmesi"],
      ],
    },
  ];
  return (
    <footer className="mt-20 border-t border-line bg-sand/50">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-6 text-ink-soft">Yüksek kalite, uygun fiyat. Türkiye&apos;nin her yerine kargo.</p>
          <div className="flex gap-2">
            <a
              href={`https://www.instagram.com/${settings.instagram}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost !px-2.5"
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5" strokeWidth={1.5} />
            </a>
            <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-2.5" aria-label="WhatsApp">
              <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
            </a>
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h2 className="mb-4 font-sans text-xs font-semibold uppercase tracking-[0.18em]">{c.title}</h2>
            <ul className="space-y-2.5 text-sm text-ink-soft">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-rose">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-x flex flex-col gap-3 py-6 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} Ayşe Ayhan Collection · Satıcı bilgileri ve ETBİS kaydı yayından önce eklenecektir.
          </p>
          <p className="flex items-center gap-2">
            <span className="rounded border border-line bg-white px-2 py-1 font-medium">VISA</span>
            <span className="rounded border border-line bg-white px-2 py-1 font-medium">Mastercard</span>
            <span className="rounded border border-line bg-white px-2 py-1 font-medium">TROY</span>
            <span className="rounded border border-line bg-white px-2 py-1 font-medium">iyzico</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
