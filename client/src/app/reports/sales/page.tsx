"use client";

import { useState } from "react";
import Header from "@/app/(components)/Header";
import ExportMenu from "@/app/(components)/ExportMenu";
import { useAppSelector } from "@/app/redux";
import { useGetSalesReportQuery, SalesReport } from "@/state/api";
import {
  ExportFormat,
  ReportDocument,
  exportReport,
  formatLongDate,
  formatRupiah,
  toLocalISODate,
} from "@/lib/reportExport";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUpIcon,
  ShoppingBagIcon,
  ReceiptIcon,
  CalendarIcon,
} from "lucide-react";
import { useCurrency } from "@/lib/useCurrency";

const PAYMENT_LABELS: Record<string, string> = {
  cash:     "Tunai",
  transfer: "Transfer",
  qris:     "QRIS",
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Susun isi laporan untuk export (CSV memakai tabel pertama: Transaksi)
const buildSalesReport = (
  data: SalesReport,
  period: { startDate: string; endDate: string }
): ReportDocument => {
  const { summary } = data;
  const average = summary.totalTransaksi > 0 ? summary.totalRevenue / summary.totalTransaksi : 0;

  return {
    title: "Laporan Penjualan",
    filename: `laporan-penjualan-${period.startDate}_sd_${period.endDate}`,
    meta: [
      ["Periode", `${formatLongDate(period.startDate)} - ${formatLongDate(period.endDate)}`],
      ["Total Pendapatan", formatRupiah(summary.totalRevenue)],
      ["Total Transaksi", summary.totalTransaksi.toLocaleString("id-ID")],
      ["Item Terjual", summary.totalItemTerjual.toLocaleString("id-ID")],
      ["Rata-rata per Transaksi", summary.totalTransaksi > 0 ? formatRupiah(average) : "-"],
      ...Object.entries(summary.paymentBreakdown).map(
        ([method, amount]): [string, string] => [
          `Pembayaran ${PAYMENT_LABELS[method] ?? method}`,
          formatRupiah(amount),
        ]
      ),
    ],
    tables: [
      {
        title: "Riwayat Transaksi",
        sheetName: "Transaksi",
        columns: [
          { header: "No", type: "number", width: 6 },
          { header: "No. Transaksi", width: 20 },
          { header: "Tanggal", width: 22 },
          { header: "Kasir", width: 18 },
          { header: "Pelanggan", width: 18 },
          { header: "Metode", width: 12 },
          { header: "Jumlah Item", type: "number", width: 12 },
          { header: "Total", type: "currency", width: 16 },
        ],
        rows: data.transactions.map((t, i) => [
          i + 1,
          t.transactionNumber,
          formatDateTime(t.createdAt),
          t.cashier?.name ?? "-",
          t.customerName || "-",
          PAYMENT_LABELS[t.paymentMethod] ?? t.paymentMethod,
          t.Items.reduce((s, it) => s + it.qty, 0),
          t.totalAmount,
        ]),
        totalRow: ["", "TOTAL", "", "", "", "", summary.totalItemTerjual, summary.totalRevenue],
      },
      {
        title: "Produk Terlaris",
        sheetName: "Produk Terlaris",
        columns: [
          { header: "Peringkat", type: "number", width: 10 },
          { header: "Produk", width: 30 },
          { header: "Terjual", type: "number", width: 10 },
          { header: "Pendapatan", type: "currency", width: 16 },
        ],
        rows: data.topProducts.map((p, i) => [i + 1, p.name, p.qty, p.revenue]),
      },
      {
        title: "Detail Item Terjual",
        sheetName: "Detail Item",
        columns: [
          { header: "No. Transaksi", width: 20 },
          { header: "Tanggal", width: 22 },
          { header: "Produk", width: 26 },
          { header: "Varian", width: 18 },
          { header: "Jumlah", type: "number", width: 9 },
          { header: "Harga Satuan", type: "currency", width: 15 },
          { header: "Subtotal", type: "currency", width: 15 },
        ],
        rows: data.transactions.flatMap((t) =>
          t.Items.map((it) => [
            t.transactionNumber,
            formatDateTime(t.createdAt),
            it.productName,
            it.variantName || "-",
            it.qty,
            it.unitPrice,
            it.subtotal,
          ])
        ),
      },
    ],
  };
};

const SalesReportPage = () => {
  const isDarkMode = useAppSelector((s) => s.global.isDarkMode);
  const { formatCurrency } = useCurrency();

  // Tanggal dihitung dengan waktu lokal (WIB), bukan UTC
  const today     = toLocalISODate(new Date());
  const firstDay  = toLocalISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate,   setEndDate]   = useState(today);
  const [applied,   setApplied]   = useState({ startDate: firstDay, endDate: today });
  const [filterError, setFilterError] = useState("");

  const { data, isLoading, isError } = useGetSalesReportQuery({
    startDate: applied.startDate,
    endDate:   applied.endDate,
  });

  // Siapkan data chart per hari
  const chartData = (() => {
    if (!data?.transactions) return [];
    const map = new Map<string, number>();
    for (const trx of data.transactions) {
      const day = new Date(trx.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      map.set(day, (map.get(day) ?? 0) + trx.totalAmount);
    }
    return Array.from(map.entries()).map(([date, total]) => ({ date, total }));
  })();

  const handleExport = async (format: ExportFormat) => {
    if (!data) return;
    await exportReport(buildSalesReport(data, applied), format);
  };

  const applyFilter = () => {
    if (!startDate || !endDate) {
      setFilterError("Tanggal awal dan akhir wajib diisi");
      return;
    }
    if (startDate > endDate) {
      setFilterError("Tanggal awal tidak boleh setelah tanggal akhir");
      return;
    }
    setFilterError("");
    setApplied({ startDate, endDate });
  };

  const cardCss   = `rounded-xl border p-5 shadow-sm ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`;
  const inputCss  = `rounded-lg border px-3 py-2 text-sm ${isDarkMode ? "border-gray-600 bg-gray-700 text-gray-100" : "border-gray-300 bg-white text-gray-900"} focus:outline-none focus:border-blue-500`;
  const labelCss  = `text-xs text-gray-400 mb-1 block`;

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      <div className="flex items-center justify-between">
        <Header name="Laporan Penjualan" />
        <ExportMenu onExport={handleExport} disabled={!data} isDarkMode={isDarkMode} />
      </div>

      {/* Filter Periode */}
      <div className={`${cardCss} print:hidden`}>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className={labelCss}><CalendarIcon className="inline h-3 w-3 mr-1" />Dari Tanggal</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCss} />
          </div>
          <div>
            <label className={labelCss}><CalendarIcon className="inline h-3 w-3 mr-1" />Sampai Tanggal</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCss} />
          </div>
          <button
            onClick={applyFilter}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600"
          >
            Tampilkan
          </button>
        </div>
        {filterError && <p className="text-xs text-red-500 mt-2">{filterError}</p>}
        <p className="text-xs text-gray-400 mt-2">
          Menampilkan data: {formatLongDate(applied.startDate)}
          {" — "}
          {formatLongDate(applied.endDate)}
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      )}

      {isError && (
        <div className="py-8 text-center text-red-500">Gagal memuat laporan</div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={cardCss}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/40">
                  <TrendingUpIcon className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-xs text-gray-400">Total Pendapatan</span>
              </div>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {formatCurrency(data.summary.totalRevenue)}
              </p>
            </div>
            <div className={cardCss}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                  <ReceiptIcon className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-xs text-gray-400">Total Transaksi</span>
              </div>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {data.summary.totalTransaksi}
              </p>
            </div>
            <div className={cardCss}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40">
                  <ShoppingBagIcon className="h-4 w-4 text-purple-600" />
                </div>
                <span className="text-xs text-gray-400">Item Terjual</span>
              </div>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {data.summary.totalItemTerjual}
              </p>
            </div>
            <div className={cardCss}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/40">
                  <TrendingUpIcon className="h-4 w-4 text-yellow-600" />
                </div>
                <span className="text-xs text-gray-400">Rata-rata/Transaksi</span>
              </div>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {data.summary.totalTransaksi > 0
                  ? formatCurrency(Math.round(data.summary.totalRevenue / data.summary.totalTransaksi))
                  : "—"}
              </p>
            </div>
          </div>

          {/* Breakdown Metode Bayar */}
          <div className={cardCss}>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Breakdown Metode Pembayaran</h3>
            <div className="flex gap-4 flex-wrap">
              {Object.entries(data.summary.paymentBreakdown).map(([method, amount]) => (
                <div key={method} className={`flex-1 min-w-[100px] rounded-lg p-3 ${isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{PAYMENT_LABELS[method] ?? method}</p>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{formatCurrency(amount)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Grafik Penjualan */}
          {chartData.length > 0 && (
            <div className={cardCss}>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Grafik Penjualan Harian</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#374151" : "#e5e7eb"} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: isDarkMode ? "#9ca3af" : "#6b7280" }} />
                  <YAxis tick={{ fontSize: 11, fill: isDarkMode ? "#9ca3af" : "#6b7280" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    cursor={{ fill: isDarkMode ? "rgba(233,115,159,0.12)" : "rgba(201,62,123,0.08)" }}
                    formatter={(v: unknown) => [formatCurrency(Number(v)), "Pendapatan"]}
                    contentStyle={{ backgroundColor: isDarkMode ? "#1f2937" : "#fff", borderColor: isDarkMode ? "#374151" : "#e5e7eb" }}
                  />
                  <Bar dataKey="total" fill="#c93e7b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Produk Terlaris */}
          {data.topProducts.length > 0 && (
            <div className={cardCss}>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Produk Terlaris</h3>
              <div className="space-y-2">
                {data.topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                      ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-100 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-500"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</p>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, (p.qty / (data.topProducts[0]?.qty ?? 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{p.qty} terjual</p>
                      <p className="text-xs text-gray-400">{formatCurrency(p.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabel Transaksi */}
          <div className={cardCss}>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Riwayat Transaksi ({data.transactions.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className={isDarkMode ? "border-b border-gray-700" : "border-b border-gray-200"}>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">No. Transaksi</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Tanggal</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Kasir</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Metode</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((trx) => (
                    <tr key={trx.transactionId} className={`border-b ${isDarkMode ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-gray-50"}`}>
                      <td className="py-2 px-3 font-mono text-xs text-gray-600 dark:text-gray-400">{trx.transactionNumber}</td>
                      <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                        {new Date(trx.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-700 dark:text-gray-300">{trx.cashier?.name ?? "—"}</td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                          trx.paymentMethod === "cash"     ? "bg-green-100 text-green-700"   :
                          trx.paymentMethod === "transfer" ? "bg-blue-100 text-blue-700"     :
                          "bg-purple-100 text-purple-700"
                        }`}>
                          {trx.paymentMethod.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-gray-800 dark:text-gray-100">
                        {formatCurrency(trx.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={isDarkMode ? "border-t border-gray-600" : "border-t border-gray-300"}>
                    <td colSpan={4} className="py-2 px-3 text-xs font-bold text-gray-700 dark:text-gray-300">Total</td>
                    <td className="py-2 px-3 text-right font-bold text-blue-600">
                      {formatCurrency(data.summary.totalRevenue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SalesReportPage;