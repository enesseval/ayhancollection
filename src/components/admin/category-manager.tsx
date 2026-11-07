"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCategory, moveCategory, saveCategory } from "@/app/actions/admin";
import { slugify } from "@/lib/format";
import type { Category } from "@/lib/types";
import { Flash, useAdminAction } from "./order-actions";

type Draft = { id: string; name: string; slug: string; parentId: string; description: string; isActive: boolean; slugTouched: boolean };

const empty = (parentId = ""): Draft => ({ id: "", name: "", slug: "", parentId, description: "", isActive: true, slugTouched: false });

export function CategoryManager({ categories }: { categories: Category[] }) {
  const { pending, msg, run } = useAdminAction();
  const [draft, setDraft] = useState<Draft | null>(null);

  const roots = categories.filter((c) => !c.parentId).sort((a, b) => a.sort - b.sort);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id).sort((a, b) => a.sort - b.sort);
  const totalOf = (c: Category) => (c.productCount ?? 0) + childrenOf(c.id).reduce((a, x) => a + (x.productCount ?? 0), 0);

  const edit = (c: Category) =>
    setDraft({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId ?? "", description: c.description ?? "", isActive: c.isActive !== false, slugTouched: true });

  const save = () => {
    if (!draft) return;
    run(async () => {
      const res = await saveCategory({
        id: draft.id,
        name: draft.name,
        slug: draft.slug || slugify(draft.name),
        parentId: draft.parentId,
        description: draft.description,
        isActive: draft.isActive,
      });
      if (res.ok) setDraft(null);
      return res;
    });
  };

  const toggleActive = (c: Category) =>
    run(() =>
      saveCategory({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId ?? "", description: c.description ?? "", isActive: c.isActive === false }),
    );

  const remove = (c: Category) => {
    if (!confirm(`"${c.name}" kategorisi silinsin mi?`)) return;
    run(() => deleteCategory(c.id));
  };

  const Row = ({ c, child, first, last }: { c: Category; child?: boolean; first: boolean; last: boolean }) => (
    <li className={`flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5 ${child ? "pl-9" : ""} ${c.isActive === false ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${child ? "" : "font-semibold"}`}>
          {child && <span className="mr-1 text-muted">↳</span>}
          {c.name}
          {c.isActive === false && <span className="ml-2 rounded bg-sand px-1.5 py-0.5 text-[10px] font-medium">GİZLİ</span>}
        </p>
        <p className="truncate text-xs text-muted">
          /kategori/{c.slug} · {child ? c.productCount ?? 0 : totalOf(c)} ürün
        </p>
      </div>
      <div className="flex items-center gap-0.5">
        <button type="button" disabled={pending || first} onClick={() => run(() => moveCategory(c.id, -1))} className="rounded p-1.5 text-muted hover:bg-canvas disabled:opacity-30" aria-label="Yukarı taşı"><ArrowUp className="h-4 w-4" /></button>
        <button type="button" disabled={pending || last} onClick={() => run(() => moveCategory(c.id, 1))} className="rounded p-1.5 text-muted hover:bg-canvas disabled:opacity-30" aria-label="Aşağı taşı"><ArrowDown className="h-4 w-4" /></button>
        <button type="button" disabled={pending} onClick={() => toggleActive(c)} className="rounded p-1.5 text-muted hover:bg-canvas" aria-label={c.isActive === false ? "Mağazada göster" : "Mağazada gizle"} title={c.isActive === false ? "Mağazada göster" : "Mağazada gizle"}>
          {c.isActive === false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => edit(c)} className="rounded p-1.5 text-muted hover:bg-canvas" aria-label="Düzenle"><Pencil className="h-4 w-4" /></button>
        <button type="button" disabled={pending} onClick={() => remove(c)} className="rounded p-1.5 text-muted hover:bg-canvas hover:text-danger" aria-label="Sil"><Trash2 className="h-4 w-4" /></button>
      </div>
    </li>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-semibold">{categories.length} kategori</p>
          <button type="button" className="btn-outline !min-h-9" onClick={() => setDraft(empty())}><Plus className="h-4 w-4" /> Yeni kategori</button>
        </div>
        <ul>
          {roots.map((r, i) => {
            const kids = childrenOf(r.id);
            return (
              <li key={r.id}>
                <ul>
                  <Row c={r} first={i === 0} last={i === roots.length - 1} />
                  {kids.map((k, j) => (
                    <Row key={k.id} c={k} child first={j === 0} last={j === kids.length - 1} />
                  ))}
                  <li className="border-t border-line/60 py-1.5 pl-9">
                    <button type="button" onClick={() => setDraft(empty(r.id))} className="flex items-center gap-1 text-xs text-muted hover:text-ink">
                      <Plus className="h-3.5 w-3.5" /> {r.name} altına alt kategori ekle
                    </button>
                  </li>
                </ul>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-line px-3 py-2"><Flash msg={msg} /></div>
      </div>

      <div className="card h-fit p-5">
        {draft ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <h2 className="font-sans text-sm font-semibold">{draft.id ? "Kategoriyi düzenle" : "Yeni kategori"}</h2>
            <div>
              <label className="label" htmlFor="cat-name">Ad</label>
              <input
                id="cat-name"
                className="input"
                required
                minLength={2}
                maxLength={60}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: draft.slugTouched ? draft.slug : slugify(e.target.value) })}
                placeholder="Örn. Kaban"
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="cat-slug">Adres (URL)</label>
              <div className="flex items-center gap-2 text-sm text-muted">
                /kategori/
                <input id="cat-slug" className="input" value={draft.slug} pattern="[a-z0-9-]{2,80}" onChange={(e) => setDraft({ ...draft, slug: e.target.value, slugTouched: true })} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="cat-parent">Üst kategori</label>
              <select id="cat-parent" className="input" value={draft.parentId} onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}>
                <option value="">— Ana kategori (menüde en üstte) —</option>
                {roots
                  .filter((r) => r.id !== draft.id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="cat-desc">Kısa açıklama <span className="font-normal text-muted">(isteğe bağlı)</span></label>
              <textarea id="cat-desc" rows={2} maxLength={300} className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Kategori sayfasının başında görünür" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} className="h-4 w-4 accent-ink" />
              Mağazada göster
            </label>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={pending}>{pending ? "Kaydediliyor…" : "Kaydet"}</button>
              <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>Vazgeç</button>
            </div>
          </form>
        ) : (
          <div className="space-y-2 text-sm text-muted">
            <p>Düzenlemek için bir kategorinin yanındaki kaleme basın ya da yeni kategori ekleyin.</p>
            <p>İçinde ürün olan kategori silinemez; ürünleri taşıyın ya da kategoriyi <b>gizleyin</b>.</p>
          </div>
        )}
      </div>
    </div>
  );
}
