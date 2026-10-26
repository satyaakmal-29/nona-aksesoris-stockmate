"use client";

import { useState } from "react";
import Image from "next/image";
import Header from "@/app/(components)/Header";
import ProofImageInput, { ProofImageView } from "@/app/(components)/ProofImageInput";
import { useAppSelector } from "@/app/redux";
import {
  useGetPurchaseOrdersQuery,
  useGetPurchaseOrderByIdQuery,
  useCreatePurchaseOrderMutation,
  useReceivePurchaseOrderMutation,
  useGetProductsQuery,
  PurchaseOrder,
  PurchaseOrderItem,
  NewPurchaseOrder,
} from "@/state/api";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  ImageIcon,
  PackageIcon,
  PlusCircleIcon,
  ShoppingCartIcon,
  XIcon,
} from "lucide-react";

// Purchase Order = pembelian barang ke SUPPLIER.
// Super Admin membuat (dengan bukti nota) → Admin Gudang memvalidasi penerimaan.

// ── Helpers ───────────────────────────────────────────────────────
const formatRupiah = (n: number) =>
  "Rp " + Math.round(n).toLocaleString("id-ID");

const formatDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const formatDateTime = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// Tanggal hari ini (zona waktu lokal) dalam format YYYY-MM-DD
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const showSize = (v?: string) => !!v && v !== "-";

const getErrorMessage = (err: unknown, fallback: string) => {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
};

// Selisih total nota vs total item yang masih ditoleransi server
const TOTAL_TOLERANCE = 0.5;

// ── Input harga Rupiah (hanya angka, titik ribuan otomatis) ───────
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
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
      Rp
    </span>
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

// ── Thumbnail ─────────────────────────────────────────────────────
const Thumb = ({ src, alt }: { src?: string | null; alt: string }) =>
  src ? (
    <Image
      src={src}
      alt={alt}
      width={36}
      height={36}
      unoptimized
      className="h-9 w-9 shrink-0 rounded-md object-cover"
    />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700">
      <PackageIcon className="h-4 w-4 text-gray-400" />
    </div>
  );

// ── Status Badge ──────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending:  { label: "Menunggu Penerimaan", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300", icon: <ClockIcon className="h-3 w-3" /> },
    received: { label: "Diterima",            color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",     icon: <CheckCircleIcon className="h-3 w-3" /> },
  };
  const s = map[status] ?? { label: status, color: "bg-gray-100 text-gray-700", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.color}`}>
      {s.icon}
      {s.label}
    </span>
  );
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "",         label: "Semua" },
  { value: "pending",  label: "Menunggu Penerimaan" },
  { value: "received", label: "Diterima" },
];

// ── Info produk/varian pada item ──────────────────────────────────
const ItemInfo = ({ item }: { item: PurchaseOrderItem }) => {
  const v = item.variant;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Thumb
        src={v?.imageUrl ?? item.product?.imageUrl}
        alt={item.product?.name ?? "Produk"}
      />
      <div className="min-w-0">
        <p className="truncate font-medium text-gray-800 dark:text-gray-200">
          {item.product?.name ?? item.productId}
        </p>
        {v && (
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {v.name}
            {showSize(v.value) && <span className="ml-1 text-gray-400">• {v.value}</span>}
          </p>
        )}
      </div>
    </div>
  );
};

// ── Baris item pada kartu ─────────────────────────────────────────
const ItemRow = ({ item }: { item: PurchaseOrderItem }) => {
  const received = item.qtyReceived;
  const short = received !== null && received !== undefined && received < item.qtyOrdered;

  return (
    <div className="text-sm">
      <div className="flex items-center gap-3">
        <ItemInfo item={item} />
        <div className="shrink-0 text-right text-xs text-gray-500 dark:text-gray-400">
          <p>
            {item.qtyOrdered} unit × {formatRupiah(item.unitCost)}
          </p>
          <p className="font-semibold text-gray-700 dark:text-gray-200">
            {formatRupiah(item.subtotal)}
          </p>
          {received !== null && received !== undefined && (
            <p className={short ? "font-semibold text-red-500" : "text-green-600 dark:text-green-400"}>
              Diterima: {received}
            </p>
          )}
        </div>
      </div>
      {item.receiveNote && (
        <p className="ml-12 mt-1 text-xs text-red-500">Alasan selisih: {item.receiveNote}</p>
      )}
    </div>
  );
};

// ── Kartu PO ──────────────────────────────────────────────────────
const POCard = ({
  po,
  role,
  isDarkMode,
  onReceive,
  onViewProof,
}: {
  po: PurchaseOrder;
  role: string;
  isDarkMode: boolean;
  onReceive: (po: PurchaseOrder) => void;
  onViewProof: (po: PurchaseOrder) => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`mb-3 overflow-hidden rounded-xl border shadow-sm ${
        isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
      }`}
    >
      <div
        className="flex cursor-pointer items-center justify-between gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
              {po.poNumber}
              <span className="ml-2 font-medium text-gray-500 dark:text-gray-400">
                {po.supplier}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              Nota {po.invoiceNumber} • {formatDate(po.invoiceDate)} • Resi {po.trackingNumber}
            </p>
          </div>
          <StatusBadge status={po.status} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">{po.Items.length} item</p>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              {formatRupiah(po.invoiceTotal)}
            </p>
          </div>
          {expanded ? (
            <ChevronUpIcon className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 dark:border-gray-700">
          <div className="mb-4 space-y-3">
            {po.Items.map((item) => (
              <ItemRow key={item.poItemId} item={item} />
            ))}
          </div>

          <div className="mb-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
            <p>
              Dibuat oleh {po.createdBy?.name ?? "—"} • {formatDateTime(po.createdAt)}
            </p>
            {po.notes && <p>📝 {po.notes}</p>}
            {po.status === "received" && (
              <>
                <p className="text-green-600 dark:text-green-400">
                  ✅ Diterima oleh {po.validatedBy?.name ?? "—"} • {formatDateTime(po.receivedAt)}
                </p>
                {po.deliveryNoteNumber && <p>No. surat jalan: {po.deliveryNoteNumber}</p>}
                {po.receiveNotes && <p>Catatan penerimaan: {po.receiveNotes}</p>}
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onViewProof(po)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                isDarkMode
                  ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" /> Lihat Bukti
            </button>
            {role === "admin_gudang" && po.status === "pending" && (
              <button
                onClick={() => onReceive(po)}
                className="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600"
              >
                <CheckCircleIcon className="h-3.5 w-3.5" /> Validasi Penerimaan
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Modal Lihat Bukti (foto diambil dari endpoint detail) ─────────
const ProofModal = ({
  poId,
  cardCss,
  onClose,
}: {
  poId: string;
  cardCss: string;
  onClose: () => void;
}) => {
  const { data: detail, isLoading, isError } = useGetPurchaseOrderByIdQuery(poId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cardCss}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Bukti {detail?.poNumber ?? "Purchase Order"}</h3>
          <button onClick={onClose}>
            <XIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {isLoading && <p className="py-6 text-center text-sm text-gray-400">Memuat foto...</p>}
        {isError && <p className="py-6 text-center text-sm text-red-500">Gagal memuat bukti</p>}

        {detail && (
          <>
            <ProofImageView label="Foto Nota Pembelian" src={detail.invoiceImage} />
            {detail.status === "received" && (
              <ProofImageView label="Foto Bukti Penerimaan" src={detail.receiptImage} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────
type DraftItem = {
  productId: string;
  variantId: string;
  qtyOrdered: number;
  unitCost: number;
};

const emptyItem = (): DraftItem => ({
  productId: "",
  variantId: "",
  qtyOrdered: 1,
  unitCost: 0,
});

type ReceiveRow = { qty: number; note: string };

const PurchaseOrdersPage = () => {
  const isDarkMode = useAppSelector((s) => s.global.isDarkMode);
  const currentUser = useAppSelector((s) => s.global.currentUser);
  const role = currentUser?.role ?? "";
  const canAccess = role === "super_admin" || role === "admin_gudang";

  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: orders, isLoading, isError } = useGetPurchaseOrdersQuery(
    statusFilter || undefined,
    { skip: !canAccess }
  );
  const { data: products } = useGetProductsQuery(undefined, {
    skip: role !== "super_admin",
  });

  const [createPO] = useCreatePurchaseOrderMutation();
  const [receivePO] = useReceivePurchaseOrderMutation();

  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [proofTarget, setProofTarget] = useState<string | null>(null);

  // ── Form buat PO ──
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoiceImage, setInvoiceImage] = useState<string | null>(null);
  const [poNotes, setPoNotes] = useState("");
  const [poItems, setPoItems] = useState<DraftItem[]>([emptyItem()]);

  // ── Form validasi penerimaan ──
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [receiveRows, setReceiveRows] = useState<Record<string, ReceiveRow>>({});
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");

  const addItem = () => setPoItems((p) => [...p, emptyItem()]);
  const removeItem = (i: number) =>
    setPoItems((p) => p.filter((_, idx) => idx !== i));
  const patchItem = (i: number, patch: Partial<DraftItem>) =>
    setPoItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const patchReceiveRow = (id: string, patch: Partial<ReceiveRow>) =>
    setReceiveRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  const openCreate = () => {
    setModalError("");
    setSupplier("");
    setInvoiceNumber("");
    setTrackingNumber("");
    setInvoiceDate(todayISO());
    setInvoiceTotal(0);
    setInvoiceImage(null);
    setPoNotes("");
    setPoItems([emptyItem()]);
    setIsCreateOpen(true);
  };

  const openReceive = (po: PurchaseOrder) => {
    setModalError("");
    setReceiptImage(null);
    setDeliveryNoteNumber("");
    setReceiveNotes("");
    setReceiveRows(
      Object.fromEntries(
        po.Items.map((item) => [item.poItemId, { qty: item.qtyOrdered, note: "" }])
      )
    );
    setReceiveTarget(po);
  };

  const itemsTotal = poItems.reduce((s, i) => s + i.qtyOrdered * i.unitCost, 0);
  const totalDiff = invoiceTotal - itemsTotal;
  const totalMismatch = invoiceTotal > 0 && Math.abs(totalDiff) > TOTAL_TOLERANCE;

  const handleCreatePO = async () => {
    setModalError("");

    if (!supplier.trim()) return setModalError("Nama supplier wajib diisi");
    if (!invoiceNumber.trim()) return setModalError("Nomor nota / invoice wajib diisi");
    if (!trackingNumber.trim()) return setModalError("Nomor resi / pengiriman wajib diisi");
    if (!invoiceDate) return setModalError("Tanggal nota wajib diisi");
    if (invoiceDate > todayISO()) return setModalError("Tanggal nota tidak boleh di masa depan");
    if (!(invoiceTotal > 0)) return setModalError("Total nota harus lebih dari 0");
    if (!invoiceImage) return setModalError("Foto nota wajib diunggah");

    for (let i = 0; i < poItems.length; i++) {
      const it = poItems[i];
      const p = products?.find((pr) => pr.productId === it.productId);
      if (!p) return setModalError(`Item ${i + 1}: pilih produk`);
      const activeVariants = (p.Variants ?? []).filter((v) => v.isActive);
      if (activeVariants.length > 0 && !it.variantId) {
        return setModalError(`Item ${i + 1}: pilih varian untuk "${p.name}"`);
      }
      if (!Number.isInteger(it.qtyOrdered) || it.qtyOrdered < 1) {
        return setModalError(`Item ${i + 1}: jumlah minimal 1`);
      }
      if (!(it.unitCost > 0)) {
        return setModalError(`Item ${i + 1}: harga beli satuan harus lebih dari 0`);
      }
    }

    if (totalMismatch) {
      return setModalError(
        `Total nota (${formatRupiah(invoiceTotal)}) tidak sama dengan total item (${formatRupiah(itemsTotal)}). Periksa kembali jumlah dan harga.`
      );
    }

    setSubmitting(true);
    try {
      const payload: NewPurchaseOrder = {
        supplier: supplier.trim(),
        invoiceNumber: invoiceNumber.trim(),
        trackingNumber: trackingNumber.trim(),
        invoiceDate,
        invoiceTotal,
        invoiceImage,
        notes: poNotes.trim() || undefined,
        items: poItems.map((i) => ({
          productId: i.productId,
          variantId: i.variantId || undefined,
          qtyOrdered: i.qtyOrdered,
          unitCost: i.unitCost,
        })),
      };
      await createPO(payload).unwrap();
      setIsCreateOpen(false);
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, "Gagal membuat Purchase Order"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async () => {
    if (!receiveTarget) return;
    setModalError("");

    for (const item of receiveTarget.Items) {
      const row = receiveRows[item.poItemId];
      const label = item.variant
        ? `${item.product?.name} - ${item.variant.name}`
        : item.product?.name ?? "Item";
      if (!Number.isInteger(row.qty) || row.qty < 0 || row.qty > item.qtyOrdered) {
        return setModalError(`${label}: jumlah diterima harus antara 0 dan ${item.qtyOrdered}`);
      }
      if (row.qty < item.qtyOrdered && !row.note.trim()) {
        return setModalError(`${label}: isi alasan karena diterima kurang dari jumlah dipesan`);
      }
    }
    if (receiveTarget.Items.every((item) => receiveRows[item.poItemId].qty === 0)) {
      return setModalError("Tidak ada barang yang diterima");
    }
    if (!receiptImage) return setModalError("Foto bukti penerimaan wajib diunggah");

    setSubmitting(true);
    try {
      await receivePO({
        poId: receiveTarget.poId,
        receiptImage,
        deliveryNoteNumber: deliveryNoteNumber.trim() || undefined,
        receiveNotes: receiveNotes.trim() || undefined,
        receivedItems: receiveTarget.Items.map((item) => {
          const row = receiveRows[item.poItemId];
          return {
            poItemId: item.poItemId,
            qtyReceived: row.qty,
            receiveNote: row.note.trim() || undefined,
          };
        }),
      }).unwrap();
      setReceiveTarget(null);
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, "Gagal memvalidasi penerimaan"));
    } finally {
      setSubmitting(false);
    }
  };

  const modalBg = "fixed inset-0 z-50 flex items-center justify-center";
  const cardCss = `relative z-50 w-full max-w-lg rounded-2xl p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto ${
    isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"
  }`;
  const inputCss = `block w-full rounded-lg border-2 p-2 text-sm ${
    isDarkMode
      ? "border-gray-600 bg-gray-700 text-gray-100"
      : "border-gray-300 bg-white text-gray-900"
  }`;
  const labelCss = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";
  const btnSecondary = `px-4 py-2 rounded-lg text-sm ${
    isDarkMode
      ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
  }`;

  const errorBox = modalError && (
    <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
      {modalError}
    </div>
  );

  if (!canAccess) {
    return (
      <div className="py-16 text-center text-gray-400 dark:text-gray-500">
        <ShoppingCartIcon className="mx-auto mb-3 h-12 w-12 opacity-30" />
        <p>Anda tidak memiliki akses ke halaman Purchase Order.</p>
      </div>
    );
  }

  if (isLoading) return <div className="py-4 dark:text-gray-100">Loading...</div>;
  if (isError)
    return <div className="py-4 text-red-500">Gagal memuat data Purchase Order</div>;

  return (
    <div className="flex flex-col">
      <div className="mb-5 flex items-center justify-between">
        <Header name="Purchase Order Supplier" />
        {role === "super_admin" && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
          >
            <PlusCircleIcon className="h-4 w-4" /> Buat PO
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === s.value
                ? "bg-blue-500 text-white"
                : isDarkMode
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Daftar PO */}
      {orders && orders.length > 0 ? (
        orders.map((po) => (
          <POCard
            key={po.poId}
            po={po}
            role={role}
            isDarkMode={isDarkMode}
            onReceive={openReceive}
            onViewProof={(p) => setProofTarget(p.poId)}
          />
        ))
      ) : (
        <div className="py-16 text-center text-gray-400 dark:text-gray-500">
          <ShoppingCartIcon className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>Belum ada Purchase Order</p>
        </div>
      )}

      {/* ── MODAL LIHAT BUKTI ───────────────────────────────── */}
      {proofTarget && (
        <ProofModal poId={proofTarget} cardCss={cardCss} onClose={() => setProofTarget(null)} />
      )}

      {/* ── MODAL BUAT PO ───────────────────────────────────── */}
      {isCreateOpen && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsCreateOpen(false)} />
          <div className={cardCss}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Buat Purchase Order</h3>
              <button onClick={() => setIsCreateOpen(false)}>
                <XIcon className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {errorBox}

            {/* Bukti pembelian */}
            <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Bukti Pembelian
            </p>
            <label className={labelCss}>
              Nama Supplier<span className="ml-0.5 text-red-500">*</span>
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="contoh: CV Sumber Wangi"
              className={`${inputCss} mb-3`}
            />

            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCss}>
                  No. Nota / Invoice<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="contoh: INV-0012"
                  className={inputCss}
                />
              </div>
              <div>
                <label className={labelCss}>
                  No. Resi / Pengiriman<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="contoh: JNE123456789"
                  className={inputCss}
                />
              </div>
              <div>
                <label className={labelCss}>
                  Tanggal Nota<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  max={todayISO()}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className={inputCss}
                />
              </div>
              <div>
                <label className={labelCss}>
                  Total di Nota<span className="ml-0.5 text-red-500">*</span>
                </label>
                <PriceInput value={invoiceTotal} onChange={setInvoiceTotal} className={inputCss} />
              </div>
            </div>

            <ProofImageInput
              label="Foto Nota"
              required
              value={invoiceImage}
              onChange={setInvoiceImage}
              onError={setModalError}
              isDarkMode={isDarkMode}
              hint="Pastikan nomor nota dan total terbaca jelas."
            />

            <label className={labelCss}>Catatan (opsional)</label>
            <textarea
              value={poNotes}
              onChange={(e) => setPoNotes(e.target.value)}
              placeholder="Catatan tambahan untuk PO ini..."
              rows={2}
              className={`${inputCss} mb-4 resize-none`}
            />

            {/* Item */}
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Item Dibeli</p>
              <button onClick={addItem} className="text-xs text-blue-500 hover:underline">
                + Tambah Item
              </button>
            </div>

            <div className="mb-4 space-y-3">
              {poItems.map((item, i) => {
                const selectedProduct = products?.find((p) => p.productId === item.productId);
                const variants = (selectedProduct?.Variants ?? []).filter((v) => v.isActive);
                const selectedVariant = variants.find((v) => v.variantId === item.variantId);

                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 ${
                      isDarkMode ? "border-gray-600 bg-gray-700/50" : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Item {i + 1}</span>
                      {poItems.length > 1 && (
                        <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Produk */}
                    <select
                      value={item.productId}
                      onChange={(e) => patchItem(i, { productId: e.target.value, variantId: "" })}
                      className={`${inputCss} mb-2`}
                    >
                      <option value="">-- Pilih Produk --</option>
                      {products?.map((p) => (
                        <option key={p.productId} value={p.productId}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    {/* Varian (wajib jika produk punya varian) */}
                    {variants.length > 0 && (
                      <select
                        value={item.variantId}
                        onChange={(e) => patchItem(i, { variantId: e.target.value })}
                        className={`${inputCss} mb-2`}
                      >
                        <option value="">-- Pilih Varian --</option>
                        {variants.map((v) => (
                          <option key={v.variantId} value={v.variantId}>
                            {v.name}
                            {showSize(v.value) ? ` (${v.value})` : ""} — Gudang: {v.stockGudang}
                          </option>
                        ))}
                      </select>
                    )}

                    {selectedVariant && (
                      <div className="mb-2 flex items-center gap-2">
                        <Thumb src={selectedVariant.imageUrl} alt={selectedVariant.name} />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Stok gudang saat ini:{" "}
                          <span className="font-semibold">{selectedVariant.stockGudang}</span>
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Jumlah Dibeli</label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={item.qtyOrdered}
                          onChange={(e) =>
                            patchItem(i, { qtyOrdered: Math.floor(Number(e.target.value)) })
                          }
                          className={inputCss}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Harga Beli Satuan</label>
                        <PriceInput
                          value={item.unitCost}
                          onChange={(n) => patchItem(i, { unitCost: n })}
                          className={inputCss}
                        />
                      </div>
                    </div>
                    {item.unitCost > 0 && item.qtyOrdered > 0 && (
                      <p className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
                        Subtotal: {formatRupiah(item.unitCost * item.qtyOrdered)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ringkasan total */}
            <div
              className={`mb-4 space-y-1 rounded-lg p-3 text-sm ${
                totalMismatch
                  ? "bg-red-50 dark:bg-red-900/30"
                  : isDarkMode
                    ? "bg-gray-700/50"
                    : "bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Total item</span>
                <span className="font-semibold">{formatRupiah(itemsTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Total di nota</span>
                <span className="font-semibold">{formatRupiah(invoiceTotal)}</span>
              </div>
              {totalMismatch && (
                <p className="pt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                  Selisih {formatRupiah(Math.abs(totalDiff))}. Total item harus sama dengan total di nota.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setIsCreateOpen(false)} className={btnSecondary}>
                Batal
              </button>
              <button
                onClick={handleCreatePO}
                disabled={submitting || totalMismatch}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-60"
              >
                {submitting ? "Menyimpan..." : "Buat PO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL VALIDASI PENERIMAAN ───────────────────────── */}
      {receiveTarget && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setReceiveTarget(null)} />
          <div className={cardCss}>
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2 dark:bg-green-900/40">
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Validasi Penerimaan</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {receiveTarget.poNumber} • {receiveTarget.supplier} • Resi {receiveTarget.trackingNumber}
                </p>
              </div>
            </div>

            {errorBox}

            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              Isi jumlah yang benar-benar diterima. Stok gudang bertambah sesuai jumlah diterima.
              Jika kurang dari jumlah dipesan, alasan wajib diisi.
            </p>

            <div className="mb-4 space-y-3">
              {receiveTarget.Items.map((item) => {
                const row = receiveRows[item.poItemId];
                const short = row.qty < item.qtyOrdered;
                return (
                  <div
                    key={item.poItemId}
                    className={`rounded-lg border p-3 text-sm ${
                      isDarkMode ? "border-gray-600 bg-gray-700/50" : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <ItemInfo item={item} />
                      <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                        Dipesan: <span className="font-semibold">{item.qtyOrdered}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="shrink-0 text-xs text-gray-500">Diterima</label>
                      <input
                        type="number"
                        min={0}
                        max={item.qtyOrdered}
                        step={1}
                        value={row.qty}
                        onChange={(e) =>
                          patchReceiveRow(item.poItemId, {
                            qty: Math.floor(Number(e.target.value)),
                          })
                        }
                        className={`${inputCss} w-24`}
                      />
                    </div>
                    {short && (
                      <input
                        type="text"
                        value={row.note}
                        onChange={(e) => patchReceiveRow(item.poItemId, { note: e.target.value })}
                        placeholder="Alasan kurang (wajib), mis. 2 botol pecah"
                        className={`${inputCss} mt-2`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <label className={labelCss}>No. Surat Jalan (opsional)</label>
            <input
              type="text"
              value={deliveryNoteNumber}
              onChange={(e) => setDeliveryNoteNumber(e.target.value)}
              placeholder="Nomor surat jalan dari supplier/kurir"
              className={`${inputCss} mb-3`}
            />

            <ProofImageInput
              label="Foto Bukti Penerimaan"
              required
              value={receiptImage}
              onChange={setReceiptImage}
              onError={setModalError}
              isDarkMode={isDarkMode}
              hint="Foto barang yang diterima beserta nota/surat jalan."
            />

            <label className={labelCss}>Catatan (opsional)</label>
            <textarea
              value={receiveNotes}
              onChange={(e) => setReceiveNotes(e.target.value)}
              placeholder="Catatan penerimaan..."
              rows={2}
              className={`${inputCss} mb-4 resize-none`}
            />

            <div className="flex justify-end gap-2">
              <button onClick={() => setReceiveTarget(null)} className={btnSecondary}>
                Batal
              </button>
              <button
                onClick={handleReceive}
                disabled={submitting}
                className="rounded-lg bg-green-500 px-4 py-2 text-sm text-white hover:bg-green-600 disabled:opacity-60"
              >
                {submitting ? "Memproses..." : "Konfirmasi Terima"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrdersPage;
