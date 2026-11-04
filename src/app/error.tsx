"use client";
import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl">Bir şeyler ters gitti</h1>
      <p className="text-ink-soft">Lütfen tekrar deneyin. Sorun sürerse WhatsApp hattımızdan bize ulaşın.</p>
      <div className="flex gap-2">
        <button onClick={reset} className="btn-primary">Tekrar dene</button>
        <Link href="/" className="btn-outline">Ana sayfa</Link>
      </div>
    </div>
  );
}
