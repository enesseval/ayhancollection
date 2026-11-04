import "server-only";
import { env, features } from "./env";
import { formatTRY, ORDER_STATUS_LABEL } from "./format";
import type { Order, Settings } from "./types";

// Resend anahtarı varsa e-posta gönderir, yoksa sunucu loguna (PII maskeli) yazar.

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function mask(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}***@${d}`;
}

async function send(to: string, subject: string, html: string) {
  if (!features.resend) {
    console.info(`[email:demo] -> ${mask(to)} | ${subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.resendApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.mailFrom, to, subject, html }),
  });
  if (!res.ok) console.error("[email] gönderilemedi", res.status);
}

function layout(title: string, body: string) {
  return `<!doctype html><html lang="tr"><body style="margin:0;background:#FAF8F6;font-family:Arial,sans-serif;color:#141414">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="font-family:Georgia,serif;font-size:20px;letter-spacing:2px;margin:0 0 24px">AYŞE AYHAN <span style="font-size:13px;font-style:italic;letter-spacing:0">Collection</span></p>
    <h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${body}
    <p style="font-size:12px;color:#777;margin-top:32px">Bu e-posta ${esc(env.siteUrl)} üzerinden verdiğiniz sipariş için gönderildi.</p>
  </div></body></html>`;
}

function itemsTable(o: Order) {
  const rows = o.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${esc(i.productName)}<br><small style="color:#777">${esc(i.color)} / ${esc(i.size)} × ${i.qty}</small></td><td style="text-align:right">${formatTRY(i.unitPrice * i.qty)}</td></tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
  <tr><td style="padding-top:12px;border-top:1px solid #ddd">Kargo</td><td style="text-align:right;padding-top:12px;border-top:1px solid #ddd">${o.shipping ? formatTRY(o.shipping) : "Ücretsiz"}</td></tr>
  ${o.discount ? `<tr><td>İndirim</td><td style="text-align:right">-${formatTRY(o.discount)}</td></tr>` : ""}
  <tr><td><b>Toplam</b></td><td style="text-align:right"><b>${formatTRY(o.total)}</b></td></tr></table>`;
}

export async function sendOrderReceived(o: Order, settings: Settings) {
  const transfer =
    o.paymentMethod === "transfer"
      ? `<p>Ödemenizi aşağıdaki hesaba açıklama kısmına <b>${esc(o.orderNo)}</b> yazarak 24 saat içinde yapabilirsiniz:</p>
         ${settings.bankAccounts.map((b) => `<p style="background:#fff;padding:12px;border:1px solid #eee">${esc(b.bank)}<br>${esc(b.holder)}<br><b>${esc(b.iban)}</b></p>`).join("")}`
      : "";
  await send(
    o.email,
    `Siparişiniz alındı – ${o.orderNo}`,
    layout(
      "Siparişiniz için teşekkürler",
      `<p>Sipariş numaranız: <b>${esc(o.orderNo)}</b> · Durum: ${ORDER_STATUS_LABEL[o.status]}</p>${transfer}${itemsTable(o)}
       <p><a href="${env.siteUrl}/siparis-takip?no=${encodeURIComponent(o.orderNo)}">Siparişimi takip et</a></p>`,
    ),
  );
}

export async function sendOrderShipped(o: Order) {
  await send(
    o.email,
    `Siparişiniz kargoya verildi – ${o.orderNo}`,
    layout(
      "Siparişiniz yola çıktı",
      `<p>${esc(o.carrier ?? "Kargo")} takip numaranız: <b>${esc(o.trackingNo ?? "")}</b></p>${itemsTable(o)}`,
    ),
  );
}
