// Isi email nota digital (HTML + teks biasa) untuk transaksi lunas.
// Tata letak memakai <table> & style inline agar tampil rapi di Gmail / aplikasi email lain.
import { formatRupiah } from "./dateHelpers";

export type ReceiptTransaction = {
  transactionNumber:     string;
  createdAt:             Date;
  customerName:          string | null;
  paymentMethod:         string;
  paymentAmount:         number;
  totalAmount:           number;
  changeAmount:          number;
  transferBankName:      string | null;
  transferAccountNumber: string | null;
  transferAccountName:   string | null;
  cashier:               { name: string } | null;
  Items: Array<{ productName: string; variantName: string | null; qty: number; unitPrice: number; subtotal: number }>;
};

export type ReceiptStore = { storeName: string; storeAddress: string };

const PAYMENT_LABELS: Record<string, string> = { cash: "Tunai", transfer: "Transfer", qris: "QRIS" };
const BRAND = "#c93e7b";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const formatNumber = (n: number) => Math.round(n).toLocaleString("id-ID");
const formatAccount = (n: string) => n.replace(/(\d{4})(?=\d)/g, "$1 ");
const formatDateTime = (d: Date) =>
  d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) + " WIB";

export const buildReceiptEmail = (trx: ReceiptTransaction, store: ReceiptStore) => {
  const method = PAYMENT_LABELS[trx.paymentMethod] ?? trx.paymentMethod;
  const itemName = (it: ReceiptTransaction["Items"][number]) =>
    it.variantName ? `${it.productName} (${it.variantName})` : it.productName;
  const transferLine = trx.transferAccountNumber
    ? `${trx.transferBankName ?? ""} ${formatAccount(trx.transferAccountNumber)} a.n. ${trx.transferAccountName ?? ""}`
    : "";
  const totalQty = trx.Items.reduce((s, i) => s + i.qty, 0);

  const subject = `Nota ${trx.transactionNumber} - ${store.storeName} (${formatRupiah(trx.totalAmount)})`;

  // ── HTML ───────────────────────────────────────────────────────
  const info = (label: string, value: string) =>
    `<tr><td style="padding:2px 0;color:#666;width:90px">${label}</td><td style="padding:2px 0">${esc(value)}</td></tr>`;
  const sum = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:3px 0;${strong ? "font-size:16px;font-weight:bold" : ""}">${label}</td>` +
    `<td style="padding:3px 0 3px 12px;text-align:right;white-space:nowrap;${strong ? `font-size:16px;font-weight:bold;color:${BRAND}` : ""}">${value}</td></tr>`;
  const items = trx.Items.map((it) => `
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #f0e6ea">
            <div style="font-weight:bold">${esc(itemName(it))}</div>
            <div style="color:#666;font-size:12px">${it.qty} x ${formatNumber(it.unitPrice)}</div>
          </td>
          <td style="padding:6px 0 6px 12px;border-bottom:1px solid #f0e6ea;text-align:right;vertical-align:top;white-space:nowrap">${formatNumber(it.subtotal)}</td>
        </tr>`).join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8eef3">
<div style="padding:24px 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#222">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;margin:0 auto;background:#ffffff;border:1px solid #eedbe4;border-radius:12px">
    <tr><td style="padding:20px 20px 12px;text-align:center;border-bottom:2px dashed #eedbe4">
      <div style="font-size:20px;font-weight:bold;color:${BRAND}">${esc(store.storeName)}</div>
      ${store.storeAddress ? `<div style="font-size:12px;color:#666">${esc(store.storeAddress)}</div>` : ""}
      <div style="margin-top:8px;font-size:12px;letter-spacing:1px;color:#999">NOTA PEMBELIAN</div>
    </td></tr>
    <tr><td style="padding:12px 20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">
        ${info("No. Nota", trx.transactionNumber)}
        ${info("Tanggal", formatDateTime(trx.createdAt))}
        ${info("Kasir", trx.cashier?.name ?? "-")}
        ${trx.customerName ? info("Pelanggan", trx.customerName) : ""}
      </table>
    </td></tr>
    <tr><td style="padding:0 20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}
      </table>
    </td></tr>
    <tr><td style="padding:10px 20px 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${sum("Total Qty", String(totalQty))}
        ${sum("TOTAL", formatRupiah(trx.totalAmount), true)}
        ${sum(`Bayar (${method})`, formatRupiah(trx.paymentAmount))}
        ${transferLine ? `<tr><td colspan="2" style="padding:0 0 3px;font-size:12px;color:#666">Ke: ${esc(transferLine)}</td></tr>` : ""}
        ${sum("Kembali", formatRupiah(trx.changeAmount))}
      </table>
    </td></tr>
    <tr><td style="padding:14px 20px 20px;text-align:center;border-top:2px dashed #eedbe4">
      <div style="font-weight:bold">Terima kasih telah berbelanja</div>
      <div style="margin-top:4px;font-size:11px;color:#999">Nota digital ini dikirim otomatis oleh sistem kasir ${esc(store.storeName)}.</div>
    </td></tr>
  </table>
</div>
</body></html>`;

  // ── Teks biasa (untuk aplikasi email tanpa HTML) ───────────────
  const text = [
    store.storeName,
    store.storeAddress,
    "NOTA PEMBELIAN",
    "",
    `No. Nota : ${trx.transactionNumber}`,
    `Tanggal  : ${formatDateTime(trx.createdAt)}`,
    `Kasir    : ${trx.cashier?.name ?? "-"}`,
    ...(trx.customerName ? [`Pelanggan: ${trx.customerName}`] : []),
    "",
    ...trx.Items.flatMap((it) => [itemName(it), `  ${it.qty} x ${formatNumber(it.unitPrice)} = ${formatNumber(it.subtotal)}`]),
    "",
    `Total Qty: ${totalQty}`,
    `TOTAL    : ${formatRupiah(trx.totalAmount)}`,
    `Bayar (${method}): ${formatRupiah(trx.paymentAmount)}`,
    ...(transferLine ? [`Ke: ${transferLine}`] : []),
    `Kembali  : ${formatRupiah(trx.changeAmount)}`,
    "",
    "Terima kasih telah berbelanja",
  ].filter((line, i) => i !== 1 || line).join("\n");

  return { subject, html, text };
};
