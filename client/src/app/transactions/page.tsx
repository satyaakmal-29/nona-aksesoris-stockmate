"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Header from "@/app/(components)/Header";
import QrisCode from "@/app/(components)/QrisCode";
import { useAppSelector } from "@/app/redux";
import {
  useGetTransactionsQuery,
  useCreateTransactionMutation,
  useConfirmTransactionPaymentMutation,
  useCancelTransactionMutation,
  useGetStockTokoQuery,
  useGetStoreSettingsQuery,
  Product,
  Transaction,
  TransactionFilter,
  NewTransaction,
} from "@/state/api";
import {
  AlertTriangleIcon,
  BanIcon,
  BanknoteIcon,
  CalendarClockIcon,
  CheckCircleIcon,
  ClockIcon,
  ImageIcon,
  LandmarkIcon,
  LockIcon,
  MinusIcon,
  PlusIcon,
  QrCodeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusCircleIcon,
  PrinterIcon,
  ReceiptIcon,
  SearchIcon,
  ShoppingCartIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toLocalISODate, formatLongDate } from "@/lib/reportExport";
import { isLowToko } from "@/lib/stockThresholds";

// ── Konstanta & helper ────────────────────────────────────────────
// Nama & alamat toko diambil dari Pengaturan (Super Admin); ini nilai cadangan
type StoreInfo = { storeName: string; storeAddress: string };
const DEFAULT_STORE: StoreInfo = { storeName: "Nona Aksesoris", storeAddress: "Jl. Madukara, Jeruklegi, Cilacap" };

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  paid:            { label: "Lunas",               color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  pending_payment: { label: "Menunggu Pembayaran", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  cancelled:       { label: "Dibatalkan",          color: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
};

const PAYMENT_LABELS: Record<string, string> = {
  cash:     "Tunai",
  transfer: "Transfer",
  qris:     "QRIS",
};

const PAYMENT_COLORS: Record<string, string> = {
  cash:     "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  transfer: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  qris:     "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

const formatRupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

const showSize = (v?: string | null) => !!v && v !== "-";

// Scrollbar tipis untuk kolom katalog & keranjang
const slimScroll =
  "[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600";

const PAYMENT_ICONS = { cash: BanknoteIcon, transfer: LandmarkIcon, qris: QrCodeIcon } as const;

const getErrorMessage = (err: unknown, fallback: string) => {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── Input Rupiah (hanya angka, titik ribuan otomatis) ─────────────
const PriceInput = ({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  className: string;
}) => (
  <div className="relative">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">Rp</span>
    <input
      type="text"
      inputMode="numeric"
      value={value ? value.toLocaleString("id-ID") : ""}
      placeholder="0"
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits ? Number(digits) : 0);
      }}
      className={`${className} pl-9`}
    />
  </div>
);

// ── Struk ─────────────────────────────────────────────────────────
// HTML struk dengan style inline: dipakai untuk pratinjau & jendela cetak
// (class Tailwind tidak tersedia di jendela cetak).
const buildStrukHtml = (trx: Transaction, store: StoreInfo): string => {
  const date = new Date(trx.createdAt);
  const row = (left: string, right: string, bold = false) =>
    `<div style="display:flex;justify-content:space-between;gap:8px;${bold ? "font-weight:bold;font-size:13px;" : ""}"><span>${left}</span><span style="white-space:nowrap">${right}</span></div>`;
  const line = `<div style="border-top:1px dashed #999;margin:8px 0"></div>`;

  const items = trx.Items.map((it) => `
    <div style="margin-bottom:4px">
      <div style="font-weight:600">${escapeHtml(it.productName)}${it.variantName ? ` (${escapeHtml(it.variantName)})` : ""}</div>
      ${row(`${it.qty} x ${formatRupiah(it.unitPrice)}`, formatRupiah(it.subtotal))}
    </div>`).join("");

  return `
  <div style="font-family:'Courier New',monospace;font-size:12px;color:#000;background:#fff;width:280px;margin:0 auto;padding:12px">
    <div style="text-align:center">
      <div style="font-size:15px;font-weight:bold">${escapeHtml(store.storeName)}</div>
      <div style="font-size:11px;color:#555">${escapeHtml(store.storeAddress)}</div>
    </div>
    ${line}
    ${row(date.toLocaleDateString("id-ID"), date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }))}
    <div>No: ${escapeHtml(trx.transactionNumber)}</div>
    <div>Kasir: ${escapeHtml(trx.cashier?.name ?? "-")}</div>
    ${trx.customerName ? `<div>Pelanggan: ${escapeHtml(trx.customerName)}</div>` : ""}
    ${line}
    ${items}
    ${line}
    ${row("Total Qty", String(trx.Items.reduce((s, i) => s + i.qty, 0)))}
    ${row("Total", formatRupiah(trx.totalAmount), true)}
    ${row(`Bayar (${PAYMENT_LABELS[trx.paymentMethod] ?? trx.paymentMethod})`, formatRupiah(trx.paymentAmount))}
    ${row("Kembali", formatRupiah(trx.changeAmount))}
    ${line}
    <div style="text-align:center;color:#555">Terima kasih telah berbelanja</div>
  </div>`;
};

// ── Kartu transaksi ───────────────────────────────────────────────
const TrxCard = ({
  trx,
  isDarkMode,
  onPrint,
  onShowQris,
}: {
  trx: Transaction;
  isDarkMode: boolean;
  onPrint: (trx: Transaction) => void;
  onShowQris: (trx: Transaction) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const qty = trx.Items.reduce((s, i) => s + i.qty, 0);

  return (
    <div className={`mb-3 overflow-hidden rounded-xl border shadow-sm ${isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
      <div
        className="flex cursor-pointer items-center justify-between gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{trx.transactionNumber}</p>
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {formatDateTime(trx.createdAt)} • {qty} item • Kasir {trx.cashier?.name ?? "—"}
            {trx.customerName ? ` • ${trx.customerName}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {trx.status !== "paid" && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[trx.status]?.color ?? ""}`}>
              {STATUS_BADGE[trx.status]?.label ?? trx.status}
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PAYMENT_COLORS[trx.paymentMethod] ?? "bg-gray-100 text-gray-700"}`}>
            {PAYMENT_LABELS[trx.paymentMethod] ?? trx.paymentMethod}
          </span>
          <span className={`text-sm font-bold ${trx.status === "cancelled" ? "text-gray-400 line-through" : "text-gray-800 dark:text-gray-100"}`}>
            {formatRupiah(trx.totalAmount)}
          </span>
          {expanded ? <ChevronUpIcon className="h-4 w-4 text-gray-400" /> : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 dark:border-gray-700">
          <div className="mb-3 space-y-1.5">
            {trx.Items.map((item) => (
              <div key={item.itemId} className="flex justify-between gap-3 text-sm">
                <span className="text-gray-700 dark:text-gray-300">
                  {item.productName}
                  {item.variantName && <span className="ml-1 text-xs text-gray-400">({item.variantName})</span>}
                  <span className="ml-2 text-gray-400">{item.qty} × {formatRupiah(item.unitPrice)}</span>
                </span>
                <span className="shrink-0 text-gray-700 dark:text-gray-300">{formatRupiah(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Dibayar: {formatRupiah(trx.paymentAmount)}</span>
            <span>Kembalian: {formatRupiah(trx.changeAmount)}</span>
          </div>
          {trx.notes && <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">📝 {trx.notes}</p>}
          {trx.paymentMethod === "qris" && trx.status === "paid" && trx.paidAt && (
            <p className="mb-3 text-xs text-green-600 dark:text-green-400">
              ✓ Pembayaran QRIS dikonfirmasi {trx.confirmedBy?.name ? `oleh ${trx.confirmedBy.name} ` : ""}• {formatDateTime(trx.paidAt)}
            </p>
          )}
          {trx.status === "cancelled" && (
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Dibatalkan {trx.cancelledBy?.name ? `oleh ${trx.cancelledBy.name} ` : ""}{trx.cancelledAt ? `• ${formatDateTime(trx.cancelledAt)}` : ""}
              {trx.cancelReason ? ` — ${trx.cancelReason}` : ""}. Stok tidak berubah.
            </p>
          )}
          {trx.status === "paid" && (
            <button
              onClick={() => onPrint(trx)}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <PrinterIcon className="h-3.5 w-3.5" /> Lihat & Cetak Struk
            </button>
          )}
          {trx.status === "pending_payment" && (
            <button
              onClick={() => onShowQris(trx)}
              className="flex items-center gap-1.5 rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yellow-600"
            >
              <QrCodeIcon className="h-3.5 w-3.5" /> Tampilkan QRIS & Konfirmasi
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Keranjang di form transaksi ───────────────────────────────────
// key = variantId (atau productId jika produk tanpa varian), sama dengan
// kunci stok di resolveLine, sehingga satu varian = satu baris keranjang.
type DraftItem = { key: string; productId: string; variantId: string; qty: number };

// Satu kartu katalog per varian (produk tanpa varian = satu kartu)
type CatalogEntry = {
  key:         string;
  productId:   string;
  variantId:   string;
  productName: string;
  variantName: string;
  size:        string;
  category:    string;
  imageUrl:    string | null;
  price:       number;
  stock:       number;
};

const buildCatalog = (products: Product[] | undefined): CatalogEntry[] => {
  const entries: CatalogEntry[] = [];
  for (const p of products ?? []) {
    const variants = (p.Variants ?? []).filter((v) => v.isActive !== false);
    if (variants.length === 0) {
      entries.push({
        key: p.productId, productId: p.productId, variantId: "",
        productName: p.name, variantName: "", size: "", category: p.category ?? "",
        imageUrl: p.imageUrl || null, price: p.price ?? 0, stock: p.stockToko ?? 0,
      });
      continue;
    }
    for (const v of variants) {
      entries.push({
        key: v.variantId, productId: p.productId, variantId: v.variantId,
        productName: p.name, variantName: v.name, size: showSize(v.value) ? v.value : "",
        category: p.category ?? "",
        // foto varian; jika kosong pakai foto sampul produk
        imageUrl: v.imageUrl || p.imageUrl || null,
        price: v.price ?? p.price ?? 0, stock: v.stockToko ?? 0,
      });
    }
  }
  // yang masih ada stoknya di depan (urutan produk dari server tetap)
  return entries.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
};

// Foto produk/varian; tanpa foto tampil kotak pink muda dengan ikon
const ProductPhoto = ({ src, alt, className }: { src: string | null; alt: string; className: string }) =>
  src ? (
    <Image src={src} alt={alt} width={160} height={160} unoptimized className={`${className} object-cover`} />
  ) : (
    <div className={`${className} flex items-center justify-center bg-brand-50 text-brand-300 dark:bg-gray-700 dark:text-gray-500`}>
      <ImageIcon className="h-1/3 w-1/3" />
    </div>
  );

// Tanggal & jam transaksi: terisi otomatis (jam berjalan) dan tidak bisa
// diubah. Waktu yang tersimpan = waktu server saat transaksi diproses.
const LiveDateTimeField = ({ inputCss }: { inputCss: string }) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const text =
    now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) +
    " • " +
    now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" });

  return (
    <div>
      <label htmlFor="trx-datetime" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        Tanggal & Waktu Transaksi
      </label>
      <div className="relative">
        <CalendarClockIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
        <input
          id="trx-datetime"
          type="text"
          readOnly
          tabIndex={-1}
          value={text}
          title="Terisi otomatis dan tidak bisa diubah"
          className={`${inputCss} cursor-not-allowed pl-8 pr-8 tabular-nums`}
        />
        <LockIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
      </div>
      <p className="mt-1 text-[11px] text-gray-400">Otomatis, mengikuti waktu transaksi diproses. Tidak bisa diubah.</p>
    </div>
  );
};

// Harga & stok toko dari katalog untuk satu baris
const resolveLine = (products: Product[] | undefined, item: DraftItem) => {
  const product = products?.find((p) => p.productId === item.productId);
  const variants = (product?.Variants ?? []).filter((v) => v.isActive !== false);
  const variant = variants.find((v) => v.variantId === item.variantId);
  const needsVariant = variants.length > 0;
  const price = needsVariant ? (variant ? variant.price ?? product?.price ?? 0 : 0) : product?.price ?? 0;
  const stock = needsVariant ? variant?.stockToko ?? 0 : product?.stockToko ?? 0;
  const stockKey = needsVariant ? item.variantId : item.productId;
  const label = product ? (variant ? `${product.name} - ${variant.name}` : product.name) : "";
  return { product, variants, variant, needsVariant, price, stock, stockKey, label };
};

// ── Halaman ───────────────────────────────────────────────────────
const TransactionsPage = () => {
  const isDarkMode  = useAppSelector((s) => s.global.isDarkMode);
  const currentUser = useAppSelector((s) => s.global.currentUser);
  const role        = currentUser?.role ?? "";
  const canCreate   = role === "admin_toko";

  // Filter riwayat (default: bulan ini, tanggal lokal)
  const today    = toLocalISODate(new Date());
  const firstDay = toLocalISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [startDate, setStartDate]   = useState(firstDay);
  const [endDate, setEndDate]       = useState(today);
  const [payment, setPayment]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch]         = useState("");
  const [filterError, setFilterError] = useState("");
  const [applied, setApplied] = useState<TransactionFilter>({ startDate: firstDay, endDate: today });

  const { data: transactions, isLoading, isError, isFetching } = useGetTransactionsQuery(applied);
  const { data: stockToko } = useGetStockTokoQuery(undefined, { skip: !canCreate });
  const { data: storeSettings } = useGetStoreSettingsQuery();
  const store: StoreInfo = storeSettings ?? DEFAULT_STORE;
  const qrisReady = !!storeSettings?.qrisConfigured;
  const [createTransaction, { isLoading: submitting }] = useCreateTransactionMutation();
  const [confirmPayment, { isLoading: confirming }] = useConfirmTransactionPaymentMutation();
  const [cancelTransaction, { isLoading: cancelling }] = useCancelTransactionMutation();

  // Modal pembayaran QRIS
  const [qrisTarget, setQrisTarget]   = useState<Transaction | null>(null);
  const [qrisChecked, setQrisChecked] = useState(false);
  const [qrisCancelMode, setQrisCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [qrisError, setQrisError]     = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [printTarget, setPrintTarget]   = useState<Transaction | null>(null);
  const [modalError, setModalError]     = useState("");
  const [printError, setPrintError]     = useState("");

  // Form
  const [customerName, setCustomerName]   = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | "qris">("cash");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [notes, setNotes]                 = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [catalogSearch, setCatalogSearch]     = useState("");
  const [catalogCategory, setCatalogCategory] = useState("");

  const applyFilter = () => {
    if (startDate && endDate && startDate > endDate) {
      setFilterError("Tanggal awal tidak boleh setelah tanggal akhir");
      return;
    }
    setFilterError("");
    setApplied({
      startDate:     startDate || undefined,
      endDate:       endDate || undefined,
      paymentMethod: payment || undefined,
      search:        search.trim() || undefined,
      status:        (statusFilter || undefined) as TransactionFilter["status"],
    });
  };

  const openCreate = () => {
    setModalError("");
    setCustomerName("");
    setPaymentMethod("cash");
    setPaymentAmount(0);
    setNotes("");
    setItems([]);
    setCatalogSearch("");
    setCatalogCategory("");
    setIsCreateOpen(true);
  };

  // Klik kartu katalog: tambah ke keranjang, atau +1 jika sudah ada
  const addToCart = (entry: CatalogEntry) =>
    setItems((p) =>
      p.some((it) => it.key === entry.key)
        ? p.map((it) => (it.key === entry.key ? { ...it, qty: (it.qty || 0) + 1 } : it))
        : [...p, { key: entry.key, productId: entry.productId, variantId: entry.variantId, qty: 1 }]
    );
  const removeItem = (key: string) => setItems((p) => p.filter((it) => it.key !== key));
  const patchItem = (key: string, patch: Partial<DraftItem>) =>
    setItems((p) => p.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  // Katalog (kartu per varian) sesuai pencarian & kategori
  const catalog = buildCatalog(stockToko);
  const categories = [...new Set(catalog.map((c) => c.category).filter(Boolean))].sort();
  const catalogQuery = catalogSearch.trim().toLowerCase();
  const shownCatalog = catalog.filter(
    (c) =>
      (!catalogCategory || c.category === catalogCategory) &&
      (!catalogQuery || `${c.productName} ${c.variantName} ${c.size}`.toLowerCase().includes(catalogQuery))
  );

  // Hitung total & cek stok (baris dengan varian sama dijumlahkan)
  const lines = items.map((it) => ({ it, ...resolveLine(stockToko, it) }));
  const requested = new Map<string, number>();
  for (const l of lines) {
    if (l.stockKey) requested.set(l.stockKey, (requested.get(l.stockKey) ?? 0) + (l.it.qty || 0));
  }
  const totalAmount = lines.reduce((s, l) => s + l.price * (l.it.qty || 0), 0);
  const totalQty    = lines.reduce((s, l) => s + (l.it.qty || 0), 0);
  const stockProblems = lines.filter((l) => l.stockKey && (requested.get(l.stockKey) ?? 0) > l.stock);
  const effectivePaid = paymentMethod === "cash" ? paymentAmount : totalAmount;
  const changeAmount  = effectivePaid - totalAmount;

  const handleCreate = async () => {
    setModalError("");

    if (lines.length === 0) return setModalError("Keranjang masih kosong. Pilih produk dari katalog.");
    for (const l of lines) {
      if (!l.product) return setModalError("Ada produk di keranjang yang sudah tidak tersedia. Hapus lalu pilih ulang.");
      if (l.needsVariant && !l.variant) return setModalError(`Pilih varian "${l.product.name}"`);
      if (!Number.isInteger(l.it.qty) || l.it.qty < 1) return setModalError(`Jumlah "${l.label}" minimal 1`);
      if (!(l.price > 0)) return setModalError(`Harga "${l.label}" belum diatur`);
    }
    if (stockProblems.length > 0) {
      const l = stockProblems[0];
      return setModalError(`Stok toko "${l.label}" tidak cukup. Tersedia ${l.stock}, diminta ${requested.get(l.stockKey)}.`);
    }
    if (paymentMethod === "cash") {
      if (!(paymentAmount > 0)) return setModalError("Isi jumlah uang yang dibayar");
      if (paymentAmount < totalAmount) {
        return setModalError(`Pembayaran kurang ${formatRupiah(totalAmount - paymentAmount)}. Total ${formatRupiah(totalAmount)}.`);
      }
    }

    try {
      const payload: NewTransaction = {
        customerName:  customerName.trim() || undefined,
        paymentMethod,
        paymentAmount: paymentMethod === "cash" ? paymentAmount : undefined,
        notes:         notes.trim() || undefined,
        items: lines.map((l) => ({
          productId: l.it.productId,
          variantId: l.it.variantId || undefined,
          qty:       l.it.qty,
        })),
      };
      const result = await createTransaction(payload).unwrap();
      setIsCreateOpen(false);
      if (result.status === "pending_payment") {
        openQris(result); // QRIS: tunggu konfirmasi pembayaran
      } else {
        setPrintError("");
        setPrintTarget(result); // tampilkan struk otomatis
      }
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, "Gagal membuat transaksi"));
    }
  };

  const openQris = (trx: Transaction) => {
    setQrisTarget(trx);
    setQrisChecked(false);
    setQrisCancelMode(false);
    setCancelReason("");
    setQrisError("");
  };

  const handleConfirmPayment = async () => {
    if (!qrisTarget) return;
    setQrisError("");
    try {
      const paid = await confirmPayment(qrisTarget.transactionId).unwrap();
      setQrisTarget(null);
      setPrintError("");
      setPrintTarget(paid);
    } catch (err) {
      setQrisError(getErrorMessage(err, "Gagal mengonfirmasi pembayaran"));
    }
  };

  const handleCancelQris = async () => {
    if (!qrisTarget) return;
    setQrisError("");
    try {
      await cancelTransaction({ transactionId: qrisTarget.transactionId, reason: cancelReason.trim() || undefined }).unwrap();
      setQrisTarget(null);
    } catch (err) {
      setQrisError(getErrorMessage(err, "Gagal membatalkan transaksi"));
    }
  };

  const handlePrint = () => {
    if (!printTarget) return;
    setPrintError("");
    const win = window.open("", "_blank", "width=420,height=640");
    if (!win) {
      setPrintError("Jendela cetak diblokir browser. Izinkan pop-up untuk situs ini, lalu coba lagi.");
      return;
    }
    win.document.write(
      `<!doctype html><html><head><title>Struk ${escapeHtml(printTarget.transactionNumber)}</title>` +
      `<style>@page{margin:6mm}body{margin:0}</style></head><body>${buildStrukHtml(printTarget, store)}</body></html>`
    );
    win.document.close();
    win.onafterprint = () => win.close();
    win.focus();
    // beri waktu jendela selesai dirender sebelum dialog cetak
    setTimeout(() => win.print(), 250);
  };

  const modalBg = "fixed inset-0 z-50 flex items-center justify-center";
  const cardCss = `relative z-50 w-full max-w-lg rounded-2xl p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"}`;
  const inputCss = `block w-full rounded-lg border-2 p-2 text-sm ${isDarkMode ? "border-gray-600 bg-gray-700 text-gray-100" : "border-gray-300 bg-white text-gray-900"}`;
  const labelCss = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";
  const btnSecondary = `px-4 py-2 rounded-lg text-sm ${isDarkMode ? "bg-gray-700 text-gray-200 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`;
  const panelCss = `rounded-xl border p-4 shadow-sm ${isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`;
  const divider = isDarkMode ? "border-gray-700" : "border-gray-200";

  const list = transactions ?? [];
  const paidList   = list.filter((t) => t.status === "paid");
  const pendingCount = list.filter((t) => t.status === "pending_payment").length;
  const sumRevenue = paidList.reduce((s, t) => s + t.totalAmount, 0);
  const sumItems   = paidList.reduce((s, t) => s + t.Items.reduce((si, i) => si + i.qty, 0), 0);

  return (
    <div className="flex flex-col">
      <div className="mb-5 flex items-center justify-between">
        <Header name="Transaksi Penjualan" />
        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
          >
            <PlusCircleIcon className="h-4 w-4" /> Transaksi Baru
          </button>
        )}
      </div>

      {/* Filter */}
      <div className={`${panelCss} mb-5`}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Dari tanggal</label>
            <input type="date" value={startDate} max={today} onChange={(e) => setStartDate(e.target.value)} className={inputCss} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Sampai tanggal</label>
            <input type="date" value={endDate} max={today} onChange={(e) => setEndDate(e.target.value)} className={inputCss} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Metode</label>
            <select value={payment} onChange={(e) => setPayment(e.target.value)} className={inputCss}>
              <option value="">Semua</option>
              <option value="cash">Tunai</option>
              <option value="transfer">Transfer</option>
              <option value="qris">QRIS</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCss}>
              <option value="">Semua</option>
              <option value="paid">Lunas</option>
              <option value="pending_payment">Menunggu Pembayaran</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs text-gray-400">Cari no. transaksi / pelanggan</label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilter()}
                placeholder="TRX-... atau nama"
                className={`${inputCss} pl-8`}
              />
            </div>
          </div>
          <button onClick={applyFilter} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">
            Tampilkan
          </button>
        </div>
        {filterError && <p className="mt-2 text-xs text-red-500">{filterError}</p>}
        <p className="mt-2 text-xs text-gray-400">
          {applied.startDate ? formatLongDate(applied.startDate) : "Awal"} — {applied.endDate ? formatLongDate(applied.endDate) : "Sekarang"}
          {isFetching && " • memuat..."}
        </p>
      </div>

      {isLoading && <div className="py-4 dark:text-gray-100">Memuat transaksi...</div>}
      {isError && <div className="py-4 text-red-500">Gagal memuat data transaksi</div>}

      {/* Ringkasan sesuai filter */}
      {!isLoading && !isError && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={panelCss}>
            <p className="mb-1 text-xs text-gray-400">Transaksi Lunas</p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{paidList.length.toLocaleString("id-ID")}</p>
          </div>
          <div className={panelCss}>
            <p className="mb-1 text-xs text-gray-400">Total Pendapatan</p>
            <p className="text-xl font-bold text-green-600">{formatRupiah(sumRevenue)}</p>
          </div>
          <div className={panelCss}>
            <p className="mb-1 text-xs text-gray-400">Item Terjual</p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{sumItems.toLocaleString("id-ID")}</p>
          </div>
        </div>
      )}

      {!isLoading && !isError && pendingCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
          <ClockIcon className="h-4 w-4 shrink-0" />
          {pendingCount} transaksi QRIS menunggu konfirmasi pembayaran. Buka transaksinya untuk menampilkan QRIS, konfirmasi, atau batalkan.
        </div>
      )}

      {!isLoading && !isError && (list.length > 0 ? (
        list.map((trx) => (
          <TrxCard
            key={trx.transactionId}
            trx={trx}
            isDarkMode={isDarkMode}
            onPrint={(t) => { setPrintError(""); setPrintTarget(t); }}
            onShowQris={openQris}
          />
        ))
      ) : (
        <div className="py-16 text-center text-gray-400">
          <ShoppingCartIcon className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>Tidak ada transaksi pada filter ini</p>
        </div>
      ))}

      {/* ── MODAL TRANSAKSI BARU ───────────────────────────── */}
      {/* Kiri: katalog kartu bergambar per varian. Kanan: waktu, keranjang & pembayaran. */}
      {isCreateOpen && (
        <div className={modalBg}>
          {/* klik latar hanya menutup jika keranjang kosong (agar isian tidak hilang tak sengaja) */}
          <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && items.length === 0 && setIsCreateOpen(false)} />
          <div className={`relative z-50 mx-4 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl shadow-2xl lg:h-[88vh] ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"}`}>
            <div className={`flex shrink-0 items-center justify-between border-b px-5 py-4 ${divider}`}>
              <div>
                <h3 className="text-lg font-bold">Transaksi Penjualan Baru</h3>
                <p className="text-xs text-gray-400">Klik produk di katalog untuk menambahkannya ke keranjang</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} aria-label="Tutup"><XIcon className="h-5 w-5 text-gray-400" /></button>
            </div>

            <div className={`min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden ${slimScroll}`}>
              {/* ── Katalog ── */}
              <section className={`flex min-h-0 flex-col p-5 lg:border-r ${divider}`}>
                <div className="relative shrink-0">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Cari produk atau varian..."
                    className={`${inputCss} pl-9`}
                  />
                </div>
                {categories.length > 1 && (
                  <div className="mt-3 flex shrink-0 flex-wrap gap-1.5">
                    {["", ...categories].map((c) => (
                      <button
                        key={c || "semua"}
                        type="button"
                        onClick={() => setCatalogCategory(c)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          catalogCategory === c
                            ? "bg-brand-500 text-white"
                            : isDarkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-600"
                        }`}
                      >
                        {c || "Semua"}
                      </button>
                    ))}
                  </div>
                )}

                <div className={`mt-3 grid max-h-[50vh] auto-rows-max grid-cols-2 content-start gap-3 overflow-y-auto pb-1 pr-1 sm:grid-cols-3 lg:max-h-none lg:min-h-0 lg:flex-1 xl:grid-cols-4 ${slimScroll}`}>
                  {!stockToko ? (
                    <p className="col-span-full py-10 text-center text-sm text-gray-400">Memuat produk...</p>
                  ) : shownCatalog.length === 0 ? (
                    <p className="col-span-full py-10 text-center text-sm text-gray-400">
                      {catalog.length === 0 ? "Belum ada produk aktif" : "Produk tidak ditemukan"}
                    </p>
                  ) : (
                    shownCatalog.map((c) => {
                      const inCart = requested.get(c.key) ?? 0;
                      const out = c.stock <= 0;
                      const atMax = !out && inCart >= c.stock;
                      const title = c.variantName || c.productName;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          disabled={out || atMax || c.price <= 0}
                          onClick={() => addToCart(c)}
                          title={out ? "Stok toko habis" : atMax ? "Semua stok sudah ada di keranjang" : `Tambah ${title}`}
                          className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed ${
                            inCart > 0
                              ? "border-brand-400 ring-2 ring-brand-200 dark:ring-brand-500/30"
                              : isDarkMode ? "border-gray-700 enabled:hover:border-brand-400" : "border-gray-200 enabled:hover:border-brand-300 enabled:hover:shadow-md"
                          } ${isDarkMode ? "bg-gray-900/40" : "bg-white"}`}
                        >
                          <div className="relative aspect-square w-full shrink-0 overflow-hidden">
                            <ProductPhoto
                              src={c.imageUrl}
                              alt={title}
                              className={`h-full w-full transition-transform duration-300 group-enabled:group-hover:scale-105 ${out ? "opacity-40 grayscale" : ""}`}
                            />
                            {inCart > 0 && (
                              <span className="absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-500 px-1.5 text-xs font-bold text-white shadow">
                                {inCart}
                              </span>
                            )}
                            {out && (
                              <span className="absolute inset-x-0 bottom-0 bg-gray-900/60 py-1 text-center text-[11px] font-semibold text-white">Habis</span>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col p-2.5">
                            {c.variantName && <p className="truncate text-[11px] text-gray-400">{c.productName}</p>}
                            <p className="line-clamp-2 text-sm font-semibold leading-snug">
                              {title}
                              {c.size && <span className="ml-1 text-xs font-normal text-gray-400">({c.size})</span>}
                            </p>
                            <div className="mt-auto flex items-end justify-between gap-1 pt-1.5">
                              <span className="text-sm font-bold text-brand-600 dark:text-brand-300">
                                {c.price > 0 ? formatRupiah(c.price) : "—"}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  out
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                    : isLowToko(c.stock)
                                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                }`}
                              >
                                Stok {c.stock}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              {/* ── Waktu, keranjang & pembayaran ── */}
              <section className={`flex min-h-0 flex-col gap-4 border-t p-5 lg:overflow-y-auto lg:border-t-0 ${divider} ${slimScroll}`}>
                <LiveDateTimeField inputCss={inputCss} />

                <div>
                  <label htmlFor="trx-customer" className={labelCss}>Nama Pelanggan (opsional)</label>
                  <input id="trx-customer" type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nama pelanggan..." className={inputCss} />
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <ShoppingCartIcon className="h-4 w-4 text-brand-500" /> Keranjang
                    {lines.length > 0 && <span className="font-normal text-gray-400">({lines.length} produk)</span>}
                  </p>
                  {lines.length === 0 ? (
                    <div className={`rounded-xl border-2 border-dashed py-8 text-center text-sm text-gray-400 ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
                      <ShoppingCartIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      Keranjang masih kosong
                      <p className="text-xs">Pilih produk dari katalog</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {lines.map((l) => {
                        const totalReq = requested.get(l.stockKey) ?? 0;
                        const overStock = !!l.stockKey && totalReq > l.stock;
                        const qty = l.it.qty || 0;
                        return (
                          <li
                            key={l.it.key}
                            className={`rounded-xl border p-2.5 ${
                              overStock
                                ? "border-red-400 bg-red-50/60 dark:bg-red-900/20"
                                : isDarkMode ? "border-gray-700 bg-gray-700/40" : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            <div className="flex gap-2.5">
                              <ProductPhoto
                                src={l.variant?.imageUrl || l.product?.imageUrl || null}
                                alt={l.label || "Produk"}
                                className="h-14 w-14 shrink-0 rounded-lg"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="min-w-0 text-sm font-semibold leading-tight">
                                    {l.variant ? l.variant.name : l.product?.name ?? "Produk tidak tersedia"}
                                    <span className="block truncate text-xs font-normal text-gray-500 dark:text-gray-400">
                                      {l.variant ? l.product?.name : ""}
                                      {l.variant && showSize(l.variant.value) ? ` • ${l.variant.value}` : ""}
                                    </span>
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => removeItem(l.it.key)}
                                    title="Hapus dari keranjang"
                                    className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
                                  >
                                    <Trash2Icon className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="mt-1.5 flex items-center justify-between gap-2">
                                  <div className={`flex items-center overflow-hidden rounded-lg border ${isDarkMode ? "border-gray-600 bg-gray-800" : "border-gray-300 bg-white"}`}>
                                    <button
                                      type="button"
                                      onClick={() => patchItem(l.it.key, { qty: Math.max(1, qty - 1) })}
                                      disabled={qty <= 1}
                                      aria-label="Kurangi jumlah"
                                      className="flex h-7 w-7 items-center justify-center text-gray-500 hover:text-brand-600 disabled:opacity-30"
                                    >
                                      <MinusIcon className="h-3.5 w-3.5" />
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      max={l.stock || undefined}
                                      step={1}
                                      value={qty || ""}
                                      onChange={(e) => patchItem(l.it.key, { qty: Math.floor(Number(e.target.value)) })}
                                      aria-label="Jumlah"
                                      className={`h-7 w-11 border-x bg-transparent text-center text-sm font-semibold focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isDarkMode ? "border-gray-600" : "border-gray-300"}`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => patchItem(l.it.key, { qty: qty + 1 })}
                                      disabled={qty >= l.stock}
                                      aria-label="Tambah jumlah"
                                      className="flex h-7 w-7 items-center justify-center text-gray-500 hover:text-brand-600 disabled:opacity-30"
                                    >
                                      <PlusIcon className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[11px] text-gray-400">{l.price > 0 ? `${formatRupiah(l.price)} / pcs` : "Harga belum diatur"}</p>
                                    <p className="text-sm font-bold">{formatRupiah(l.price * qty)}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {overStock && (
                              <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                                <AlertTriangleIcon className="h-3.5 w-3.5" /> Stok tidak cukup: tersedia {l.stock}, diminta {totalReq}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 dark:bg-brand-500/10">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Total Belanja <span className="font-normal text-gray-400">({totalQty} item)</span>
                  </span>
                  <span className="text-xl font-bold text-brand-600 dark:text-brand-300">{formatRupiah(totalAmount)}</span>
                </div>

                <div>
                  <label className={labelCss}>Metode Pembayaran</label>
                  <div className="flex gap-2">
                    {(["cash", "transfer", "qris"] as const).map((m) => {
                      const Icon = PAYMENT_ICONS[m];
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={m === "qris" && !qrisReady}
                          title={m === "qris" && !qrisReady ? "QRIS toko belum diatur Super Admin" : undefined}
                          onClick={() => setPaymentMethod(m)}
                          className={`flex flex-1 flex-col items-center gap-1 rounded-lg border-2 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            paymentMethod === m
                              ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                              : isDarkMode ? "border-gray-600 text-gray-400 hover:border-gray-500" : "border-gray-200 text-gray-600 hover:border-brand-200"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {PAYMENT_LABELS[m]}
                        </button>
                      );
                    })}
                  </div>
                  {!qrisReady && (
                    <p className="mt-1 text-xs text-gray-400">QRIS belum aktif — Super Admin perlu mengunggah QRIS toko di Pengaturan.</p>
                  )}
                </div>

                {paymentMethod === "cash" ? (
                  <div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCss}>Uang Dibayar</label>
                        <PriceInput value={paymentAmount} onChange={setPaymentAmount} className={inputCss} />
                      </div>
                      <div>
                        <label htmlFor="trx-change" className={labelCss}>Kembalian</label>
                        <input
                          id="trx-change"
                          type="text"
                          readOnly
                          tabIndex={-1}
                          value={paymentAmount > 0 && changeAmount < 0 ? `Kurang ${formatRupiah(-changeAmount)}` : formatRupiah(paymentAmount > 0 ? changeAmount : 0)}
                          title="Dihitung otomatis"
                          className={`block w-full cursor-default rounded-lg border-2 p-2 text-sm font-bold tabular-nums ${
                            paymentAmount <= 0
                              ? isDarkMode ? "border-gray-600 bg-gray-700/60 text-gray-400" : "border-gray-200 bg-gray-50 text-gray-400"
                              : changeAmount >= 0
                                ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : "border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[totalAmount, 50000, 100000, 200000]
                        .filter((v, idx, arr) => v > 0 && v >= totalAmount && arr.indexOf(v) === idx)
                        .map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setPaymentAmount(v)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${isDarkMode ? "bg-gray-700 text-gray-200 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-brand-50 hover:text-brand-600"}`}
                          >
                            {v === totalAmount ? "Uang pas" : formatRupiah(v)}
                          </button>
                        ))}
                    </div>
                  </div>
                ) : paymentMethod === "qris" ? (
                  <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    Setelah diproses, QRIS bernominal {formatRupiah(totalAmount)} akan tampil untuk dipindai pembeli.
                    Stok baru dikurangi setelah Anda mengonfirmasi dana masuk.
                  </p>
                ) : (
                  <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    Pembayaran {PAYMENT_LABELS[paymentMethod]} dicatat sebesar total belanja ({formatRupiah(totalAmount)}), tanpa kembalian.
                  </p>
                )}

                <div>
                  <label htmlFor="trx-notes" className={labelCss}>Catatan (opsional)</label>
                  <textarea id="trx-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCss} resize-none`} />
                </div>
              </section>
            </div>

            <div className={`shrink-0 border-t px-5 py-3 ${divider}`}>
              {modalError && (
                <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{modalError}</div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsCreateOpen(false)} className={btnSecondary}>Batal</button>
                <button
                  onClick={handleCreate}
                  disabled={submitting || stockProblems.length > 0 || totalAmount <= 0}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                >
                  {paymentMethod === "qris" ? <QrCodeIcon className="h-4 w-4" /> : <ReceiptIcon className="h-4 w-4" />}
                  {submitting ? "Memproses..." : paymentMethod === "qris" ? "Buat QRIS" : "Proses Transaksi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PEMBAYARAN QRIS ─────────────────────────── */}
      {qrisTarget && qrisTarget.qrisPayload && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/60" />
          <div className={`${cardCss} max-w-md text-center`}>
            <div className="mb-1 flex items-center justify-between text-left">
              <h3 className="text-lg font-bold">Pembayaran QRIS</h3>
              <button onClick={() => setQrisTarget(null)} title="Tutup (transaksi tetap menunggu)">
                <XIcon className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <p className="mb-3 text-left text-xs text-gray-500 dark:text-gray-400">
              {qrisTarget.transactionNumber} • {storeSettings?.qrisMerchant ?? store.storeName}
            </p>

            <div className="mb-2 flex justify-center">
              <QrisCode payload={qrisTarget.qrisPayload} size={260} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total yang harus dibayar</p>
            <p className="mb-3 text-3xl font-bold text-blue-600 dark:text-blue-400">{formatRupiah(qrisTarget.totalAmount)}</p>

            <ol className="mb-4 space-y-1 rounded-lg bg-gray-50 p-3 text-left text-xs text-gray-600 dark:bg-gray-700/50 dark:text-gray-300">
              <li>1. Pembeli memindai QR dengan aplikasi bank / e-wallet (nominal terisi otomatis).</li>
              <li>2. Cek <b>notifikasi dana masuk</b> di aplikasi/mesin QRIS toko sebesar {formatRupiah(qrisTarget.totalAmount)}.</li>
              <li>3. Setelah dana masuk, tekan <b>Pembayaran Diterima</b>. Stok berkurang & struk terbit.</li>
            </ol>

            {qrisError && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{qrisError}</div>
            )}

            {!qrisCancelMode ? (
              <>
                <label className="mb-3 flex items-start gap-2 text-left text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={qrisChecked} onChange={(e) => setQrisChecked(e.target.checked)} className="mt-0.5" />
                  Saya sudah melihat dana {formatRupiah(qrisTarget.totalAmount)} masuk ke QRIS toko.
                </label>
                <button
                  onClick={handleConfirmPayment}
                  disabled={!qrisChecked || confirming}
                  className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 py-2.5 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50"
                >
                  <CheckCircleIcon className="h-4 w-4" /> {confirming ? "Memproses..." : "Pembayaran Diterima"}
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setQrisTarget(null)} className={`${btnSecondary} flex-1`}>Tutup, bayar nanti</button>
                  <button onClick={() => setQrisCancelMode(true)} className="flex flex-1 items-center justify-center gap-1 rounded-lg px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30">
                    <BanIcon className="h-4 w-4" /> Batalkan
                  </button>
                </div>
              </>
            ) : (
              <div className="text-left">
                <label className={labelCss}>Alasan pembatalan (opsional)</label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="mis. pembeli batal / ganti bayar tunai"
                  className={`${inputCss} mb-3`}
                />
                <div className="flex gap-2">
                  <button onClick={() => setQrisCancelMode(false)} className={`${btnSecondary} flex-1`}>Kembali</button>
                  <button onClick={handleCancelQris} disabled={cancelling} className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60">
                    {cancelling ? "Membatalkan..." : "Ya, Batalkan Transaksi"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL STRUK ────────────────────────────────────── */}
      {printTarget && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setPrintTarget(null)} />
          <div className={`relative z-50 mx-4 max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className={`flex items-center justify-between border-b px-5 py-3 ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
              <h3 className={`text-sm font-bold ${isDarkMode ? "text-gray-100" : "text-gray-800"}`}>Struk {printTarget.transactionNumber}</h3>
              <button onClick={() => setPrintTarget(null)}><XIcon className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-4" dangerouslySetInnerHTML={{ __html: buildStrukHtml(printTarget, store) }} />
            {printError && <p className="px-5 pb-2 text-xs text-red-500">{printError}</p>}
            <div className={`flex justify-end gap-2 border-t px-5 py-3 ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
              <button onClick={() => setPrintTarget(null)} className={btnSecondary}>Tutup</button>
              <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600">
                <PrinterIcon className="h-4 w-4" /> Cetak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;
