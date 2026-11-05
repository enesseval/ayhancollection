import { repo } from "@/lib/data";
import { env, features } from "@/lib/env";
import { buildMail, MAIL_KIND_LABEL, type MailKind } from "@/lib/email";
import { ORDER_STATUS_LABEL } from "@/lib/format";

// Sipariş e-postalarının önizlemesi: gerçek bir siparişle her şablonun nasıl görüneceğini gösterir.
// E-posta GÖNDERMEZ; Resend bağlanmadan önce akışı kontrol etmek için.

const KINDS = Object.keys(MAIL_KIND_LABEL) as MailKind[];

export default async function EmailPreviewPage({ searchParams }: { searchParams: Promise<{ o?: string; k?: string }> }) {
  const sp = await searchParams;
  const orders = await repo.listOrders({ limit: 30 });
  const order = (sp.o && /^[0-9a-f-]{36}$/.test(sp.o) ? orders.find((o) => o.id === sp.o) : undefined) ?? orders[0];
  const kind: MailKind = KINDS.includes(sp.k as MailKind) ? (sp.k as MailKind) : "received";
  const mail = order ? buildMail(kind, order, await repo.getSettings()) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">E-postalar</h1>

      <div className="card space-y-2 p-5 text-sm">
        <p>
          Gönderim:{" "}
          {features.resend ? (
            <b className="text-success">Aktif (Resend)</b>
          ) : (
            <b className="text-danger">Kapalı</b>
          )}
          {!features.resend && " — RESEND_API_KEY ve MAIL_FROM eklenince bu e-postalar otomatik gönderilmeye başlar. Şu an yalnız sunucu loguna yazılıyor."}
        </p>
        <p>Gönderen: <span className="text-muted">{env.mailFrom}</span></p>
        <p>
          Yeni sipariş bildirimi:{" "}
          {env.orderNotifyEmail ? <span className="text-muted">{env.orderNotifyEmail}</span> : <span className="text-muted">ORDER_NOTIFY_EMAIL tanımlı değil (gönderilmez)</span>}
        </p>
        <ul className="list-disc pl-5 pt-2 text-muted">
          <li>Sipariş verildiğinde (kart ödemesi onaylanınca / havale siparişinde) → Sipariş alındı + mağazaya bildirim</li>
          <li>Havale onaylanınca → Ödemeniz onaylandı</li>
          <li>Kargo bilgisi kaydedilince → Kargoya verildi</li>
          <li>Durum “Teslim edildi” / “İptal edildi” yapılınca → ilgili e-posta</li>
        </ul>
      </div>

      {!order ? (
        <p className="text-sm text-muted">Önizleme için en az bir sipariş gerekli.</p>
      ) : (
        <>
          <form className="card flex flex-wrap items-end gap-3 p-5 text-sm" method="get">
            <label className="flex flex-col gap-1">
              Sipariş
              <select name="o" defaultValue={order.id} className="input">
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNo} · {ORDER_STATUS_LABEL[o.status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Şablon
              <select name="k" defaultValue={kind} className="input">
                {KINDS.map((k) => (
                  <option key={k} value={k}>{MAIL_KIND_LABEL[k]}</option>
                ))}
              </select>
            </label>
            <button className="btn-primary">Önizle</button>
          </form>

          {mail && (
            <div className="card overflow-hidden">
              <div className="space-y-1 border-b border-line p-4 text-sm">
                <p><span className="text-muted">Kime:</span> {mail.to || "—"}</p>
                <p><span className="text-muted">Konu:</span> <b>{mail.subject}</b></p>
              </div>
              <iframe title="E-posta önizleme" srcDoc={mail.html} sandbox="" className="h-[760px] w-full bg-white" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
