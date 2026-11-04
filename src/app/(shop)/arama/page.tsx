import type { Metadata } from "next";
import { Search } from "lucide-react";
import { repo } from "@/lib/data";
import { ProductGrid } from "@/components/product/product-card";

export const metadata: Metadata = { title: "Ara", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim().slice(0, 60);
  const results = term.length >= 2 ? await repo.listProducts({ q: term }) : [];
  const suggestions = term ? [] : await repo.listProducts({ onlyBestseller: true, limit: 4 });
  return (
    <div className="container-x py-10">
      <form action="/arama" role="search" className="mx-auto max-w-2xl">
        <label htmlFor="q" className="sr-only">Ürün ara</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input id="q" name="q" defaultValue={term} className="input !min-h-14 !pl-12 text-lg" placeholder="Tunik, eşarp, pijama…" autoFocus maxLength={60} />
        </div>
      </form>
      <div className="mt-10">
        {term.length >= 2 ? (
          <>
            <p className="mb-6 text-sm text-muted">&quot;{term}&quot; için {results.length} sonuç</p>
            {results.length ? <ProductGrid products={results} /> : <p className="py-10 text-center text-ink-soft">Sonuç bulunamadı. Farklı bir kelime deneyin.</p>}
          </>
        ) : (
          <>
            <h2 className="mb-6 text-2xl">Popüler ürünler</h2>
            <ProductGrid products={suggestions} />
          </>
        )}
      </div>
    </div>
  );
}
