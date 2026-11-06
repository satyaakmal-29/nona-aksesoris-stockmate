// Notifikasi Purchase Order & Store Replenishment lewat WhatsApp, TANPA API/gateway:
// tombol "Kirim via WA" membuka wa.me dengan pesan sudah terisi, pengguna tinggal menekan Kirim.
// Penerima per tahap mengikuti tabel notifikasi aplikasi (lihat CLAUDE.md bagian Notifikasi).
import type { PurchaseOrder, StoreReplenishment } from "@/state/api";

export const WA_ROLE_LABELS: Record<string, string> = {
  super_admin:  "Super Admin",
  admin_gudang: "Admin Gudang",
  admin_toko:   "Admin Toko",
};

// 6281234567890 → 0812-3456-7890
export const formatWhatsapp = (n: string) =>
  ("0" + n.slice(2)).replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");

export const waLink = (phone: string, text: string) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

// Isi notifikasi: judul (modal), peran penerima, isi pesan, dan halaman tujuan di aplikasi
export type WaNotice = {
  title: string;
  roles: string[];
  body:  string;
  path:  string;
};

// Pesan lengkap: isi + tautan aplikasi (hanya jika dibuka lewat alamat jaringan, bukan localhost) + penanda toko
export const composeWaMessage = (notice: WaNotice, storeName: string, origin: string) => {
  const isLocal = !origin || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(origin);
  return [
    notice.body,
    "",
    ...(isLocal ? [] : [`Buka: ${origin}${notice.path}`]),
    `_${storeName} · StockMate_`,
  ].join("\n");
};

const formatRupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const MAX_LINES = 10;

type ItemLike = { product?: { name: string } | null; variant?: { name: string } | null };
const itemName = (it: ItemLike) =>
  `${it.product?.name ?? "Produk"}${it.variant ? ` (${it.variant.name})` : ""}`;

// Daftar barang (maks 10 baris agar pesan tidak terlalu panjang)
const itemLines = <T extends ItemLike>(items: T[], describe: (it: T) => string) => {
  const lines = items.slice(0, MAX_LINES).map((it) => `• ${itemName(it)} — ${describe(it)}`);
  if (items.length > MAX_LINES) lines.push(`• …dan ${items.length - MAX_LINES} item lainnya`);
  return lines;
};

const partOf = (got: number | null | undefined, of: number, verb: string) =>
  (got ?? 0) === of ? `${of} pcs` : `${verb} ${got ?? 0} dari ${of} pcs`;

// ── Purchase Order ───────────────────────────────────────────────
// Pengirim: pending → Super Admin (pembuat), received → Admin Gudang (validator)
export const PO_SENDER_ROLE: Record<PurchaseOrder["status"], string> = {
  pending:  "super_admin",
  received: "admin_gudang",
};

export const buildPoNotice = (po: PurchaseOrder): WaNotice => {
  if (po.status === "pending") {
    return {
      title: `${po.poNumber} dibuat`,
      roles: ["admin_gudang"],
      path:  "/purchase-orders",
      body: [
        "*Purchase Order Baru*",
        `No. PO: ${po.poNumber}`,
        `Supplier: ${po.supplier}`,
        `Nota: ${po.invoiceNumber} • Resi: ${po.trackingNumber}`,
        "",
        "Barang:",
        ...itemLines(po.Items, (it) => `${it.qtyOrdered} pcs`),
        "",
        `Total nota: ${formatRupiah(po.invoiceTotal)}`,
        `Dibuat oleh: ${po.createdBy?.name ?? "-"}`,
        ...(po.notes ? [`Catatan: ${po.notes}`] : []),
        "",
        "Mohon validasi penerimaan saat barang tiba di gudang (menu Purchase Order).",
      ].join("\n"),
    };
  }
  const short = po.Items.filter((it) => (it.qtyReceived ?? 0) < it.qtyOrdered);
  return {
    title: `${po.poNumber} diterima`,
    roles: ["super_admin"],
    path:  "/purchase-orders",
    body: [
      short.length ? "*Purchase Order Diterima — ADA SELISIH*" : "*Purchase Order Diterima*",
      `No. PO: ${po.poNumber}`,
      `Supplier: ${po.supplier}`,
      "",
      "Barang diterima:",
      ...itemLines(po.Items, (it) =>
        partOf(it.qtyReceived, it.qtyOrdered, "diterima") + (it.receiveNote ? ` (${it.receiveNote})` : "")),
      "",
      `Divalidasi oleh: ${po.validatedBy?.name ?? "-"}`,
      ...(po.deliveryNoteNumber ? [`No. surat jalan: ${po.deliveryNoteNumber}`] : []),
      ...(po.receiveNotes ? [`Catatan: ${po.receiveNotes}`] : []),
      "",
      short.length
        ? `${short.length} item diterima kurang dari pesanan. Mohon ditindaklanjuti dengan supplier.`
        : "Semua barang diterima lengkap. Stok gudang sudah bertambah.",
    ].join("\n"),
  };
};

// ── Store Replenishment ──────────────────────────────────────────
// Pengirim per status = peran yang baru saja melakukan aksi
export const SR_SENDER_ROLE: Record<StoreReplenishment["status"], string> = {
  pending:   "super_admin",
  approved:  "admin_gudang",
  rejected:  "admin_gudang",
  shipped:   "admin_gudang",
  completed: "admin_toko",
};

export const buildSrNotice = (sr: StoreReplenishment): WaNotice => {
  const path = "/store-replenishments";
  const head = (title: string) => [title, `No.: ${sr.srNumber}`, ""];

  switch (sr.status) {
    case "pending":
      return {
        title: `${sr.srNumber} dibuat`, roles: ["admin_gudang"], path,
        body: [
          ...head("*Permintaan Pengisian Toko (Store Replenishment)*"),
          "Barang diminta:",
          ...itemLines(sr.Items, (it) => `${it.qtyRequested} pcs`),
          "",
          `Dibuat oleh: ${sr.createdBy?.name ?? "-"}`,
          ...(sr.notes ? [`Catatan: ${sr.notes}`] : []),
          "",
          "Mohon cek stok gudang lalu setujui / tolak (menu Store Replenishment).",
        ].join("\n"),
      };
    case "approved":
      return {
        title: `${sr.srNumber} disetujui`, roles: ["super_admin"], path,
        body: [
          ...head("*Store Replenishment Disetujui*"),
          "Barang disetujui:",
          ...itemLines(sr.Items, (it) => partOf(it.qtyApproved, it.qtyRequested, "disetujui")),
          "",
          `Disetujui oleh: ${sr.approvedBy?.name ?? "-"}`,
          "",
          "Barang segera disiapkan dan dikirim ke toko.",
        ].join("\n"),
      };
    case "rejected":
      return {
        title: `${sr.srNumber} ditolak`, roles: ["super_admin"], path,
        body: [
          ...head("*Store Replenishment Ditolak*"),
          `Alasan: ${sr.rejectedReason ?? "-"}`,
          `Ditolak oleh: ${sr.approvedBy?.name ?? "-"}`,
        ].join("\n"),
      };
    case "shipped":
      return {
        title: `${sr.srNumber} dikirim`, roles: ["admin_toko", "super_admin"], path,
        body: [
          ...head("*Barang Dikirim ke Toko*"),
          "Barang dikirim:",
          ...itemLines(sr.Items, (it) =>
            partOf(it.qtyShipped, it.qtyApproved ?? it.qtyRequested, "dikirim") + (it.shipNote ? ` (${it.shipNote})` : "")),
          "",
          `Surat jalan: ${sr.deliveryNoteNumber ?? "-"}`,
          `Pengantar: ${sr.courierName ?? "-"}`,
          `Dikirim oleh: ${sr.shippedBy?.name ?? "-"}`,
          ...(sr.shipNotes ? [`Catatan: ${sr.shipNotes}`] : []),
          "",
          "Admin Toko: mohon cek barang lalu konfirmasi penerimaan (menu Store Replenishment).",
        ].join("\n"),
      };
    case "completed": {
      const short = sr.Items.filter((it) => (it.qtyReceived ?? 0) < (it.qtyShipped ?? 0));
      return {
        title: `${sr.srNumber} diterima toko`, roles: ["super_admin", "admin_gudang"], path,
        body: [
          ...head(short.length ? "*Barang Diterima Toko — ADA SELISIH*" : "*Barang Diterima Toko*"),
          "Barang diterima:",
          ...itemLines(sr.Items, (it) =>
            partOf(it.qtyReceived, it.qtyShipped ?? 0, "diterima") + (it.receiveNote ? ` (${it.receiveNote})` : "")),
          "",
          `Diterima oleh: ${sr.receivedBy?.name ?? "-"}`,
          ...(sr.receiveNotes ? [`Catatan: ${sr.receiveNotes}`] : []),
          "",
          short.length
            ? `${short.length} item diterima kurang dari yang dikirim. Mohon ditindaklanjuti.`
            : "Semua barang diterima lengkap. Stok toko sudah bertambah.",
        ].join("\n"),
      };
    }
  }
};
