"use client";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { Minus, Plus, MessageCircle, Ruler, X, Check } from "lucide-react";
import { formatTRY, waLink } from "@/lib/format";
import { useCart } from "@/components/cart/store";
import type { Product } from "@/lib/types";

type Props = {
  product: Product;
  placeholders: Record<string, string | undefined>;
  whatsapp: string;
  sizeChart: "tesettur" | "pijama" | "esarp" | "erkek";
};

const SIZE_CHARTS: Record<Props["sizeChart"], { head: string[]; rows: string[][]; note: string }> = {
  tesettur: {
    head: ["Beden", "Göğüs (cm)", "Bel (cm)", "Basen (cm)"],
    rows: [
      ["36", "86-90", "68-72", "94-98"],
      ["38", "90-94", "72-76", "98-102"],
      ["40", "94-98", "76-80", "102-106"],
      ["42", "98-104", "80-86", "106-112"],
      ["44", "104-110", "86-92", "112-118"],
      ["46", "110-116", "92-98", "118-124"],
    ],
    note: "İki beden arasında kalırsanız bir büyük bedeni öneririz.",
  },
  pijama: {
    head: ["Beden", "Göğüs (cm)", "Bel (cm)", "Basen (cm)"],
    rows: [
      ["S", "88-92", "70-74", "94-98"],
      ["M", "92-98", "74-80", "98-104"],
      ["L", "98-104", "80-86", "104-110"],
      ["XL", "104-110", "86-92", "110-116"],
      ["2XL", "110-118", "92-100", "116-124"],
    ],
    note: "Pamuklu ürünlerde ilk yıkamada %2-3 çekme olabilir.",
  },
  erkek: {
    head: ["Beden", "Göğüs (cm)", "Boy (cm)"],
    rows: [
      ["S", "94-98", "70"],
      ["M", "98-104", "72"],
      ["L", "104-110", "74"],
      ["XL", "110-116", "76"],
      ["2XL", "116-124", "78"],
    ],
    note: "Ölçüler ürün üzerinden alınmıştır.",
  },
  esarp: { head: ["Ölçü"], rows: [["Ürün açıklamasındaki ölçüleri inceleyin"]], note: "" },
};

export function ProductView({ product, placeholders, whatsapp, sizeChart }: Props) {
  const colors = useMemo(
    () => [...new Map(product.variants.map((v) => [v.color, v.colorHex])).entries()].map(([name, hex]) => ({ name, hex })),
    [product.variants],
  );
  const firstInStock = product.variants.find((v) => v.stock > 0);
  const [color, setColor] = useState(firstInStock?.color ?? colors[0]?.name);
  const sizes = product.variants.filter((v) => v.color === color);
  const [size, setSize] = useState<string | null>(sizes.length === 1 && sizes[0].stock > 0 ? sizes[0].size : null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const add = useCart((s) => s.add);

  const variant = product.variants.find((v) => v.color === color && v.size === size) ?? null;
  const price = variant?.priceOverride ?? product.basePrice;
  const discount =
    product.compareAtPrice && product.compareAtPrice > price ? Math.round((1 - price / product.compareAtPrice) * 100) : 0;

  // Seçili rengin görselleri önce
  const media = useMemo(() => {
    const own = product.media.filter((m) => m.color === color);
    const rest = product.media.filter((m) => m.color !== color && !m.color);
    const others = product.media.filter((m) => m.color && m.color !== color);
    return [...own, ...rest, ...others];
  }, [product.media, color]);

  const pickColor = (c: string) => {
    setColor(c);
    setSize(null);
    setQty(1);
    setError(null);
    setActive(0);
    scroller.current?.scrollTo({ left: 0, behavior: "smooth" });
  };

  const onAdd = () => {
    if (!variant) {
      setError("Lütfen beden seçin");
      document.getElementById("beden-secimi")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (variant.stock < 1) return setError("Bu beden tükendi");
    add({
      variantId: variant.id,
      qty,
      productSlug: product.slug,
      productName: product.name,
      size: variant.size,
      color: variant.color,
      unitPrice: price,
      imageKey: (product.media.find((m) => m.color === variant.color) ?? product.media[0])?.key ?? null,
      maxQty: variant.stock,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const waText = `Merhaba, "${product.name}"${variant ? ` (${variant.color} / ${variant.size})` : ""} hakkında bilgi almak istiyorum.`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
      {/* Galeri */}
      <div>
        <div
          ref={scroller}
          className="no-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto sm:mx-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:overflow-visible"
          onScroll={(e) => {
            const el = e.currentTarget;
            setActive(Math.round(el.scrollLeft / el.clientWidth));
          }}
          aria-label="Ürün görselleri"
        >
          {media.map((m, i) => (
            <div key={m.key} className={`w-full shrink-0 snap-center bg-sand ${i === 0 ? "lg:col-span-2" : ""}`}>
              <Image
                src={m.key}
                alt={m.alt}
                width={m.width}
                height={m.height}
                sizes={i === 0 ? "(max-width: 1024px) 100vw, 55vw" : "(max-width: 1024px) 100vw, 28vw"}
                preload={i === 0}
                loading={i === 0 ? undefined : "lazy"}
                placeholder={(placeholders[m.key] as `data:image/${string}`) ?? "empty"}
                className="aspect-[4/5] h-auto w-full object-cover"
              />
            </div>
          ))}
        </div>
        {media.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5 lg:hidden" aria-hidden="true">
            {media.map((m, i) => (
              <span key={m.key} className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-ink" : "w-1.5 bg-line"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Satın alma paneli */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <h1 className="text-3xl leading-tight sm:text-4xl">{product.name}</h1>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl font-semibold">{formatTRY(price)}</span>
          {discount > 0 && (
            <>
              <s className="text-muted">{formatTRY(product.compareAtPrice!)}</s>
              <span className="bg-blush px-2 py-0.5 text-xs font-semibold">%{discount}</span>
            </>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">KDV dahil · 3 ve 6 taksit seçenekleriyle</p>

        <div className="mt-6">
          <p className="mb-2 text-sm">
            Renk: <b>{color}</b>
          </p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const any = product.variants.some((v) => v.color === c.name && v.stock > 0);
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => pickColor(c.name)}
                  aria-pressed={c.name === color}
                  aria-label={`${c.name}${any ? "" : " (tükendi)"}`}
                  title={c.name}
                  className={`relative h-10 w-10 rounded-full border-2 p-0.5 ${c.name === color ? "border-ink" : "border-transparent"} ${any ? "" : "opacity-40"}`}
                >
                  <span className="block h-full w-full rounded-full border border-line" style={{ background: c.hex }} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6" id="beden-secimi">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm">
              Beden: <b>{size ?? "Seçin"}</b>
            </p>
            {sizeChart !== "esarp" && (
              <button type="button" onClick={() => setChartOpen(true)} className="flex items-center gap-1 text-sm underline underline-offset-4">
                <Ruler className="h-4 w-4" /> Beden tablosu
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Beden">
            {sizes.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={size === v.size}
                disabled={v.stock < 1}
                onClick={() => {
                  setSize(v.size);
                  setQty(1);
                  setError(null);
                }}
                className={`relative min-h-11 min-w-14 border px-3 text-sm transition-colors ${
                  size === v.size ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"
                } disabled:cursor-not-allowed disabled:text-muted disabled:line-through disabled:hover:border-line`}
              >
                {v.size}
              </button>
            ))}
          </div>
          {variant && variant.stock > 0 && variant.stock <= 3 && (
            <p className="mt-2 text-sm font-medium text-rose">Son {variant.stock} ürün!</p>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <div className="flex items-center border border-line bg-white">
            <button type="button" className="p-3 disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Adedi azalt">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center" aria-live="polite">{qty}</span>
            <button
              type="button"
              className="p-3 disabled:opacity-40"
              onClick={() => setQty((q) => Math.min(q + 1, variant?.stock ?? 1, 10))}
              disabled={!variant || qty >= Math.min(variant.stock, 10)}
              aria-label="Adedi artır"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={onAdd} className="btn-primary flex-1 text-base">
            {added ? (
              <>
                <Check className="h-4 w-4" /> Sepete eklendi
              </>
            ) : (
              "Sepete Ekle"
            )}
          </button>
        </div>
        <a href={waLink(whatsapp, waText)} target="_blank" rel="noopener noreferrer" className="btn-outline mt-3 w-full">
          <MessageCircle className="h-4 w-4" /> WhatsApp&apos;tan sor
        </a>

        <div className="mt-8 divide-y divide-line border-y border-line">
          {[
            ["Ürün açıklaması", product.description],
            ["Kumaş ve ölçüler", product.fabric],
            ["Bakım", product.care],
            [
              "Kargo ve iade",
              "Siparişleriniz 1-3 iş günü içinde kargoya verilir. 1.500 TL ve üzeri siparişlerde kargo ücretsizdir. Teslimattan itibaren 14 gün içinde iade edebilirsiniz.",
            ],
          ].map(([t, body], i) => (
            <details key={t} className="group py-4" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                {t}
                <Plus className="h-4 w-4 transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-3 text-sm leading-6 text-ink-soft">{body}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Mobil yapışkan sepete ekle */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">{size ? `${color} · ${size}` : "Beden seçin"}</p>
            <p className="font-semibold">{formatTRY(price * qty)}</p>
          </div>
          <button type="button" onClick={onAdd} className="btn-primary flex-[1.4]">
            {added ? "Eklendi ✓" : "Sepete Ekle"}
          </button>
        </div>
      </div>

      {chartOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Beden tablosu">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setChartOpen(false)} />
          <div className="relative w-full max-w-lg rounded-t-xl bg-white p-6 sm:rounded-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl">Beden tablosu</h2>
              <button className="btn-ghost !px-2" onClick={() => setChartOpen(false)} aria-label="Kapat">
                <X className="h-5 w-5" />
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {SIZE_CHARTS[sizeChart].head.map((h) => (
                    <th key={h} className="py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SIZE_CHARTS[sizeChart].rows.map((r) => (
                  <tr key={r[0]} className="border-b border-line">
                    {r.map((c, i) => (
                      <td key={i} className="py-2">{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted">{SIZE_CHARTS[sizeChart].note}</p>
          </div>
        </div>
      )}
    </div>
  );
}
