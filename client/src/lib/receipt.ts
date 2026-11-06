// Struk penjualan untuk printer thermal 58 mm (halaman Transaksi).
// HTML memakai style inline karena jendela cetak tidak memuat class Tailwind.
// Semua teks hitam pekat: printer thermal tidak bisa mencetak abu-abu dengan rapi.
import type { Transaction } from "@/state/api";

export type StoreInfo = { storeName: string; storeAddress: string };

export const PAYMENT_LABELS: Record<string, string> = {
  cash:     "Tunai",
  transfer: "Transfer",
  qris:     "QRIS",
};

// Lebar kertas 58 mm; area cetak printer ±48 mm di tengah → padding 5 mm kiri-kanan
export const RECEIPT_PAPER_MM = 58;
const PX_PER_MM = 96 / 25.4;
const MIN_PAGE_MM = 40;

// Nomor rekening dikelompokkan 4 digit agar mudah dibacakan ke pembeli
export const formatAccountNumber = (n: string) => n.replace(/(\d{4})(?=\d)/g, "$1 ");

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const formatNumber = (n: number) => Math.round(n).toLocaleString("id-ID");
const formatRupiah = (n: number) => "Rp " + formatNumber(n);

export const buildReceiptHtml = (trx: Transaction, store: StoreInfo): string => {
  const date = new Date(trx.createdAt);
  const row = (left: string, right: string, bold = false) =>
    `<div style="display:flex;justify-content:space-between;gap:6px;${bold ? "font-weight:bold;font-size:13px;" : ""}">` +
    `<span style="min-width:0">${left}</span><span style="white-space:nowrap">${right}</span></div>`;
  const line = `<div style="border-top:1px dashed #000;margin:6px 0"></div>`;

  // Baris item tanpa "Rp" agar harga & subtotal muat dalam satu baris
  const items = trx.Items.map((it) => `
    <div style="margin-bottom:4px">
      <div style="font-weight:bold;overflow-wrap:anywhere">${escapeHtml(it.productName)}${it.variantName ? ` (${escapeHtml(it.variantName)})` : ""}</div>
      ${row(`${it.qty} x ${formatNumber(it.unitPrice)}`, formatNumber(it.subtotal))}
    </div>`).join("");

  return `
  <div style="box-sizing:border-box;width:${RECEIPT_PAPER_MM}mm;padding:4mm 5mm 6mm;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.35;color:#000;background:#fff;font-variant-numeric:tabular-nums">
    <div style="text-align:center">
      <div style="font-size:14px;font-weight:bold">${escapeHtml(store.storeName)}</div>
      ${store.storeAddress ? `<div style="font-size:10px">${escapeHtml(store.storeAddress)}</div>` : ""}
    </div>
    ${line}
    ${row(date.toLocaleDateString("id-ID"), date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }))}
    <div>No: ${escapeHtml(trx.transactionNumber)}</div>
    <div>Kasir: ${escapeHtml(trx.cashier?.name ?? "-")}</div>
    ${trx.customerName ? `<div style="overflow-wrap:anywhere">Pelanggan: ${escapeHtml(trx.customerName)}</div>` : ""}
    ${line}
    ${items}
    ${line}
    ${row("Total Qty", String(trx.Items.reduce((s, i) => s + i.qty, 0)))}
    ${row("TOTAL", formatRupiah(trx.totalAmount), true)}
    ${row(`Bayar (${PAYMENT_LABELS[trx.paymentMethod] ?? trx.paymentMethod})`, formatRupiah(trx.paymentAmount))}
    ${trx.transferAccountNumber ? `<div style="font-size:10px">Ke: ${escapeHtml(trx.transferBankName ?? "")} <span style="white-space:nowrap">${escapeHtml(formatAccountNumber(trx.transferAccountNumber))}</span><br>a.n. ${escapeHtml(trx.transferAccountName ?? "")}</div>` : ""}
    ${row("Kembali", formatRupiah(trx.changeAmount))}
    ${line}
    <div style="text-align:center">Terima kasih telah berbelanja</div>
  </div>`;
};

// Kertas thermal berupa gulungan: tinggi halaman = panjang struk dan margin 0.
// "Save as PDF" jadi 1 halaman tanpa sisa kosong & tanpa header/footer browser.
export const applyReceiptPageSize = (doc: Document) => {
  const receipt = doc.body.firstElementChild;
  const heightMm = Math.ceil((receipt?.getBoundingClientRect().height ?? 0) / PX_PER_MM) + 1;
  const style = doc.createElement("style");
  style.textContent = `@page{size:${RECEIPT_PAPER_MM}mm ${Math.max(heightMm, MIN_PAGE_MM)}mm;margin:0}`;
  doc.head.appendChild(style);
};

// Buka jendela cetak berisi struk. false = jendela diblokir browser (pop-up).
export const printReceipt = (trx: Transaction, store: StoreInfo): boolean => {
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return false;
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Struk ${escapeHtml(trx.transactionNumber)}</title>` +
    `<style>html,body{margin:0;padding:0;background:#fff}</style></head><body>${buildReceiptHtml(trx, store)}</body></html>`
  );
  win.document.close();
  win.onafterprint = () => win.close();
  win.focus();
  // Beri waktu jendela selesai dirender sebelum ukuran halaman dihitung & dialog cetak dibuka
  setTimeout(() => {
    applyReceiptPageSize(win.document);
    win.print();
  }, 250);
  return true;
};
