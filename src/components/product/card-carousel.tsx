"use client";
import { Children, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Ürün kartında görseller arasında kaydırma (mobilde parmakla, masaüstünde oklarla).
// Görseller sunucuda oluşturulup children olarak gelir; ilk görsel dışındakiler tembel yüklenir.
export function CardCarousel({ children, label, raiseDots = false }: { children: React.ReactNode; label: string; raiseDots?: boolean }) {
  const slides = Children.toArray(children);
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  if (slides.length < 2) return <>{slides}</>;

  const go = (e: React.MouseEvent, dir: number) => {
    // Kart bir bağlantının içinde: okların sayfayı açmasını engelle
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    const next = Math.max(0, Math.min(slides.length - 1, active + dir));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(el.scrollLeft / el.clientWidth));
        }}
        aria-label={`${label} görselleri`}
      >
        {slides.map((s, i) => (
          <div key={i} className="w-full shrink-0 snap-center snap-always">
            {s}
          </div>
        ))}
      </div>

      {/* Masaüstü okları (fareyle üzerine gelince) */}
      {active > 0 && (
        <button
          type="button"
          onClick={(e) => go(e, -1)}
          aria-label="Önceki görsel"
          className="absolute left-1.5 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-white hover:shadow md:block"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {active < slides.length - 1 && (
        <button
          type="button"
          onClick={(e) => go(e, 1)}
          aria-label="Sonraki görsel"
          className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-white hover:shadow md:block"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Nokta göstergesi */}
      <div className={`pointer-events-none absolute inset-x-0 ${raiseDots ? "bottom-9" : "bottom-2"} flex justify-center gap-1`} aria-hidden="true">
        {slides.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full shadow-sm transition-all ${i === active ? "w-4 bg-white" : "w-1.5 bg-white/60"}`} />
        ))}
      </div>
    </div>
  );
}
