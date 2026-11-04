import Link from "next/link";
import { Lock } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { DemoBar } from "@/components/shop/site-chrome";

// Ödeme akışında dikkat dağıtmayan, yalnız logolu başlık (PRD 6)
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoBar />
      <header className="border-b border-line bg-white">
        <div className="container-x flex h-16 items-center justify-between">
          <Logo compact />
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
            <Lock className="h-3.5 w-3.5" /> Güvenli ödeme
          </span>
        </div>
      </header>
      <main id="icerik" className="min-h-[70dvh] bg-canvas">{children}</main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        <Link href="/sepet" className="underline">Sepete dön</Link> · <Link href="/iade-degisim" className="underline">İade koşulları</Link> ·{" "}
        <Link href="/kvkk" className="underline">KVKK</Link>
      </footer>
    </>
  );
}
