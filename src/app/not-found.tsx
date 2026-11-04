import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-4xl">Aradığınız sayfa bulunamadı</h1>
      <p className="text-ink-soft">Ürün yayından kalkmış ya da adres değişmiş olabilir.</p>
      <Link href="/" className="btn-primary">Ana sayfaya dön</Link>
    </div>
  );
}
