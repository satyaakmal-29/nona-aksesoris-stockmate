"use client";

import { useState } from "react";
import Header from "@/app/(components)/Header";
import ExportMenu from "@/app/(components)/ExportMenu";
import ProofImageInput, { ProofImageView } from "@/app/(components)/ProofImageInput";
import { useAppSelector } from "@/app/redux";
import {
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  ExpenseFilter,
  ExpenseInput,
  ExpensesResponse,
  OperationalExpense,
  useCreateExpenseMutation,
  useDeleteExpenseMutation,
  useGetExpenseByIdQuery,
  useGetExpensesQuery,
  useUpdateExpenseMutation,
} from "@/state/api";
import {
  ExportFormat,
  ReportDocument,
  exportReport,
  formatLongDate,
  formatRupiah,
  toLocalISODate,
} from "@/lib/reportExport";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  ImageIcon,
  PencilIcon,
  PlusCircleIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  Trash2Icon,
  WalletIcon,
  XIcon,
} from "lucide-react";

// Pengeluaran = operasional (input manual) + pembelian stok (otomatis dari PO
// supplier, berdasarkan tanggal nota). Hanya Super Admin.

const PURCHASE_CATEGORY = "Pembelian Stok";

const CATEGORY_COLORS: Record<string, string> = {
  "Gaji":               "#c93e7b",
  "Sewa":               "#8b5cf6",
  "Listrik & Air":      "#06b6d4",
  "Internet & Telepon": "#14b8a6",
  "Transportasi":       "#f97316",
  "Perlengkapan":       "#84cc16",
  "Perawatan":          "#0ea5e9",
  "Lainnya":            "#6b7280",
  [PURCHASE_CATEGORY]:  "#f59e0b",
};

const PAYMENT_LABELS: Record<string, string> = { cash: "Tunai", transfer: "Transfer", qris: "QRIS" };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

const getErrorMessage = (err: unknown, fallback: string) => {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
};

// ── Input Rupiah (hanya angka, titik ribuan otomatis) ─────────────
const PriceInput = ({ value, onChange, className }: { value: number; onChange: (n: number) => void; className: string }) => (
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

// ── Susun laporan untuk export ────────────────────────────────────
const buildExpenseReport = (data: ExpensesResponse, filter: ExpenseFilter): ReportDocument => {
  const period = `${filter.startDate ? formatLongDate(filter.startDate) : "Awal"} - ${filter.endDate ? formatLongDate(filter.endDate) : "Sekarang"}`;
  return {
    title: "Laporan Pengeluaran",
    filename: `laporan-pengeluaran-${filter.startDate ?? "awal"}_sd_${filter.endDate ?? "sekarang"}`,
    meta: [
      ["Periode", period],
      ["Kategori", filter.category || "Semua"],
      ["Total Operasional", formatRupiah(data.summary.totalOperational)],
      ["Total Pembelian Stok", formatRupiah(data.summary.totalPurchases)],
      ["Total Pengeluaran", formatRupiah(data.summary.total)],
      ...Object.entries(data.summary.byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amount]): [string, string] => [`  ${cat}`, formatRupiah(amount)]),
    ],
    tables: [
      {
        title: "Pengeluaran Operasional",
        sheetName: "Operasional",
        columns: [
          { header: "No. Pengeluaran", width: 20 },
          { header: "Tanggal", width: 14 },
          { header: "Kategori", width: 18 },
          { header: "Keterangan", width: 34 },
          { header: "Metode", width: 10 },
          { header: "Jumlah", type: "currency", width: 16 },
          { header: "Dicatat oleh", width: 18 },
        ],
        rows: data.expenses.map((e) => [
          e.expenseNumber, formatDate(e.expenseDate), e.category, e.description,
          PAYMENT_LABELS[e.paymentMethod] ?? e.paymentMethod, e.amount, e.createdBy?.name ?? "-",
        ]),
        totalRow: ["TOTAL", "", "", "", "", data.summary.totalOperational, ""],
      },
      {
        title: "Pembelian Stok (Purchase Order Supplier)",
        sheetName: "Pembelian Stok",
        columns: [
          { header: "No. PO", width: 20 },
          { header: "Tanggal Nota", width: 14 },
          { header: "Supplier", width: 24 },
          { header: "No. Nota", width: 18 },
          { header: "Status", width: 14 },
          { header: "Total Nota", type: "currency", width: 16 },
        ],
        rows: data.purchases.map((p) => [
          p.poNumber, formatDate(p.invoiceDate), p.supplier, p.invoiceNumber,
          p.status === "received" ? "Diterima" : "Menunggu", p.invoiceTotal,
        ]),
        totalRow: ["TOTAL", "", "", "", "", data.summary.totalPurchases],
      },
    ],
  };
};

// ── Modal lihat bukti (foto diambil dari endpoint detail) ─────────
const ProofModal = ({ expenseId, cardCss, onClose }: { expenseId: string; cardCss: string; onClose: () => void }) => {
  const { data, isLoading, isError } = useGetExpenseByIdQuery(expenseId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cardCss}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Bukti {data?.expenseNumber ?? "Pengeluaran"}</h3>
          <button onClick={onClose}><XIcon className="h-5 w-5 text-gray-400" /></button>
        </div>
        {isLoading && <p className="py-6 text-center text-sm text-gray-400">Memuat foto...</p>}
        {isError && <p className="py-6 text-center text-sm text-red-500">Gagal memuat bukti</p>}
        {data && <ProofImageView label={`${data.category} — ${data.description}`} src={data.receiptImage} />}
      </div>
    </div>
  );
};

// ── Halaman ───────────────────────────────────────────────────────
type FormState = {
  category:      ExpenseCategory;
  description:   string;
  amount:        number;
  expenseDate:   string;
  paymentMethod: "cash" | "transfer" | "qris";
  notes:         string;
};

const ExpensesPage = () => {
  const isDarkMode  = useAppSelector((s) => s.global.isDarkMode);
  const currentUser = useAppSelector((s) => s.global.currentUser);
  const isSuper     = currentUser?.role === "super_admin";

  const today    = toLocalISODate(new Date());
  const firstDay = toLocalISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate]     = useState(today);
  const [category, setCategory]   = useState("");
  const [filterError, setFilterError] = useState("");
  const [applied, setApplied] = useState<ExpenseFilter>({ startDate: firstDay, endDate: today });

  const { data, isLoading, isError, isFetching } = useGetExpensesQuery(applied, { skip: !isSuper });
  const [createExpense, { isLoading: creating }] = useCreateExpenseMutation();
  const [updateExpense, { isLoading: updating }] = useUpdateExpenseMutation();
  const [deleteExpense, { isLoading: deleting }] = useDeleteExpenseMutation();

  const emptyForm = (): FormState => ({
    category: "Lainnya", description: "", amount: 0, expenseDate: today, paymentMethod: "cash", notes: "",
  });

  const [formOpen, setFormOpen]       = useState(false);
  const [editTarget, setEditTarget]   = useState<OperationalExpense | null>(null);
  const [form, setForm]               = useState<FormState>(emptyForm());
  const [newReceipt, setNewReceipt]   = useState<string | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [formError, setFormError]     = useState("");
  const [deleteTarget, setDeleteTarget] = useState<OperationalExpense | null>(null);
  const [proofTarget, setProofTarget] = useState<string | null>(null);
  const [notice, setNotice]           = useState("");

  const applyFilter = () => {
    if (startDate && endDate && startDate > endDate) {
      setFilterError("Tanggal awal tidak boleh setelah tanggal akhir");
      return;
    }
    setFilterError("");
    setApplied({ startDate: startDate || undefined, endDate: endDate || undefined, category: category || undefined });
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setNewReceipt(null);
    setRemoveReceipt(false);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (e: OperationalExpense) => {
    setEditTarget(e);
    setForm({
      category:      e.category,
      description:   e.description,
      amount:        e.amount,
      expenseDate:   toLocalISODate(new Date(e.expenseDate)),
      paymentMethod: e.paymentMethod,
      notes:         e.notes ?? "",
    });
    setNewReceipt(null);
    setRemoveReceipt(false);
    setFormError("");
    setFormOpen(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.description.trim()) return setFormError("Keterangan wajib diisi");
    if (!(form.amount > 0)) return setFormError("Jumlah pengeluaran harus lebih dari 0");
    if (!form.expenseDate) return setFormError("Tanggal wajib diisi");
    if (form.expenseDate > today) return setFormError("Tanggal tidak boleh di masa depan");

    const payload: ExpenseInput = {
      category:      form.category,
      description:   form.description.trim(),
      amount:        form.amount,
      expenseDate:   form.expenseDate,
      paymentMethod: form.paymentMethod,
      notes:         form.notes.trim() || undefined,
    };

    try {
      if (editTarget) {
        // Foto: kirim baru / null (hapus) / tidak dikirim (tetap)
        if (newReceipt) payload.receiptImage = newReceipt;
        else if (removeReceipt) payload.receiptImage = null;
        await updateExpense({ expenseId: editTarget.expenseId, ...payload }).unwrap();
        setNotice(`Pengeluaran ${editTarget.expenseNumber} diperbarui`);
      } else {
        payload.receiptImage = newReceipt;
        const created = await createExpense(payload).unwrap();
        setNotice(`Pengeluaran ${created.expenseNumber} dicatat`);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(getErrorMessage(err, "Gagal menyimpan pengeluaran"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await deleteExpense(deleteTarget.expenseId).unwrap();
      setNotice(res.message);
      setDeleteTarget(null);
    } catch (err) {
      setNotice(getErrorMessage(err, "Gagal menghapus pengeluaran"));
      setDeleteTarget(null);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!data) return;
    await exportReport(buildExpenseReport(data, applied), format);
  };

  const modalBg = "fixed inset-0 z-50 flex items-center justify-center";
  const cardCss = `relative z-50 w-full max-w-lg rounded-2xl p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"}`;
  const inputCss = `block w-full rounded-lg border-2 p-2 text-sm ${isDarkMode ? "border-gray-600 bg-gray-700 text-gray-100" : "border-gray-300 bg-white text-gray-900"}`;
  const labelCss = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";
  const panelCss = `rounded-xl border p-4 shadow-sm ${isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`;
  const btnSecondary = `px-4 py-2 rounded-lg text-sm ${isDarkMode ? "bg-gray-700 text-gray-200 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`;
  const thCss = "px-3 py-2 text-left text-xs font-semibold text-gray-500";

  if (!isSuper) {
    return (
      <div className="py-16 text-center text-gray-400 dark:text-gray-500">
        <WalletIcon className="mx-auto mb-3 h-12 w-12 opacity-30" />
        <p>Halaman Pengeluaran hanya untuk Super Admin.</p>
      </div>
    );
  }

  const chartData = data
    ? [
        ...Object.entries(data.summary.byCategory).map(([name, amount]) => ({ name, amount })),
        ...(data.summary.totalPurchases > 0 ? [{ name: PURCHASE_CATEGORY, amount: data.summary.totalPurchases }] : []),
      ].sort((a, b) => b.amount - a.amount)
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Header name="Pengeluaran" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Biaya operasional toko dan pembelian stok dari supplier.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu onExport={handleExport} disabled={!data} isDarkMode={isDarkMode} />
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">
            <PlusCircleIcon className="h-4 w-4" /> Catat Pengeluaran
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
          <span>{notice}</span>
          <button onClick={() => setNotice("")}><XIcon className="h-4 w-4" /></button>
        </div>
      )}

      {/* Filter */}
      <div className={panelCss}>
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
            <label className="mb-1 block text-xs text-gray-400">Kategori</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCss}>
              <option value="">Semua</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value={PURCHASE_CATEGORY}>{PURCHASE_CATEGORY}</option>
            </select>
          </div>
          <button onClick={applyFilter} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">Tampilkan</button>
        </div>
        {filterError && <p className="mt-2 text-xs text-red-500">{filterError}</p>}
        <p className="mt-2 text-xs text-gray-400">
          {applied.startDate ? formatLongDate(applied.startDate) : "Awal"} — {applied.endDate ? formatLongDate(applied.endDate) : "Sekarang"}
          {isFetching && " • memuat..."}
        </p>
      </div>

      {isLoading && <div className="py-4 dark:text-gray-100">Memuat pengeluaran...</div>}
      {isError && <div className="py-4 text-red-500">Gagal memuat data pengeluaran</div>}

      {data && (
        <>
          {/* Ringkasan */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={panelCss}>
              <div className="mb-1 flex items-center gap-2 text-xs text-gray-400"><ReceiptIcon className="h-4 w-4 text-blue-500" /> Operasional ({data.summary.countOperational})</div>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatRupiah(data.summary.totalOperational)}</p>
            </div>
            <div className={panelCss}>
              <div className="mb-1 flex items-center gap-2 text-xs text-gray-400"><ShoppingCartIcon className="h-4 w-4 text-amber-500" /> Pembelian Stok ({data.summary.countPurchases} PO)</div>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatRupiah(data.summary.totalPurchases)}</p>
            </div>
            <div className={panelCss}>
              <div className="mb-1 flex items-center gap-2 text-xs text-gray-400"><WalletIcon className="h-4 w-4 text-red-500" /> Total Pengeluaran</div>
              <p className="text-xl font-bold text-red-600">{formatRupiah(data.summary.total)}</p>
            </div>
          </div>

          {/* Grafik per kategori */}
          {chartData.length > 0 && (
            <div className={`${panelCss} grid grid-cols-1 gap-4 md:grid-cols-2`}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="amount" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                      {chartData.map((d) => <Cell key={d.name} fill={CATEGORY_COLORS[d.name] ?? "#9ca3af"} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: unknown) => [formatRupiah(Number(v)), "Jumlah"]}
                      contentStyle={{ backgroundColor: isDarkMode ? "#1f2937" : "#fff", borderColor: isDarkMode ? "#374151" : "#e5e7eb", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 self-center">
                {chartData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[d.name] ?? "#9ca3af" }} />
                      {d.name}
                    </span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {formatRupiah(d.amount)}
                      <span className="ml-1 text-xs text-gray-400">({((d.amount / data.summary.total) * 100).toFixed(1)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabel operasional */}
          {applied.category !== PURCHASE_CATEGORY && (
            <div className={panelCss}>
              <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Pengeluaran Operasional</h3>
              {data.expenses.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">Belum ada pengeluaran operasional pada filter ini.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className={isDarkMode ? "border-b border-gray-700" : "border-b border-gray-200"}>
                        <th className={thCss}>Tanggal</th>
                        <th className={thCss}>Kategori</th>
                        <th className={thCss}>Keterangan</th>
                        <th className={thCss}>Metode</th>
                        <th className={`${thCss} text-right`}>Jumlah</th>
                        <th className={`${thCss} text-right`}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expenses.map((e) => (
                        <tr key={e.expenseId} className={`border-b ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
                          <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                            {formatDate(e.expenseDate)}
                            <div className="font-mono text-[10px] text-gray-400">{e.expenseNumber}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[e.category] ?? "#9ca3af" }} />
                              {e.category}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                            {e.description}
                            {e.notes && <div className="text-xs text-gray-400">{e.notes}</div>}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">{PAYMENT_LABELS[e.paymentMethod] ?? e.paymentMethod}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800 dark:text-gray-100">{formatRupiah(e.amount)}</td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-1">
                              {e.hasReceipt && (
                                <button onClick={() => setProofTarget(e.expenseId)} title="Lihat bukti" className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                                  <ImageIcon className="h-4 w-4" />
                                </button>
                              )}
                              <button onClick={() => openEdit(e)} title="Ubah" className="rounded p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button onClick={() => setDeleteTarget(e)} title="Hapus" className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30">
                                <Trash2Icon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-blue-600">{formatRupiah(data.summary.totalOperational)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tabel pembelian stok */}
          {(!applied.category || applied.category === PURCHASE_CATEGORY) && (
            <div className={panelCss}>
              <h3 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Pembelian Stok (Purchase Order Supplier)</h3>
              <p className="mb-3 text-xs text-gray-400">Otomatis dari Purchase Order, berdasarkan tanggal nota. Ubah datanya melalui halaman Purchase Order.</p>
              {data.purchases.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">Tidak ada pembelian stok pada periode ini.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className={isDarkMode ? "border-b border-gray-700" : "border-b border-gray-200"}>
                        <th className={thCss}>Tanggal Nota</th>
                        <th className={thCss}>No. PO</th>
                        <th className={thCss}>Supplier</th>
                        <th className={thCss}>No. Nota</th>
                        <th className={thCss}>Status</th>
                        <th className={`${thCss} text-right`}>Total Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.purchases.map((p) => (
                        <tr key={p.poId} className={`border-b ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
                          <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{formatDate(p.invoiceDate)}</td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{p.poNumber}</td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{p.supplier}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{p.invoiceNumber}</td>
                          <td className="px-3 py-2 text-xs">
                            <span className={p.status === "received" ? "text-green-600" : "text-yellow-600"}>
                              {p.status === "received" ? "Diterima" : "Menunggu"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800 dark:text-gray-100">{formatRupiah(p.invoiceTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-amber-600">{formatRupiah(data.summary.totalPurchases)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── MODAL TAMBAH / UBAH ─────────────────────────────── */}
      {formOpen && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setFormOpen(false)} />
          <div className={cardCss}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editTarget ? `Ubah ${editTarget.expenseNumber}` : "Catat Pengeluaran"}</h3>
              <button onClick={() => setFormOpen(false)}><XIcon className="h-5 w-5 text-gray-400" /></button>
            </div>

            {formError && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{formError}</div>}

            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCss}>Tanggal<span className="ml-0.5 text-red-500">*</span></label>
                <input type="date" value={form.expenseDate} max={today} onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))} className={inputCss} />
              </div>
              <div>
                <label className={labelCss}>Kategori<span className="ml-0.5 text-red-500">*</span></label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))} className={inputCss}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <label className={labelCss}>Keterangan<span className="ml-0.5 text-red-500">*</span></label>
            <input
              type="text"
              value={form.description}
              maxLength={200}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="contoh: Token listrik Oktober"
              className={`${inputCss} mb-3`}
            />

            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCss}>Jumlah<span className="ml-0.5 text-red-500">*</span></label>
                <PriceInput value={form.amount} onChange={(n) => setForm((f) => ({ ...f, amount: n }))} className={inputCss} />
              </div>
              <div>
                <label className={labelCss}>Metode Bayar</label>
                <select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as FormState["paymentMethod"] }))} className={inputCss}>
                  <option value="cash">Tunai</option>
                  <option value="transfer">Transfer</option>
                  <option value="qris">QRIS</option>
                </select>
              </div>
            </div>

            {editTarget?.hasReceipt && !newReceipt && (
              <div className="mb-3 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-gray-700/50">
                <span className={removeReceipt ? "text-red-500 line-through" : "text-gray-600 dark:text-gray-300"}>Foto bukti tersimpan</span>
                <button type="button" onClick={() => setRemoveReceipt((r) => !r)} className="font-semibold text-red-500 hover:underline">
                  {removeReceipt ? "Batal hapus" : "Hapus foto"}
                </button>
              </div>
            )}
            <ProofImageInput
              label={editTarget?.hasReceipt ? "Ganti Foto Bukti (opsional)" : "Foto Bukti (opsional)"}
              value={newReceipt}
              onChange={(v) => { setNewReceipt(v); if (v) setRemoveReceipt(false); }}
              onError={setFormError}
              isDarkMode={isDarkMode}
              hint="Struk, nota, atau bukti transfer."
            />

            <label className={labelCss}>Catatan (opsional)</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCss} mb-4 resize-none`} />

            <div className="flex justify-end gap-2">
              <button onClick={() => setFormOpen(false)} className={btnSecondary}>Batal</button>
              <button onClick={handleSave} disabled={creating || updating} className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-60">
                {creating || updating ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HAPUS ─────────────────────────────────────── */}
      {deleteTarget && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
          <div className={`relative z-50 mx-4 w-full max-w-sm rounded-2xl p-6 shadow-2xl ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"}`}>
            <h3 className="mb-2 text-lg font-bold">Hapus Pengeluaran</h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
              Hapus <span className="font-semibold">{deleteTarget.expenseNumber}</span> — {deleteTarget.description} ({formatRupiah(deleteTarget.amount)})?
              Data tidak lagi dihitung di laporan.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className={btnSecondary}>Batal</button>
              <button onClick={handleDelete} disabled={deleting} className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-60">
                {deleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {proofTarget && <ProofModal expenseId={proofTarget} cardCss={cardCss} onClose={() => setProofTarget(null)} />}
    </div>
  );
};

export default ExpensesPage;
