"use client";

import Header from "@/app/(components)/Header";
import ExportMenu from "@/app/(components)/ExportMenu";
import { useAppSelector } from "@/app/redux";
import { useGetStockReportQuery, StockReport } from "@/state/api";
import {
  AlertTriangleIcon,
  PackageIcon,
  WarehouseIcon,
  ShoppingBagIcon,
  XCircleIcon,
} from "lucide-react";
import { useCurrency } from "@/lib/useCurrency";
import {
  ExportFormat,
  ReportDocument,
  exportReport,
  formatRupiah,
  nowLabel,
  toLocalISODate,
} from "@/lib/reportExport";
import {
  LOW_STOCK_GUDANG,
  LOW_STOCK_TOKO,
  isLowGudang,
  isLowToko,
  isOutToko,
} from "@/lib/stockThresholds";

// Status stok satu baris (produk / varian)
const stockStatus = (gudang: number, toko: number): string => {
  const notes: string[] = [];
  if (isOutToko(toko)) notes.push("Habis di toko");
  else if (isLowToko(toko)) notes.push("Toko menipis");
  if (isLowGudang(gudang)) notes.push(gudang === 0 ? "Habis di gudang" : "Gudang menipis");
  return notes.length > 0 ? notes.join(", ") : "Aman";
};

// Susun isi laporan untuk export: satu baris per varian
// (stok disimpan per varian; produk lama tanpa varian = satu baris)
const buildStockReport = (data: StockReport): ReportDocument => {
  const rows = data.products.flatMap((p) => {
    const variants = (p.Variants ?? []).filter((v) => v.isActive);
    if (variants.length === 0) {
      return [[p.name, "-", "-", p.category || "-", p.price, p.stockGudang, p.stockToko,
        p.stockGudang + p.stockToko, p.price * (p.stockGudang + p.stockToko), stockStatus(p.stockGudang, p.stockToko)]];
    }
    return variants.map((v) => {
      const price = v.price ?? p.price;
      return [p.name, v.name, v.value && v.value !== "-" ? v.value : "-", p.category || "-", price,
        v.stockGudang, v.stockToko, v.stockGudang + v.stockToko,
        price * (v.stockGudang + v.stockToko), stockStatus(v.stockGudang, v.stockToko)];
    });
  });

  const sum = (idx: number) => rows.reduce((s, r) => s + (r[idx] as number), 0);

  return {
    title: "Laporan Stok",
    filename: `laporan-stok-${toLocalISODate(new Date())}`,
    meta: [
      ["Per tanggal", nowLabel()],
      ["Total Produk", data.summary.totalProduk.toLocaleString("id-ID")],
      [`Stok Gudang Menipis (< ${LOW_STOCK_GUDANG})`, `${data.summary.lowStockGudang} produk`],
      [`Stok Toko Menipis (< ${LOW_STOCK_TOKO})`, `${data.summary.lowStockToko} produk`],
      ["Habis di Toko", `${data.summary.outOfStockToko} produk`],
      ["Nilai Stok (harga jual)", formatRupiah(sum(8))],
    ],
    tables: [
      {
        title: "Stok per Varian",
        sheetName: "Stok per Varian",
        columns: [
          { header: "Produk", width: 26 },
          { header: "Varian", width: 18 },
          { header: "Ukuran", width: 10 },
          { header: "Kategori", width: 14 },
          { header: "Harga", type: "currency", width: 14 },
          { header: "Stok Gudang", type: "number", width: 12 },
          { header: "Stok Toko", type: "number", width: 11 },
          { header: "Total", type: "number", width: 9 },
          { header: "Nilai Stok", type: "currency", width: 16 },
          { header: "Status", width: 26 },
        ],
        rows,
        totalRow: ["TOTAL", "", "", "", null, sum(5), sum(6), sum(7), sum(8), ""],
      },
    ],
  };
};

const StockReportPage = () => {
  const isDarkMode     = useAppSelector((s) => s.global.isDarkMode);
  const { formatCurrency } = useCurrency();

  const { data, isLoading, isError } = useGetStockReportQuery();

  const handleExport = async (format: ExportFormat) => {
    if (!data) return;
    await exportReport(buildStockReport(data), format);
  };

  const cardCss  = `rounded-xl border p-5 shadow-sm ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`;

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>
  );
  if (isError) return <div className="py-8 text-center text-red-500">Gagal memuat laporan stok</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Header name="Laporan Stok" />
        <ExportMenu onExport={handleExport} disabled={!data} isDarkMode={isDarkMode} />
      </div>

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={cardCss}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                  <PackageIcon className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-xs text-gray-400">Total Produk</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{data.summary.totalProduk}</p>
            </div>
            <div className={cardCss}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/40">
                  <WarehouseIcon className="h-4 w-4 text-yellow-600" />
                </div>
                <span className="text-xs text-gray-400">Stok Gudang Menipis (&lt; {LOW_STOCK_GUDANG})</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">{data.summary.lowStockGudang}</p>
            </div>
            <div className={cardCss}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/40">
                  <ShoppingBagIcon className="h-4 w-4 text-orange-600" />
                </div>
                <span className="text-xs text-gray-400">Stok Toko Menipis (&lt; {LOW_STOCK_TOKO})</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">{data.summary.lowStockToko}</p>
            </div>
            <div className={cardCss}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40">
                  <XCircleIcon className="h-4 w-4 text-red-600" />
                </div>
                <span className="text-xs text-gray-400">Habis di Toko</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{data.summary.outOfStockToko}</p>
            </div>
          </div>

          {/* Alert: Habis di Toko */}
          {data.alerts.outOfStockToko.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <XCircleIcon className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-bold text-red-700 dark:text-red-400">
                  Stok Habis di Toko ({data.alerts.outOfStockToko.length} produk)
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.alerts.outOfStockToko.map((p) => (
                  <span key={p.productId} className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Alert: Menipis di Toko */}
          {data.alerts.lowStockToko.length > 0 && (
            <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangleIcon className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-bold text-orange-700 dark:text-orange-400">
                  Stok Toko Menipis ({data.alerts.lowStockToko.length} produk)
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.alerts.lowStockToko.map((p) => (
                  <span key={p.productId} className="px-2 py-1 rounded-lg text-xs font-semibold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                    {p.name} ({p.stockToko})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tabel Stok Lengkap */}
          <div className={cardCss}>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Daftar Stok Semua Produk
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className={`border-b ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Produk</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Kategori</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Harga</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Stok Gudang</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Stok Toko</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => {
                    const isOutOfStock = isOutToko(p.stockToko);
                    const lowToko      = isLowToko(p.stockToko);
                    const lowGudang    = isLowGudang(p.stockGudang);
                    return (
                      <tr
                        key={p.productId}
                        className={`border-b transition-colors ${
                          isDarkMode ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-gray-50"
                        }`}
                      >
                        <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-200">{p.name}</td>
                        <td className="py-2.5 px-3 text-xs text-gray-500">{p.category ?? "—"}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-gray-600 dark:text-gray-400">
                          {formatCurrency(p.price)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`text-xs font-semibold ${lowGudang ? "text-yellow-600" : "text-gray-700 dark:text-gray-300"}`}>
                            {p.stockGudang}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`text-xs font-semibold ${
                            isOutOfStock ? "text-red-600" : lowToko ? "text-orange-500" : "text-gray-700 dark:text-gray-300"
                          }`}>
                            {p.stockToko}
                            {isOutOfStock && " ⚠"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-bold text-gray-800 dark:text-gray-100">
                          {p.stockGudang + p.stockToko}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StockReportPage;