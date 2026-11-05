import "server-only";
import { env, features } from "./env";
import { formatDate, formatTRY, ORDER_STATUS_LABEL } from "./format";
import { orderToken } from "./order-access";
import type { Order, Settings } from "./types";

// Sipariş e-postaları. RESEND_API_KEY + MAIL_FROM tanımlıysa Resend ile gönderilir;
// tanımlı değilse sunucu loguna (adres maskeli) yazılır. Şablonlar yönetim panelinde
// "E-postalar" sayfasından gerçek bir siparişle önizlenebilir.

export type Mail = { to: string; subject: string; html: string };
export type MailKind = "received" | "transfer_confirmed" | "shipped" | "delivered" | "cancelled" | "admin_new_order";

export const MAIL_KIND_LABEL: Record<MailKind, string> = {
  received: "Sipariş alındı (müşteri)",
  transfer_confirmed: "Havale ödemesi onaylandı (müşteri)",
  shipped: "Kargoya verildi (müşteri)",
  delivered: "Teslim edildi (müşteri)",
  cancelled: "Sipariş iptal edildi (müşteri)",
  admin_new_order: "Yeni sipariş bildirimi (mağaza)",
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function mask(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}***@${d}`;
}

async function send(mail: Mail) {
  if (!mail.to) return;
  if (!features.resend) {
    console.info(`[email:demo] -> ${mask(mail.to)} | ${mail.subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.resendApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.mailFrom, to: mail.to, subject: mail.subject, html: mail.html }),
  });
  if (!res.ok) console.error("[email] gönderilemedi", res.status, mail.subject);
}

/** Müşterinin giriş yapmadan siparişini açabileceği imzalı bağlantı */
function orderLink(o: Order) {
  return `${env.siteUrl}/odeme/sonuc?no=${encodeURIComponent(o.orderNo)}&t=${orderToken(o.id)}`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;background:#141414;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:14px">${esc(label)}</a></p>`;
}

function layout(title: string, body: string, footer = true) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#FAF8F6;font-family:Arial,sans-serif;color:#141414">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="font-family:Georgia,serif;font-size:20px;letter-spacing:2px;margin:0 0 24px">AYŞE AYHAN <span style="font-size:13px;font-style:italic;letter-spacing:0">Collection</span></p>
    <h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${body}
    ${footer ? `<p style="font-size:12px;color:#777;margin-top:32px">Sorularınız için bu e-postayı yanıtlayabilir veya WhatsApp'tan yazabilirsiniz.<br>Bu e-posta ${esc(env.siteUrl.replace(/^https?:\/\//, ""))} üzerinden verdiğiniz sipariş için gönderildi.</p>` : ""}
  </div></body></html>`;
}

function itemsTable(o: Order) {
  const rows = o.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${esc(i.productName)}<br><small style="color:#777">${esc(i.color)} / ${esc(i.size)} × ${i.qty}</small></td><td style="text-align:right;vertical-align:top">${formatTRY(i.unitPrice * i.qty)}</td></tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
  <tr><td style="padding-top:12px;border-top:1px solid #ddd">Kargo</td><td style="text-align:right;padding-top:12px;border-top:1px solid #ddd">${o.shipping ? formatTRY(o.shipping) : "Ücretsiz"}</td></tr>
  ${o.discount ? `<tr><td>İndirim${o.couponCode ? ` (${esc(o.couponCode)})` : ""}</td><td style="text-align:right">-${formatTRY(o.discount)}</td></tr>` : ""}
  <tr><td><b>Toplam</b></td><td style="text-align:right"><b>${formatTRY(o.total)}</b></td></tr></table>`;
}

function address(o: Order) {
  const a = o.shippingAddress;
  return `<p style="font-size:14px;color:#444"><b>Teslimat adresi</b><br>${esc(a.fullName)}<br>${esc(a.line)}<br>${esc(a.district)} / ${esc(a.city)}</p>`;
}

/* ---------------- Şablonlar (saf fonksiyonlar; önizleme de bunları kullanır) ---------------- */

export function buildMail(kind: MailKind, o: Order, settings: Settings): Mail {
  switch (kind) {
    case "received": {
      const transfer =
        o.paymentMethod === "transfer"
          ? `<p>Ödemenizi aşağıdaki hesaba, açıklama kısmına <b>${esc(o.orderNo)}</b> yazarak 24 saat içinde yapabilirsiniz. Ödemeniz onaylandığında size ayrıca bilgi vereceğiz.</p>
             ${settings.bankAccounts.map((b) => `<p style="background:#fff;padding:12px;border:1px solid #eee">${esc(b.bank)}<br>${esc(b.holder)}<br><b>${esc(b.iban)}</b></p>`).join("")}`
          : `<p>Ödemeniz alındı. Siparişiniz 1-3 iş günü içinde kargoya verilecek.</p>`;
      return {
        to: o.email,
        subject: `Siparişiniz alındı – ${o.orderNo}`,
        html: layout(
          "Siparişiniz için teşekkürler",
          `<p>Sipariş numaranız: <b>${esc(o.orderNo)}</b> · ${formatDate(o.createdAt)}</p>${transfer}${itemsTable(o)}${address(o)}${button(orderLink(o), "Siparişimi görüntüle")}`,
        ),
      };
    }
    case "transfer_confirmed":
      return {
        to: o.email,
        subject: `Ödemeniz onaylandı – ${o.orderNo}`,
        html: layout(
          "Havale ödemeniz onaylandı",
          `<p><b>${esc(o.orderNo)}</b> numaralı siparişinizin ${formatTRY(o.total)} tutarındaki ödemesi alındı. Siparişiniz hazırlanmaya başlıyor ve 1-3 iş günü içinde kargoya verilecek.</p>${itemsTable(o)}${button(orderLink(o), "Siparişimi görüntüle")}`,
        ),
      };
    case "shipped":
      return {
        to: o.email,
        subject: `Siparişiniz kargoya verildi – ${o.orderNo}`,
        html: layout(
          "Siparişiniz yola çıktı",
          `<p><b>${esc(o.orderNo)}</b> numaralı siparişiniz kargoya teslim edildi.</p>
           <p style="background:#fff;padding:12px;border:1px solid #eee">Kargo firması: <b>${esc(o.carrier ?? "-")}</b><br>Takip numarası: <b>${esc(o.trackingNo ?? "-")}</b></p>
           <p style="font-size:13px;color:#555">Takip numaranızla kargo firmasının sitesinden gönderinizi izleyebilirsiniz.</p>${itemsTable(o)}${address(o)}${button(orderLink(o), "Siparişimi görüntüle")}`,
        ),
      };
    case "delivered":
      return {
        to: o.email,
        subject: `Siparişiniz teslim edildi – ${o.orderNo}`,
        html: layout(
          "Siparişiniz teslim edildi",
          `<p><b>${esc(o.orderNo)}</b> numaralı siparişiniz teslim edildi. Bizi tercih ettiğiniz için teşekkür ederiz.</p>
           <p style="font-size:13px;color:#555">Ürünü teslim aldığınız tarihten itibaren 14 gün içinde cayma hakkınızı kullanabilirsiniz. İade ve değişim için bizimle iletişime geçmeniz yeterli.</p>${button(orderLink(o), "Siparişimi görüntüle")}`,
        ),
      };
    case "cancelled":
      return {
        to: o.email,
        subject: `Siparişiniz iptal edildi – ${o.orderNo}`,
        html: layout(
          "Siparişiniz iptal edildi",
          `<p><b>${esc(o.orderNo)}</b> numaralı siparişiniz iptal edildi.</p>
           <p style="font-size:13px;color:#555">${o.paymentMethod === "card" ? "Kartınızdan çekim yapıldıysa iade bankanıza bağlı olarak birkaç iş günü içinde hesabınıza yansır." : "Havale ile ödeme yaptıysanız iade için bizimle iletişime geçin."} Bir yanlışlık olduğunu düşünüyorsanız lütfen bize yazın.</p>${itemsTable(o)}`,
        ),
      };
    case "admin_new_order": {
      const a = o.shippingAddress;
      return {
        to: env.orderNotifyEmail,
        subject: `Yeni sipariş: ${o.orderNo} · ${formatTRY(o.total)} · ${o.paymentMethod === "card" ? "Kart (ödendi)" : "Havale (bekleniyor)"}`,
        html: layout(
          `Yeni sipariş ${o.orderNo}`,
          `<p>Durum: <b>${ORDER_STATUS_LABEL[o.status]}</b> · ${formatDate(o.createdAt)}</p>
           <p style="font-size:14px">Müşteri: ${esc(a.fullName)} · ${esc(o.email)} · ${esc(a.phone)}</p>
           ${o.note ? `<p style="font-size:14px;background:#fff8e6;padding:8px">Not: ${esc(o.note)}</p>` : ""}
           ${itemsTable(o)}${address(o)}${button(`${env.siteUrl}/yonetim/siparisler/${o.id}`, "Yönetim panelinde aç")}`,
          false,
        ),
      };
    }
  }
}

/* ---------------- Gönderim ---------------- */

export async function sendOrderReceived(o: Order, settings: Settings) {
  await send(buildMail("received", o, settings));
  // Mağaza sahibine bildirim (ORDER_NOTIFY_EMAIL tanımlıysa)
  if (env.orderNotifyEmail) await send(buildMail("admin_new_order", o, settings));
}

export async function sendOrderUpdate(kind: Exclude<MailKind, "received" | "admin_new_order">, o: Order, settings: Settings) {
  await send(buildMail(kind, o, settings));
}

/** Geriye dönük uyumluluk */
export async function sendOrderShipped(o: Order, settings: Settings) {
  await sendOrderUpdate("shipped", o, settings);
}
