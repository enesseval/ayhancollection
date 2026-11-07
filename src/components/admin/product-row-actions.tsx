"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, ExternalLink, EyeOff, Pencil, Send, Trash2 } from "lucide-react";
import { deleteProduct, duplicateProduct, setProductStatus } from "@/app/actions/admin";
import type { Product } from "@/lib/types";
import { useAdminAction } from "./order-actions";

// Ürün listesinde her satırın sağındaki kısayollar
export function ProductRowActions({ id, name, slug, status }: { id: string; name: string; slug: string; status: Product["status"] }) {
  const router = useRouter();
  const { pending, msg, run } = useAdminAction();
  const btn = "rounded p-1.5 text-muted hover:bg-canvas hover:text-ink disabled:opacity-40";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-0.5">
        <Link href={`/yonetim/urunler/${id}`} className={btn} title="Düzenle" aria-label={`${name} düzenle`}>
          <Pencil className="h-4 w-4" />
        </Link>
        {status === "active" && (
          <Link href={`/urun/${slug}`} target="_blank" className={btn} title="Mağazada gör" aria-label={`${name} mağazada gör`}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        )}
        {status === "draft" && (
          <button type="button" disabled={pending} className={btn} title="Yayına al" aria-label={`${name} yayına al`} onClick={() => run(() => setProductStatus(id, "active"))}>
            <Send className="h-4 w-4" />
          </button>
        )}
        {status === "active" && (
          <button type="button" disabled={pending} className={btn} title="Taslağa al (mağazadan kaldır)" aria-label={`${name} taslağa al`} onClick={() => run(() => setProductStatus(id, "draft"))}>
            <EyeOff className="h-4 w-4" />
          </button>
        )}
        {status !== "archived" ? (
          <button
            type="button"
            disabled={pending}
            className={btn}
            title="Arşivle"
            aria-label={`${name} arşivle`}
            onClick={() => confirm(`"${name}" arşivlensin mi? Mağazadan kalkar, sipariş geçmişi korunur.`) && run(() => setProductStatus(id, "archived"))}
          >
            <Archive className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" disabled={pending} className={btn} title="Arşivden çıkar (taslak olur)" aria-label={`${name} arşivden çıkar`} onClick={() => run(() => setProductStatus(id, "draft"))}>
            <ArchiveRestore className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          className={btn}
          title="Kopyasını oluştur"
          aria-label={`${name} kopyala`}
          onClick={() =>
            run(async () => {
              const r = await duplicateProduct(id);
              if (r.ok && r.id) router.push(`/yonetim/urunler/${r.id}`);
              return r;
            })
          }
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={pending}
          className={`${btn} hover:!text-danger`}
          title="Sil"
          aria-label={`${name} sil`}
          onClick={() => confirm(`"${name}" kalıcı olarak silinsin mi? Görselleri de silinir, geri alınamaz.`) && run(() => deleteProduct(id))}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {msg && <p className={`max-w-64 text-right text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
