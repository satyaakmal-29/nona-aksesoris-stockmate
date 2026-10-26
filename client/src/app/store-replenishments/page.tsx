"use client";

import { useState } from "react";
import Image from "next/image";
import Header from "@/app/(components)/Header";
import ProofImageInput, { ProofImageView } from "@/app/(components)/ProofImageInput";
import { useAppSelector } from "@/app/redux";
import {
  useGetStoreReplenishmentsQuery,
  useGetStoreReplenishmentByIdQuery,
  useCreateStoreReplenishmentMutation,
  useApproveStoreReplenishmentMutation,
  useRejectStoreReplenishmentMutation,
  useShipStoreReplenishmentMutation,
  useReceiveStoreReplenishmentMutation,
  useGetProductsQuery,
  StoreReplenishment,
  StoreReplenishmentItem,
  NewStoreReplenishment,
} from "@/state/api";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  ImageIcon,
  PackageCheckIcon,
  PackageIcon,
  PlusCircleIcon,
  TruckIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";

// Store Replenishment = pengisian stok TOKO dari gudang.
// Super Admin membuat → Admin Gudang setujui/tolak → Admin Gudang validasi
// pengiriman (stok gudang berkurang) → Admin Toko konfirmasi penerimaan
// (stok toko bertambah).

// ── Helpers ───────────────────────────────────────────────────────
const formatRupiah = (n: number) =>
  "Rp " + Math.round(n).toLocaleString("id-ID");

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

const showSize = (v?: string) => !!v && v !== "-";

const hasValue = (n?: number | null): n is number => n !== null && n !== undefined;

const itemLabel = (item: StoreReplenishmentItem) =>
  item.variant
    ? `${item.product?.name ?? "Produk"} - ${item.variant.name}`
    : item.product?.name ?? "Produk";

const getErrorMessage = (err: unknown, fallback: string) => {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
};

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
    pending:   { label: "Menunggu",  color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300", icon: <ClockIcon className="h-3 w-3" /> },
    approved:  { label: "Disetujui", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",         icon: <CheckCircleIcon className="h-3 w-3" /> },
    rejected:  { label: "Ditolak",   color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",             icon: <XCircleIcon className="h-3 w-3" /> },
    shipped:   { label: "Dikirim",   color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", icon: <TruckIcon className="h-3 w-3" /> },
    completed: { label: "Selesai",   color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",     icon: <PackageCheckIcon className="h-3 w-3" /> },
  };
  const s = map[status] ?? { label: status, color: "bg-gray-100 text-gray-700", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.color}`}>
      {s.icon}
      {s.label}
    </span>
  );
};

const STATUS_FILTERS_ALL: Array<{ value: string; label: string }> = [
  { value: "",          label: "Semua" },
  { value: "pending",   label: "Menunggu" },
  { value: "approved",  label: "Disetujui" },
  { value: "shipped",   label: "Dikirim" },
  { value: "completed", label: "Selesai" },
  { value: "rejected",  label: "Ditolak" },
];

// Admin Toko hanya melihat yang sudah dikirim / selesai (dibatasi juga di server)
const STATUS_FILTERS_TOKO: Array<{ value: string; label: string }> = [
  { value: "",          label: "Semua" },
  { value: "shipped",   label: "Dikirim" },
  { value: "completed", label: "Selesai" },
];

// ── Info produk/varian pada item ──────────────────────────────────
const ItemInfo = ({ item, showStock }: { item: StoreReplenishmentItem; showStock?: boolean }) => {
  const v = item.variant;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Thumb src={v?.imageUrl ?? item.product?.imageUrl} alt={item.product?.name ?? "Produk"} />
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
        {showStock && v && (
          <p className="text-xs text-gray-400">
            Stok gudang: {v.stockGudang}
            {hasValue(v.stockToko) && ` • Stok toko: ${v.stockToko}`}
          </p>
        )}
      </div>
    </div>
  );
};

// ── Baris item pada kartu ─────────────────────────────────────────
const ItemRow = ({ item, showStock }: { item: StoreReplenishmentItem; showStock?: boolean }) => (
  <div className="text-sm">
    <div className="flex items-center gap-3">
      <ItemInfo item={item} showStock={showStock} />
      <div className="shrink-0 text-right text-xs text-gray-500 dark:text-gray-400">
        <p>
          {item.qtyRequested} unit × {formatRupiah(item.unitCost)}
        </p>
        <p className="font-semibold text-gray-700 dark:text-gray-200">
          {formatRupiah(item.subtotal)}
        </p>
        {hasValue(item.qtyApproved) && <p className="text-blue-500">Disetujui: {item.qtyApproved}</p>}
        {hasValue(item.qtyShipped) && <p className="text-purple-500">Dikirim: {item.qtyShipped}</p>}
        {hasValue(item.qtyReceived) && (
          <p
            className={
              hasValue(item.qtyShipped) && item.qtyReceived < item.qtyShipped
                ? "font-semibold text-red-500"
                : "text-green-600 dark:text-green-400"
            }
          >
            Diterima: {item.qtyReceived}
          </p>
        )}
      </div>
    </div>
    {item.shipNote && (
      <p className="ml-12 mt-1 text-xs text-orange-500">Alasan kirim kurang: {item.shipNote}</p>
    )}
    {item.receiveNote && (
      <p className="ml-12 mt-1 text-xs text-red-500">Alasan terima kurang: {item.receiveNote}</p>
    )}
  </div>
);

// ── Kartu Store Replenishment ─────────────────────────────────────
type CardActions = {
  onApprove:   (sr: StoreReplenishment) => void;
  onReject:    (sr: StoreReplenishment) => void;
  onShip:      (sr: StoreReplenishment) => void;
  onReceive:   (sr: StoreReplenishment) => void;
  onViewProof: (sr: StoreReplenishment) => void;
};

const SRCard = ({
  sr,
  role,
  isDarkMode,
  actions,
}: {
  sr: StoreReplenishment;
  role: string;
  isDarkMode: boolean;
  actions: CardActions;
}) => {
  const [expanded, setExpanded] = useState(false);
  const total = sr.Items.reduce((s, i) => s + i.subtotal, 0);
  const hasProof = sr.status === "shipped" || sr.status === "completed";

  const btn = "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold";

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
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{sr.srNumber}</p>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              Dibuat oleh {sr.createdBy?.name ?? "—"} • {formatDateTime(sr.createdAt)}
            </p>
          </div>
          <StatusBadge status={sr.status} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">{sr.Items.length} item</p>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              {formatRupiah(total)}
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
            {sr.Items.map((item) => (
              <ItemRow
                key={item.srItemId}
                item={item}
                showStock={role === "admin_gudang" && (sr.status === "pending" || sr.status === "approved")}
              />
            ))}
          </div>

          <div className="mb-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
            {sr.notes && <p>📝 {sr.notes}</p>}
            {sr.status === "rejected" && (
              <p className="text-red-500">
                ❌ Ditolak oleh {sr.approvedBy?.name ?? "—"} • {formatDateTime(sr.approvedAt)}
                {sr.rejectedReason && ` — ${sr.rejectedReason}`}
              </p>
            )}
            {sr.approvedAt && sr.status !== "rejected" && (
              <p className="text-blue-500">
                ✔ Disetujui oleh {sr.approvedBy?.name ?? "—"} • {formatDateTime(sr.approvedAt)}
              </p>
            )}
            {sr.shippedAt && (
              <>
                <p className="text-purple-500">
                  🚚 Dikirim oleh {sr.shippedBy?.name ?? "—"} • {formatDateTime(sr.shippedAt)}
                </p>
                <p>
                  Surat jalan {sr.deliveryNoteNumber ?? "—"} • Pengantar {sr.courierName ?? "—"}
                </p>
                {sr.shipNotes && <p>Catatan pengiriman: {sr.shipNotes}</p>}
              </>
            )}
            {sr.receivedAt && (
              <>
                <p className="text-green-600 dark:text-green-400">
                  ✅ Diterima toko oleh {sr.receivedBy?.name ?? "—"} • {formatDateTime(sr.receivedAt)}
                </p>
                {sr.receiveNotes && <p>Catatan penerimaan: {sr.receiveNotes}</p>}
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {hasProof && (
              <button
                onClick={() => actions.onViewProof(sr)}
                className={`${btn} ${
                  isDarkMode
                    ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" /> Lihat Bukti
              </button>
            )}
            {role === "admin_gudang" && sr.status === "pending" && (
              <>
                <button onClick={() => actions.onApprove(sr)} className={`${btn} bg-green-500 text-white hover:bg-green-600`}>
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Setujui
                </button>
                <button onClick={() => actions.onReject(sr)} className={`${btn} bg-red-500 text-white hover:bg-red-600`}>
                  <XCircleIcon className="h-3.5 w-3.5" /> Tolak
                </button>
              </>
            )}
            {role === "admin_gudang" && sr.status === "approved" && (
              <button onClick={() => actions.onShip(sr)} className={`${btn} bg-purple-500 text-white hover:bg-purple-600`}>
                <TruckIcon className="h-3.5 w-3.5" /> Validasi Pengiriman
              </button>
            )}
            {role === "admin_toko" && sr.status === "shipped" && (
              <button onClick={() => actions.onReceive(sr)} className={`${btn} bg-green-500 text-white hover:bg-green-600`}>
                <PackageCheckIcon className="h-3.5 w-3.5" /> Konfirmasi Penerimaan
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
  srId,
  cardCss,
  onClose,
}: {
  srId: string;
  cardCss: string;
  onClose: () => void;
}) => {
  const { data: detail, isLoading, isError } = useGetStoreReplenishmentByIdQuery(srId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cardCss}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Bukti {detail?.srNumber ?? "Store Replenishment"}</h3>
          <button onClick={onClose}>
            <XIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {isLoading && <p className="py-6 text-center text-sm text-gray-400">Memuat foto...</p>}
        {isError && <p className="py-6 text-center text-sm text-red-500">Gagal memuat bukti</p>}

        {detail && (
          <>
            <ProofImageView
              label={`Foto Surat Jalan${detail.deliveryNoteNumber ? ` (${detail.deliveryNoteNumber})` : ""}`}
              src={detail.deliveryNoteImage}
            />
            {detail.status === "completed" && (
              <ProofImageView label="Foto Bukti Penerimaan Toko" src={detail.receiveImage} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Daftar input jumlah per item (setujui / kirim / terima) ───────
type QtyRow = { qty: number; note: string };

const QtyRowsEditor = ({
  items,
  rows,
  onChange,
  maxOf,
  maxLabel,
  qtyLabel,
  notePlaceholder,
  showStock,
  requireNoteWhenShort,
  inputCss,
  isDarkMode,
}: {
  items: StoreReplenishmentItem[];
  rows: Record<string, QtyRow>;
  onChange: (id: string, patch: Partial<QtyRow>) => void;
  maxOf: (item: StoreReplenishmentItem) => number;
  maxLabel: string;
  qtyLabel: string;
  notePlaceholder?: string;
  showStock?: boolean;
  requireNoteWhenShort: boolean;
  inputCss: string;
  isDarkMode: boolean;
}) => (
  <div className="mb-4 space-y-3">
    {items.map((item) => {
      const row = rows[item.srItemId];
      const max = maxOf(item);
      const short = row.qty < max;
      const stock = item.variant?.stockGudang;
      const notEnough = showStock && stock !== undefined && row.qty > stock;

      return (
        <div
          key={item.srItemId}
          className={`rounded-lg border p-3 text-sm ${
            isDarkMode ? "border-gray-600 bg-gray-700/50" : "border-gray-200 bg-gray-50"
          }`}
        >
          <div className="mb-2 flex items-center gap-3">
            <ItemInfo item={item} showStock={showStock} />
            <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
              {maxLabel}: <span className="font-semibold">{max}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-xs text-gray-500">{qtyLabel}</label>
            <input
              type="number"
              min={0}
              max={max}
              step={1}
              value={row.qty}
              disabled={max === 0}
              onChange={(e) => onChange(item.srItemId, { qty: Math.floor(Number(e.target.value)) })}
              className={`${inputCss} w-24`}
            />
            {notEnough && (
              <span className="text-xs font-semibold text-red-500">Stok gudang tidak cukup</span>
            )}
          </div>
          {requireNoteWhenShort && short && (
            <input
              type="text"
              value={row.note}
              onChange={(e) => onChange(item.srItemId, { note: e.target.value })}
              placeholder={notePlaceholder ?? "Alasan (wajib)"}
              className={`${inputCss} mt-2`}
            />
          )}
        </div>
      );
    })}
  </div>
);

const initRows = (
  items: StoreReplenishmentItem[],
  qtyOf: (item: StoreReplenishmentItem) => number
): Record<string, QtyRow> =>
  Object.fromEntries(items.map((item) => [item.srItemId, { qty: qtyOf(item), note: "" }]));

// Validasi jumlah per item, mencerminkan aturan server. Mengembalikan pesan error atau "".
const validateRows = (
  items: StoreReplenishmentItem[],
  rows: Record<string, QtyRow>,
  maxOf: (item: StoreReplenishmentItem) => number,
  opts: { requireNote: boolean; shortWord: string; noteWord: string; allowAllZero: boolean; zeroMessage: string }
): string => {
  for (const item of items) {
    const row = rows[item.srItemId];
    const max = maxOf(item);
    if (!Number.isInteger(row.qty) || row.qty < 0 || row.qty > max) {
      return `${itemLabel(item)}: jumlah harus antara 0 dan ${max}`;
    }
    if (opts.requireNote && row.qty < max && !row.note.trim()) {
      return `${itemLabel(item)}: isi alasan karena ${opts.shortWord} kurang dari jumlah ${opts.noteWord}`;
    }
  }
  if (!opts.allowAllZero && items.every((item) => rows[item.srItemId].qty === 0)) {
    return opts.zeroMessage;
  }
  return "";
};

// ── Judul modal aksi ──────────────────────────────────────────────
const ModalHeader = ({
  icon,
  iconBg,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
}) => (
  <div className="mb-3 flex items-center gap-3">
    <div className={`rounded-full p-2 ${iconBg}`}>{icon}</div>
    <div>
      <h3 className="text-lg font-bold">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────
type DraftItem = {
  productId: string;
  variantId: string;
  qtyRequested: number;
  unitCost: number;
};

const emptyItem = (): DraftItem => ({
  productId: "",
  variantId: "",
  qtyRequested: 1,
  unitCost: 0,
});

const approvedQty = (item: StoreReplenishmentItem) => item.qtyApproved ?? 0;
const shippedQty = (item: StoreReplenishmentItem) => item.qtyShipped ?? 0;
const requestedQty = (item: StoreReplenishmentItem) => item.qtyRequested;

const StoreReplenishmentsPage = () => {
  const isDarkMode = useAppSelector((s) => s.global.isDarkMode);
  const currentUser = useAppSelector((s) => s.global.currentUser);
  const role = currentUser?.role ?? "";
  const canAccess = role === "super_admin" || role === "admin_gudang" || role === "admin_toko";
  const statusFilters = role === "admin_toko" ? STATUS_FILTERS_TOKO : STATUS_FILTERS_ALL;

  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: orders, isLoading, isError } = useGetStoreReplenishmentsQuery(
    statusFilter || undefined,
    { skip: !canAccess }
  );
  const { data: products } = useGetProductsQuery(undefined, {
    skip: role !== "super_admin",
  });

  const [createSR] = useCreateStoreReplenishmentMutation();
  const [approveSR] = useApproveStoreReplenishmentMutation();
  const [rejectSR] = useRejectStoreReplenishmentMutation();
  const [shipSR] = useShipStoreReplenishmentMutation();
  const [receiveSR] = useReceiveStoreReplenishmentMutation();

  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [proofTarget, setProofTarget] = useState<string | null>(null);

  // Buat
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [srNotes, setSrNotes] = useState("");
  const [srItems, setSrItems] = useState<DraftItem[]>([emptyItem()]);

  // Setujui / Tolak
  const [approveTarget, setApproveTarget] = useState<StoreReplenishment | null>(null);
  const [rejectTarget, setRejectTarget] = useState<StoreReplenishment | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Kirim
  const [shipTarget, setShipTarget] = useState<StoreReplenishment | null>(null);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [courierName, setCourierName] = useState("");
  const [deliveryNoteImage, setDeliveryNoteImage] = useState<string | null>(null);
  const [shipNotes, setShipNotes] = useState("");

  // Terima
  const [receiveTarget, setReceiveTarget] = useState<StoreReplenishment | null>(null);
  const [receiveImage, setReceiveImage] = useState<string | null>(null);
  const [receiveNotes, setReceiveNotes] = useState("");

  // Jumlah per item untuk modal setujui / kirim / terima
  const [qtyRows, setQtyRows] = useState<Record<string, QtyRow>>({});
  const patchQtyRow = (id: string, patch: Partial<QtyRow>) =>
    setQtyRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  const addItem = () => setSrItems((p) => [...p, emptyItem()]);
  const removeItem = (i: number) => setSrItems((p) => p.filter((_, idx) => idx !== i));
  const patchItem = (i: number, patch: Partial<DraftItem>) =>
    setSrItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  // ── Buka modal ──
  const openCreate = () => {
    setModalError("");
    setSrNotes("");
    setSrItems([emptyItem()]);
    setIsCreateOpen(true);
  };
  const openApprove = (sr: StoreReplenishment) => {
    setModalError("");
    setQtyRows(initRows(sr.Items, requestedQty));
    setApproveTarget(sr);
  };
  const openReject = (sr: StoreReplenishment) => {
    setModalError("");
    setRejectReason("");
    setRejectTarget(sr);
  };
  const openShip = (sr: StoreReplenishment) => {
    setModalError("");
    setDeliveryNoteNumber("");
    setCourierName("");
    setDeliveryNoteImage(null);
    setShipNotes("");
    setQtyRows(initRows(sr.Items, approvedQty));
    setShipTarget(sr);
  };
  const openReceive = (sr: StoreReplenishment) => {
    setModalError("");
    setReceiveImage(null);
    setReceiveNotes("");
    setQtyRows(initRows(sr.Items, shippedQty));
    setReceiveTarget(sr);
  };

  // ── Aksi ──
  const handleCreate = async () => {
    setModalError("");

    for (let i = 0; i < srItems.length; i++) {
      const it = srItems[i];
      const p = products?.find((pr) => pr.productId === it.productId);
      if (!p) return setModalError(`Item ${i + 1}: pilih produk`);
      const activeVariants = (p.Variants ?? []).filter((v) => v.isActive);
      if (activeVariants.length > 0 && !it.variantId) {
        return setModalError(`Item ${i + 1}: pilih varian untuk "${p.name}"`);
      }
      if (!Number.isInteger(it.qtyRequested) || it.qtyRequested < 1) {
        return setModalError(`Item ${i + 1}: jumlah minimal 1`);
      }
      if (!(it.unitCost > 0)) {
        return setModalError(`Item ${i + 1}: harga satuan harus lebih dari 0`);
      }
    }

    setSubmitting(true);
    try {
      const payload: NewStoreReplenishment = {
        notes: srNotes.trim() || undefined,
        items: srItems.map((i) => ({
          productId: i.productId,
          variantId: i.variantId || undefined,
          qtyRequested: i.qtyRequested,
          unitCost: i.unitCost,
        })),
      };
      await createSR(payload).unwrap();
      setIsCreateOpen(false);
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, "Gagal membuat Store Replenishment"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    setModalError("");
    const error = validateRows(approveTarget.Items, qtyRows, requestedQty, {
      requireNote: false,
      shortWord: "disetujui",
      noteWord: "diminta",
      allowAllZero: false,
      zeroMessage: "Minimal 1 item harus disetujui. Jika menolak semua, gunakan Tolak.",
    });
    if (error) return setModalError(error);

    setSubmitting(true);
    try {
      await approveSR({
        srId: approveTarget.srId,
        approvedItems: approveTarget.Items.map((item) => ({
          srItemId: item.srItemId,
          qtyApproved: qtyRows[item.srItemId].qty,
        })),
      }).unwrap();
      setApproveTarget(null);
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, "Gagal menyetujui permintaan"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setModalError("");
    if (!rejectReason.trim()) return setModalError("Alasan penolakan wajib diisi");

    setSubmitting(true);
    try {
      await rejectSR({ srId: rejectTarget.srId, reason: rejectReason.trim() }).unwrap();
      setRejectTarget(null);
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, "Gagal menolak permintaan"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleShip = async () => {
    if (!shipTarget) return;
    setModalError("");
    if (!deliveryNoteNumber.trim()) return setModalError("Nomor surat jalan wajib diisi");
    if (!courierName.trim()) return setModalError("Nama pengantar wajib diisi");
    const error = validateRows(shipTarget.Items, qtyRows, approvedQty, {
      requireNote: true,
      shortWord: "dikirim",
      noteWord: "disetujui",
      allowAllZero: false,
      zeroMessage: "Tidak ada item yang dikirim",
    });
    if (error) return setModalError(error);
    if (!deliveryNoteImage) return setModalError("Foto surat jalan wajib diunggah");

    setSubmitting(true);
    try {
      await shipSR({
        srId: shipTarget.srId,
        deliveryNoteNumber: deliveryNoteNumber.trim(),
        courierName: courierName.trim(),
        deliveryNoteImage,
        shipNotes: shipNotes.trim() || undefined,
        shippedItems: shipTarget.Items.map((item) => ({
          srItemId: item.srItemId,
          qtyShipped: qtyRows[item.srItemId].qty,
          shipNote: qtyRows[item.srItemId].note.trim() || undefined,
        })),
      }).unwrap();
      setShipTarget(null);
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, "Gagal memvalidasi pengiriman"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async () => {
    if (!receiveTarget) return;
    setModalError("");
    const error = validateRows(receiveTarget.Items, qtyRows, shippedQty, {
      requireNote: true,
      shortWord: "diterima",
      noteWord: "dikirim",
      allowAllZero: true,
      zeroMessage: "",
    });
    if (error) return setModalError(error);
    if (!receiveImage) return setModalError("Foto bukti penerimaan wajib diunggah");

    setSubmitting(true);
    try {
      await receiveSR({
        srId: receiveTarget.srId,
        receiveImage,
        receiveNotes: receiveNotes.trim() || undefined,
        receivedItems: receiveTarget.Items.map((item) => ({
          srItemId: item.srItemId,
          qtyReceived: qtyRows[item.srItemId].qty,
          receiveNote: qtyRows[item.srItemId].note.trim() || undefined,
        })),
      }).unwrap();
      setReceiveTarget(null);
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, "Gagal mengonfirmasi penerimaan"));
    } finally {
      setSubmitting(false);
    }
  };

  const modalBg = "fixed inset-0 z-50 flex items-center justify-center";
  const cardCss = `relative z-50 w-full max-w-lg rounded-2xl p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto ${
    isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"
  }`;
  const smallCardCss = `relative z-50 w-full max-w-md rounded-2xl p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto ${
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
        <TruckIcon className="mx-auto mb-3 h-12 w-12 opacity-30" />
        <p>Anda tidak memiliki akses ke halaman Store Replenishment.</p>
      </div>
    );
  }

  if (isLoading) return <div className="py-4 dark:text-gray-100">Loading...</div>;
  if (isError)
    return <div className="py-4 text-red-500">Gagal memuat data Store Replenishment</div>;

  const createTotal = srItems.reduce((s, i) => s + i.qtyRequested * i.unitCost, 0);

  return (
    <div className="flex flex-col">
      <div className="mb-5 flex items-center justify-between">
        <Header name="Store Replenishment" />
        {role === "super_admin" && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
          >
            <PlusCircleIcon className="h-4 w-4" /> Buat Permintaan
          </button>
        )}
      </div>

      {role === "admin_toko" && (
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Daftar barang yang dikirim gudang ke toko. Konfirmasi penerimaan saat barang tiba.
        </p>
      )}

      {/* Filter */}
      <div className="mb-5 flex flex-wrap gap-2">
        {statusFilters.map((s) => (
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

      {/* Daftar */}
      {orders && orders.length > 0 ? (
        orders.map((sr) => (
          <SRCard
            key={sr.srId}
            sr={sr}
            role={role}
            isDarkMode={isDarkMode}
            actions={{
              onApprove: openApprove,
              onReject: openReject,
              onShip: openShip,
              onReceive: openReceive,
              onViewProof: (s) => setProofTarget(s.srId),
            }}
          />
        ))
      ) : (
        <div className="py-16 text-center text-gray-400 dark:text-gray-500">
          <TruckIcon className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>Belum ada Store Replenishment</p>
        </div>
      )}

      {/* ── MODAL LIHAT BUKTI ───────────────────────────────── */}
      {proofTarget && (
        <ProofModal srId={proofTarget} cardCss={cardCss} onClose={() => setProofTarget(null)} />
      )}

      {/* ── MODAL BUAT ──────────────────────────────────────── */}
      {isCreateOpen && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsCreateOpen(false)} />
          <div className={cardCss}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Buat Store Replenishment</h3>
              <button onClick={() => setIsCreateOpen(false)}>
                <XIcon className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {errorBox}

            <label className={labelCss}>Catatan (opsional)</label>
            <textarea
              value={srNotes}
              onChange={(e) => setSrNotes(e.target.value)}
              placeholder="Catatan untuk gudang..."
              rows={2}
              className={`${inputCss} mb-4 resize-none`}
            />

            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Item Diminta</p>
              <button onClick={addItem} className="text-xs text-blue-500 hover:underline">
                + Tambah Item
              </button>
            </div>

            <div className="mb-4 space-y-3">
              {srItems.map((item, i) => {
                const selectedProduct = products?.find((p) => p.productId === item.productId);
                const variants = (selectedProduct?.Variants ?? []).filter((v) => v.isActive);
                const selectedVariant = variants.find((v) => v.variantId === item.variantId);
                const overStock = selectedVariant && item.qtyRequested > selectedVariant.stockGudang;

                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 ${
                      isDarkMode ? "border-gray-600 bg-gray-700/50" : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Item {i + 1}</span>
                      {srItems.length > 1 && (
                        <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Produk */}
                    <select
                      value={item.productId}
                      onChange={(e) => {
                        const p = products?.find((pr) => pr.productId === e.target.value);
                        const vs = (p?.Variants ?? []).filter((v) => v.isActive);
                        patchItem(i, {
                          productId: e.target.value,
                          variantId: "",
                          // Produk tanpa varian: pakai harga produk. Produk bervarian: harga menunggu pilihan varian.
                          unitCost: p && vs.length === 0 ? p.price : 0,
                        });
                      }}
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
                        onChange={(e) => {
                          const v = variants.find((x) => x.variantId === e.target.value);
                          patchItem(i, {
                            variantId: e.target.value,
                            unitCost: v ? (v.price ?? selectedProduct?.price ?? 0) : 0,
                          });
                        }}
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
                          Stok gudang: <span className="font-semibold">{selectedVariant.stockGudang}</span>
                          {" • "}Stok toko: <span className="font-semibold">{selectedVariant.stockToko}</span>
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Jumlah Diminta</label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={item.qtyRequested}
                          onChange={(e) =>
                            patchItem(i, { qtyRequested: Math.floor(Number(e.target.value)) })
                          }
                          className={inputCss}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Harga Satuan</label>
                        <PriceInput
                          value={item.unitCost}
                          onChange={(n) => patchItem(i, { unitCost: n })}
                          className={inputCss}
                        />
                      </div>
                    </div>
                    {overStock && (
                      <p className="mt-1 text-xs text-orange-500">
                        Melebihi stok gudang saat ini; gudang dapat menyetujui sebagian.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Total</span>
              <span className="font-bold">{formatRupiah(createTotal)}</span>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setIsCreateOpen(false)} className={btnSecondary}>
                Batal
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-60"
              >
                {submitting ? "Menyimpan..." : "Buat Permintaan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SETUJUI ───────────────────────────────────── */}
      {approveTarget && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setApproveTarget(null)} />
          <div className={cardCss}>
            <ModalHeader
              icon={<CheckCircleIcon className="h-5 w-5 text-green-500" />}
              iconBg="bg-green-100 dark:bg-green-900/40"
              title="Setujui Permintaan"
              subtitle={approveTarget.srNumber}
            />
            {errorBox}
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              Atur jumlah yang disetujui per item (boleh sebagian atau 0). Stok gudang dicek
              saat disetujui, tetapi baru berkurang saat pengiriman divalidasi.
            </p>
            <QtyRowsEditor
              items={approveTarget.Items}
              rows={qtyRows}
              onChange={patchQtyRow}
              maxOf={requestedQty}
              maxLabel="Diminta"
              qtyLabel="Disetujui"
              showStock
              requireNoteWhenShort={false}
              inputCss={inputCss}
              isDarkMode={isDarkMode}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setApproveTarget(null)} className={btnSecondary}>
                Batal
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="rounded-lg bg-green-500 px-4 py-2 text-sm text-white hover:bg-green-600 disabled:opacity-60"
              >
                {submitting ? "Memproses..." : "Setujui"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL TOLAK ─────────────────────────────────────── */}
      {rejectTarget && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setRejectTarget(null)} />
          <div className={smallCardCss}>
            <ModalHeader
              icon={<XCircleIcon className="h-5 w-5 text-red-500" />}
              iconBg="bg-red-100 dark:bg-red-900/40"
              title="Tolak Permintaan"
              subtitle={rejectTarget.srNumber}
            />
            {errorBox}
            <label className={labelCss}>
              Alasan penolakan<span className="ml-0.5 text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Tuliskan alasan penolakan..."
              rows={3}
              className={`${inputCss} mb-4 resize-none`}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectTarget(null)} className={btnSecondary}>
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={submitting}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-60"
              >
                {submitting ? "Memproses..." : "Tolak"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL VALIDASI PENGIRIMAN ───────────────────────── */}
      {shipTarget && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setShipTarget(null)} />
          <div className={cardCss}>
            <ModalHeader
              icon={<TruckIcon className="h-5 w-5 text-purple-500" />}
              iconBg="bg-purple-100 dark:bg-purple-900/40"
              title="Validasi Pengiriman"
              subtitle={shipTarget.srNumber}
            />
            {errorBox}
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              Stok gudang berkurang sesuai jumlah dikirim. Stok toko baru bertambah setelah
              Admin Toko mengonfirmasi penerimaan.
            </p>

            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCss}>
                  No. Surat Jalan<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={deliveryNoteNumber}
                  onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                  placeholder="contoh: SJ-0012"
                  className={inputCss}
                />
              </div>
              <div>
                <label className={labelCss}>
                  Nama Pengantar<span className="ml-0.5 text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  placeholder="Nama kurir / pengantar"
                  className={inputCss}
                />
              </div>
            </div>

            <QtyRowsEditor
              items={shipTarget.Items}
              rows={qtyRows}
              onChange={patchQtyRow}
              maxOf={approvedQty}
              maxLabel="Disetujui"
              qtyLabel="Dikirim"
              notePlaceholder="Alasan kirim kurang (wajib)"
              showStock
              requireNoteWhenShort
              inputCss={inputCss}
              isDarkMode={isDarkMode}
            />

            <ProofImageInput
              label="Foto Surat Jalan"
              required
              value={deliveryNoteImage}
              onChange={setDeliveryNoteImage}
              onError={setModalError}
              isDarkMode={isDarkMode}
              hint="Pastikan nomor surat jalan terbaca jelas."
            />

            <label className={labelCss}>Catatan (opsional)</label>
            <textarea
              value={shipNotes}
              onChange={(e) => setShipNotes(e.target.value)}
              placeholder="Catatan pengiriman..."
              rows={2}
              className={`${inputCss} mb-4 resize-none`}
            />

            <div className="flex justify-end gap-2">
              <button onClick={() => setShipTarget(null)} className={btnSecondary}>
                Batal
              </button>
              <button
                onClick={handleShip}
                disabled={submitting}
                className="rounded-lg bg-purple-500 px-4 py-2 text-sm text-white hover:bg-purple-600 disabled:opacity-60"
              >
                {submitting ? "Memproses..." : "Konfirmasi Kirim"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL KONFIRMASI PENERIMAAN (Admin Toko) ────────── */}
      {receiveTarget && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setReceiveTarget(null)} />
          <div className={cardCss}>
            <ModalHeader
              icon={<PackageCheckIcon className="h-5 w-5 text-green-500" />}
              iconBg="bg-green-100 dark:bg-green-900/40"
              title="Konfirmasi Penerimaan"
              subtitle={`${receiveTarget.srNumber} • Surat jalan ${receiveTarget.deliveryNoteNumber ?? "—"} • ${receiveTarget.courierName ?? "—"}`}
            />
            {errorBox}
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              Isi jumlah yang benar-benar diterima toko. Stok toko bertambah sesuai jumlah
              diterima. Jika kurang, alasan wajib diisi dan Super Admin akan diberi tahu.
            </p>

            <QtyRowsEditor
              items={receiveTarget.Items}
              rows={qtyRows}
              onChange={patchQtyRow}
              maxOf={shippedQty}
              maxLabel="Dikirim"
              qtyLabel="Diterima"
              notePlaceholder="Alasan terima kurang (wajib), mis. 1 dus rusak"
              requireNoteWhenShort
              inputCss={inputCss}
              isDarkMode={isDarkMode}
            />

            <ProofImageInput
              label="Foto Bukti Penerimaan"
              required
              value={receiveImage}
              onChange={setReceiveImage}
              onError={setModalError}
              isDarkMode={isDarkMode}
              hint="Foto barang yang diterima di toko."
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

export default StoreReplenishmentsPage;
