import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL_PAGES } from "@/lib/legal";
import { CONTRACT_VERSION } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(LEGAL_PAGES).map((page) => ({ page }));
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const p = LEGAL_PAGES[(await params).page];
  return p ? { title: p.title, description: p.description } : {};
}

export default async function InfoPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const data = LEGAL_PAGES[page];
  if (!data) notFound();
  const legal = ["kvkk", "cerez-politikasi", "mesafeli-satis-sozlesmesi", "on-bilgilendirme-formu", "uyelik-sozlesmesi"].includes(page);
  return (
    <article className="container-x max-w-3xl py-12">
      <h1 className="text-4xl">{data.title}</h1>
      {legal && <p className="mt-2 text-xs text-muted">Sürüm: {CONTRACT_VERSION} · Taslak metin, yayından önce hukuki onaydan geçirilecektir.</p>}
      <div className="prose-legal mt-6">
        {data.sections.map((s, i) => (
          <section key={i}>
            {s.h && <h2>{s.h}</h2>}
            {s.p?.map((t, j) => <p key={j}>{t}</p>)}
            {s.ul && (
              <ul>
                {s.ul.map((t, j) => (
                  <li key={j}>{t}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
