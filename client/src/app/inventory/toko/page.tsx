"use client";

import Image from "next/image";
import Header from "@/app/(components)/Header";
import { useAppSelector } from "@/app/redux";
import { useGetStockTokoQuery, useGetStockMovementsQuery } from "@/state/api";
import { useState } from "react";
import { SearchIcon, ChevronDownIcon, ChevronUpIcon, ImageIcon } from "lucide-react";
import { useCurrency } from "@/lib/useCurrency";
import { isLowToko, isOutToko } from "@/lib/stockThresholds";

// Scrollbar tipis agar tidak mengganggu tampilan
const slimScroll =
  "[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600";

// Ukuran varian ("-" berarti tidak diisi)
const sizeOf = (value?: string | null): string =>
  value && value !== "-" ? value : "";

// "po_transfer" = tipe lama (data uji) untuk barang masuk dari gudang
const movementLabel = (type: string): string => {
  if (type === "sale")        return "Terjual";
  if (type === "sr_transfer") return "Masuk dari Gudang";
  if (type === "po_transfer") return "Masuk dari Gudang";
  if (type === "adjustment")  return "Penyesuaian";
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

const StockTokoPage = () => {
  const isDarkMode     = useAppSelector((s) => s.global.isDarkMode);
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: products, isLoading } = useGetStockTokoQuery(search || undefined);
  const { data: movements }           = useGetStockMovementsQuery({ location: "toko", limit: 50 });

  const cardCss = `rounded-xl border shadow-sm ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`;

  return (
    <div className="flex flex-col gap-5">
      <Header name="Inventori Toko" />

      {/* Search */}
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 ${isDarkMode ? "border-gray-600 bg-gray-800" : "border-gray-200 bg-white"}`}>
        <SearchIcon className="h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari produk..."
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
                      isOutToko(p.stockToko) ? "text-red-500"    :
                      isLowToko(p.stockToko) ? "text-orange-500" :
                      "text-gray-800 dark:text-gray-100"
                    }`}>
                      {p.stockToko}
                    </p>
                    <p className="text-xs text-gray-400">unit</p>
                  </div>
                  {isOpen
                    ? <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                    : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
                </div>
              </div>

              {/* Detail varian: foto, nama varian, ukuran, harga, stok toko */}
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
                          <div className="text-right">
                            <p className={`text-base font-bold ${
                              isOutToko(v.stockToko) ? "text-red-500" : isLowToko(v.stockToko) ? "text-orange-500" : "text-blue-500"
                            }`}>
                              {v.stockToko}
                            </p>
                            <p className="text-xs text-gray-400">unit</p>
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

      {/* Riwayat Pergerakan Stok Toko */}
      {movements && movements.length > 0 && (
        <div className={`${cardCss} p-5`}>
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Riwayat Pergerakan Stok Toko (50 terakhir)
          </h3>
          <div className={`max-h-80 space-y-2 overflow-y-auto pr-2 ${slimScroll}`}>
            {movements.map((m) => (
              <div key={m.id} className={`flex items-center justify-between border-b py-2 ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{m.product?.name}</p>
                  <p className="text-xs text-gray-400">
                    {movementLabel(m.type)}
                    {m.notes && ` • ${m.notes}`}
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

export default StockTokoPage;