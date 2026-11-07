import Link from "next/link";

// Marka logosunun SVG yorumu (kelebek çizgi + yazı). Marka sahibinden gelecek vektör logo ile değiştirilebilir.
export function Butterfly({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M32 40 C 31 30 31 18 33 8" />
      <path d="M32.5 22 C 24 6 6 2 4 12 C 2 22 18 26 31.5 25" />
      <path d="M31.5 25 C 18 28 12 40 20 43 C 26 45 30 36 31.8 31" />
      <path d="M33 22 C 40 10 54 8 56 15 C 58 23 46 25 33.2 25.5" />
      <path d="M33 8 C 34 5 36 4 38 4" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2 text-ink">
      <span className="relative inline-flex flex-col items-center leading-none">
        <span className={`font-serif font-semibold tracking-[0.2em] ${compact ? "text-base" : "text-lg sm:text-xl"}`}>
          AYŞE AYHAN
        </span>
        <span className="-mt-0.5 self-end pr-1 font-serif text-[11px] italic tracking-normal text-ink-soft">Collection</span>
        <span className="sr-only"> ana sayfa</span>
        <Butterfly className="pointer-events-none absolute -right-5 -top-3.5 h-5 w-7 text-rose/70 transition-transform duration-300 group-hover:-translate-y-0.5" />
      </span>
    </Link>
  );
}
