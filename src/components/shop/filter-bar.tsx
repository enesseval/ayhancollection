"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function FilterBar({ sizes, colors, total }: { sizes: string[]; colors: { name: string; hex: string }[]; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (!value || next.get(key) === value) next.delete(key);
    else next.set(key, value);
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  const active = { beden: sp.get("beden"), renk: sp.get("renk"), sirala: sp.get("sirala") ?? "new" };

  return (
    <div className={`space-y-3 border-y border-line py-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {total} ürün
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Sırala</span>
          <select
            className="input !min-h-9 !w-auto !py-1 text-sm"
            value={active.sirala}
            onChange={(e) => set("sirala", e.target.value === "new" ? null : e.target.value)}
          >
            <option value="new">En yeni</option>
            <option value="popular">Çok satanlar</option>
            <option value="price_asc">Fiyat: artan</option>
            <option value="price_desc">Fiyat: azalan</option>
          </select>
        </label>
      </div>
      {sizes.length > 1 && (
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto" role="group" aria-label="Beden filtresi">
          <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted">Beden</span>
          {sizes.map((s) => (
            <button
              key={s}
              onClick={() => set("beden", s)}
              aria-pressed={active.beden === s}
              className={`min-h-9 shrink-0 border px-3 text-sm ${active.beden === s ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {colors.length > 1 && (
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto" role="group" aria-label="Renk filtresi">
          <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted">Renk</span>
          {colors.map((c) => (
            <button
              key={c.name}
              onClick={() => set("renk", c.name)}
              aria-pressed={active.renk === c.name}
              className={`flex min-h-9 shrink-0 items-center gap-2 border px-3 text-sm ${active.renk === c.name ? "border-ink" : "border-line bg-white hover:border-ink"}`}
            >
              <span className="h-3.5 w-3.5 rounded-full border border-line" style={{ background: c.hex }} />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
