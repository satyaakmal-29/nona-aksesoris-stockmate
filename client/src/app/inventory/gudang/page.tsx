"use client";

import Image from "next/image";
import Header from "@/app/(components)/Header";
import { useAppSelector } from "@/app/redux";
import { useGetStockGudangQuery, useGetStockMovementsQuery } from "@/state/api";
import { useState } from "react";
import { SearchIcon, ChevronDownIcon, ChevronUpIcon, ImageIcon } from "lucide-react";
import { useCurrency } from "@/lib/useCurrency";
import { isLowGudang } from "@/lib/stockThresholds";

// Scrollbar tipis agar tidak mengganggu tampilan
const slimScroll =
  "[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600";

// Ukuran varian ("-" berarti tidak diisi)
const sizeOf = (value?: string | null): string =>
  value && value !== "-" ? value : "";

// "po_transfer" = tipe lama (data uji) untuk pengiriman ke toko
const movementLabel = (type: string): string => {
  if (type === "restock_gudang") return "Pembelian dari Supplier";
  if (type === "sr_transfer")    return "Dikirim ke Toko";
  if (type === "po_transfer")    return "Dikirim ke Toko";
  if (type === "adjustment")     return "Penyesuaian";
  return type;
};

type ThumbProps = {
  src?: string | null;
  alt: string;
  size: number;
  isDarkMode: boolean;
};

// Foto kecil; jika tidak ada foto tampil kotak abu-abu dengan ikon
const Thumb = ({ src, alt, size, isDarkMode }: ThumbProps) =>
  src ? (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      style={{ width: size, height: size }}
      className="shrink-0 rounded-lg object-cover"
    />
  ) : (
    <div
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-lg ${
        isDarkMode ? "bg-gray-700" : "bg-gray-100"
      }`}
    >
      <ImageIcon className="h-1/2 w-1/2 text-gray-400" />
    </div>
  );

const StockGudangPage = () => {
  const isDarkMode     = useAppSelector((s) => s.global.isDarkMode);
  const { formatCurrency } = useCurrency();
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: products, isLoading } = useGetStockGudangQuery(search || undefined);
  const { data: movements }           = useGetStockMovementsQuery({ location: "gudang", limit: 50 });

  const cardCss = `rounded-xl border shadow-sm ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`;

  // Nilai stok gudang dihitung per varian (stok × harga varian).
  // Produk tanpa varian memakai harga produk.
  const totalNilaiGudang =
    products?.reduce((sum, p) => {
      const variants = p.Variants ?? [];
      if (variants.length === 0) return sum + p.price * p.stockGudang;
      return (
        sum +
        variants.reduce((vs, v) => vs + (v.price ?? p.price) * v.stockGudang, 0)
      );
    }, 0) ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <Header name="Inventori Gudang" />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`${cardCss} p-4`}>
          <p className="mb-1 text-xs text-gray-400">Total Produk</p>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{products?.length ?? 0}</p>
        </div>
        <div className={`${cardCss} p-4`}>
          <p className="mb-1 text-xs text-gray-400">Total Unit Gudang</p>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {products?.reduce((s, p) => s + p.stockGudang, 0) ?? 0}
          </p>
        </div>
        <div className={`${cardCss} p-4`}>
          <p className="mb-1 text-xs text-gray-400">Nilai Stok Gudang</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalNilaiGudang)}</p>
        </div>
      </div>

      {/* Search */}
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 ${isDarkMode ? "border-gray-600 bg-gray-800" : "border-gray-200 bg-white"}`}>
        <SearchIcon className="h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari produk di gudang..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none"
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      )}

      {/* Satu baris per produk; varian tampil saat dibuka */}
      <div className="grid grid-cols-1 gap-3">
        {products?.map((p) => {
          const variants = p.Variants ?? [];
          const isOpen   = expanded === p.productId;
          return (
            <div key={p.productId} className={cardCss}>
              <div
                className="flex cursor-pointer items-center justify-between p-4"
                onClick={() => setExpanded(isOpen ? null : p.productId)}
              >
                <div className="flex items-center gap-3">
                  <Thumb src={p.imageUrl} alt={p.name} size={44} isDarkMode={isDarkMode} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      {p.category ?? "—"} • {variants.length > 1 ? "Mulai dari " : ""}{formatCurrency(p.price)}
                      {variants.length > 0 && ` • ${variants.length} varian`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      p.stockGudang === 0         ? "text-red-500"    :
                      isLowGudang(p.stockGudang) ? "text-yellow-500" :
                      "text-gray-800 dark:text-gray-100"
                    }`}>
                      {p.stockGudang}
                    </p>
                    <p className="text-xs text-gray-400">unit gudang</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-blue-500">{p.stockToko}</p>
                    <p className="text-xs text-gray-400">unit toko</p>
                  </div>
                  {isOpen
                    ? <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                    : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
                </div>
              </div>

              {/* Detail varian: foto, nama varian, ukuran, harga, stok gudang & toko */}
              {isOpen && variants.length > 0 && (
                <div className={`border-t px-4 pb-3 pt-3 ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
                  <p className="mb-2 text-xs font-semibold text-gray-500">Varian ({variants.length})</p>
                  <div className="space-y-2">
                    {variants.map((v) => {
                      const size = sizeOf(v.value);
                      return (
                        <div
                          key={v.variantId}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                            isDarkMode ? "bg-gray-700/60" : "bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Thumb src={v.imageUrl} alt={v.name} size={40} isDarkMode={isDarkMode} />
                            <div>
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                {v.name}
                                {size && <span className="ml-1 text-xs font-normal text-gray-400">· {size}</span>}
                              </p>
                              <p className="text-xs text-gray-400">
                                {v.price != null ? formatCurrency(v.price) : "—"}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-4 text-xs">
                            <span className={`font-bold ${
                              v.stockGudang === 0 ? "text-red-500" : isLowGudang(v.stockGudang) ? "text-yellow-500" : "text-gray-600 dark:text-gray-300"
                            }`}>
                              Gudang: {v.stockGudang}
                            </span>
                            <span className="font-bold text-blue-500">
                              Toko: {v.stockToko}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Riwayat Pergerakan Stok Gudang */}
      {movements && movements.length > 0 && (
        <div className={`${cardCss} p-5`}>
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Riwayat Pergerakan Stok Gudang (50 terakhir)
          </h3>
          <div className={`max-h-80 space-y-2 overflow-y-auto pr-2 ${slimScroll}`}>
            {movements.map((m) => (
              <div key={m.id} className={`flex items-center justify-between border-b py-2 ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{m.product?.name}</p>
                  <p className="text-xs text-gray-400">
                    {movementLabel(m.type)}
                    {m.user && ` • ${m.user.name}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${m.quantity < 0 ? "text-red-500" : "text-green-500"}`}>
                    {m.quantity > 0 ? "+" : ""}{m.quantity}
                  </p>
                  <p className="text-xs text-gray-400">{m.stockAfter} sisa</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StockGudangPage;