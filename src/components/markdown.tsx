import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

// Ürün metinleri için güvenli Markdown görüntüleyici.
// - Ham HTML işlenmez (react-markdown varsayılanı) → XSS yok
// - Görsel etiketi kapalı (dış kaynaktan resim çekilmesin)
// - Tek satır sonu da satır sonu sayılır (eski düz metinler aynen okunur)
// - Tablolar mobilde yatay kaydırılır
// Sunucu bileşeninde de, istemcide de (yönetim önizlemesi) kullanılabilir.

const components: Components = {
  h1: ({ children }) => <h3 className="mb-2 mt-4 font-sans text-base font-semibold text-ink first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-4 font-sans text-base font-semibold text-ink first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1.5 mt-3 font-sans text-sm font-semibold text-ink first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mb-1.5 mt-3 font-sans text-sm font-semibold text-ink first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 marker:text-muted last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 marker:text-muted last:mb-0">{children}</ol>,
  a: ({ href, children }) => (
    <a href={href} className="underline underline-offset-2" target={href?.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-line" />,
  blockquote: ({ children }) => <blockquote className="mb-2 border-l-2 border-blush pl-3 italic">{children}</blockquote>,
  table: ({ children }) => (
    <div className="no-scrollbar -mx-1 mb-2 overflow-x-auto px-1 last:mb-0">
      <table className="w-full min-w-max border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-ink/20">{children}</thead>,
  th: ({ children }) => <th className="whitespace-nowrap py-2 pr-4 font-medium text-ink last:pr-0">{children}</th>,
  td: ({ children }) => <td className="whitespace-nowrap border-b border-line py-2 pr-4 tabular-nums last:pr-0">{children}</td>,
};

export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  if (!children.trim()) return null;
  return (
    <div className={`text-sm leading-6 text-ink-soft ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components} disallowedElements={["img"]} unwrapDisallowed>
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Meta açıklama / JSON-LD için Markdown işaretlerini temizler */
export function markdownToPlain(md: string): string {
  return md
    .replace(/^\s*\|?\s*:?-{2,}.*$/gm, "") // tablo ayırıcı satırı
    .replace(/\|/g, " ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_`~>]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
