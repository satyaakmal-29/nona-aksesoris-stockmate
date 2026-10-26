"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon, PencilIcon, PlusCircleIcon, TrashIcon } from "lucide-react";
import Header from "@/app/(components)/Header";
import Rating from "@/app/(components)/Rating";
import ProductFormModal from "./ProductFormModal";
import {
  Product,
  useDeleteProductMutation,
  useGetProductsQuery,
} from "@/state/api";
import { useAppSelector } from "@/app/redux";
import { getTranslation } from "@/lib/translations";
import { useCurrency } from "@/lib/useCurrency";
import { isLowGudang, isLowToko, isOutToko } from "@/lib/stockThresholds";

const getFallbackImage = (productId: string): string => {
  const index = (productId.charCodeAt(0) % 3) + 1;
  return `/assets/product${index}.png`;
};

// Ukuran varian ("-" berarti tidak diisi)
const sizeOf = (value?: string | null): string =>
  value && value !== "-" ? value : "";

const Products = () => {
  const [isFormOpen,       setIsFormOpen]       = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [deleteTarget,     setDeleteTarget]     = useState<Product | null>(null);
  const [deleteError,      setDeleteError]      = useState<string | null>(null);

  const searchTerm  = useAppSelector((s) => s.global.searchTerm) ?? "";
  const isDarkMode  = useAppSelector((s) => s.global.isDarkMode);
  const currentUser = useAppSelector((s) => s.global.currentUser);
  const t           = getTranslation().products;
  const { formatCurrency } = useCurrency();

  // Wewenang: hanya super_admin yang mengelola master produk
  const isSuperAdmin = currentUser?.role === "super_admin";

  const { data: products, isLoading, isError } = useGetProductsQuery(searchTerm);
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();

  // Produk yang sedang diedit selalu diambil dari data terbaru,
  // supaya daftar varian di modal ikut berubah setelah tambah/hapus varian
  const editingProduct =
    editingProductId && products
      ? products.find((p) => p.productId === editingProductId) ?? null
      : null;

  const openCreate = () => {
    setEditingProductId(null);
    setIsFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProductId(product.productId);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingProductId(null);
  };

  const openDelete = (product: Product) => {
    setDeleteError(null);
    setDeleteTarget(product);
  };

  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteProduct(deleteTarget.productId).unwrap();
      setDeleteTarget(null);
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      setDeleteError(data?.message ?? "Gagal menghapus produk. Silakan coba lagi.");
    }
  };

  if (isLoading) {
    return <div className="py-4 dark:text-gray-100">Memuat produk...</div>;
  }
  if (isError || !products) {
    return <div className="py-4 text-center text-red-500">Gagal memuat produk</div>;
  }

  return (
    <div className="mx-auto w-full pb-5">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Header name={t.title} />
        {/* Hanya super_admin yang bisa tambah produk */}
        {isSuperAdmin && (
          <button
            className="flex items-center rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
            onClick={openCreate}
          >
            <PlusCircleIcon className="mr-2 h-5 w-5" />
            {t.createProduct}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 justify-between gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product: Product) => {
          const variants = product.Variants ?? [];
          return (
            <div
              key={product.productId}
              className={`mx-auto flex w-full flex-col rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700 text-gray-100"
                  : "bg-white border-gray-200 text-gray-900"
              }`}
            >
              <div className="flex flex-1 flex-col items-center">
                {/* Foto sampul produk */}
                <Image
                  src={product.imageUrl || getFallbackImage(product.productId)}
                  alt={product.name}
                  width={150}
                  height={150}
                  unoptimized={!!product.imageUrl}
                  className="mb-3 h-36 w-36 rounded-2xl object-cover"
                />
                <h3 className="text-center text-base font-semibold">{product.name}</h3>
                {product.category && (
                  <span className="mt-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    {product.category}
                  </span>
                )}
                <p className="mt-2 font-bold text-blue-600 dark:text-blue-400">
                  {variants.length > 1 && (
                    <span className="mr-1 text-xs font-normal text-gray-400">Mulai dari</span>
                  )}
                  {formatCurrency(product.price)}
                </p>

                {/* Total stok Gudang & Toko (jumlah semua varian) */}
                <div className="mt-2 flex gap-3 text-xs">
                  <div className="text-center">
                    <p className="text-gray-400">Gudang</p>
                    <p
                      className={`font-bold ${
                        isLowGudang(product.stockGudang)
                          ? "text-yellow-500"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {product.stockGudang}
                    </p>
                  </div>
                  <div className="w-px bg-gray-200 dark:bg-gray-600" />
                  <div className="text-center">
                    <p className="text-gray-400">Toko</p>
                    <p
                      className={`font-bold ${
                        isOutToko(product.stockToko)
                          ? "text-red-500"
                          : isLowToko(product.stockToko)
                          ? "text-orange-500"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {product.stockToko}
                    </p>
                  </div>
                </div>

                {/* Daftar varian: foto, nama varian, ukuran, stok */}
                {variants.length > 0 ? (
                  <div className="mt-3 w-full space-y-1.5">
                    <p className="text-xs font-semibold text-gray-400">
                      Varian ({variants.length})
                    </p>
                    {variants.map((v) => {
                      const size = sizeOf(v.value);
                      return (
                        <div
                          key={v.variantId}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                            isDarkMode ? "bg-gray-700/60" : "bg-gray-50"
                          }`}
                        >
                          {v.imageUrl ? (
                            <Image
                              src={v.imageUrl}
                              alt={v.name}
                              width={32}
                              height={32}
                              unoptimized
                              className="h-8 w-8 shrink-0 rounded-md object-cover"
                            />
                          ) : (
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                                isDarkMode ? "bg-gray-600" : "bg-gray-200"
                              }`}
                            >
                              <ImageIcon className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {v.name}
                              {size && (
                                <span className="ml-1 font-normal text-gray-400">· {size}</span>
                              )}
                            </p>
                            <p className="text-gray-400">
                              {v.price != null ? formatCurrency(v.price) : "—"}
                            </p>
                          </div>
                          <span className="shrink-0 text-gray-500 dark:text-gray-400">
                            G {v.stockGudang} · T {v.stockToko}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  isSuperAdmin && (
                    <p className="mt-3 text-center text-xs text-orange-500">
                      Belum ada varian. Klik Edit untuk menambahkan.
                    </p>
                  )
                )}

                {product.rating != null && (
                  <div className="mt-2">
                    <Rating rating={product.rating} />
                  </div>
                )}
              </div>

              {/* Aksi: hanya super_admin */}
              {isSuperAdmin && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => openEdit(product)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40"
                  >
                    <PencilIcon className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => openDelete(product)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Hapus
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {products.length === 0 && (
        <div className={`mt-10 text-center ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
          Tidak ada produk ditemukan
        </div>
      )}

      {/* Modal tambah / edit produk */}
      {isSuperAdmin && (
        <ProductFormModal
          isOpen={isFormOpen}
          onClose={closeForm}
          product={editingProduct}
        />
      )}

      {/* Dialog konfirmasi hapus */}
      {isSuperAdmin && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeDelete} />
          <div
            className={`relative z-50 mx-4 w-full max-w-sm rounded-2xl p-6 shadow-2xl ${
              isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"
            }`}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/40">
                <TrashIcon className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold">Hapus produk?</h3>
            </div>
            <p className={`mb-2 text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
              Produk <span className="font-semibold">{deleteTarget.name}</span> akan dihapus dari daftar
              beserta variannya.
            </p>
            <p className={`mb-4 text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              Riwayat transaksi, purchase order, dan laporan yang memakai produk ini tetap tersimpan.
            </p>
            {deleteError && (
              <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={closeDelete}
                className={`rounded-lg px-4 py-2 text-sm ${
                  isDarkMode
                    ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {t.cancel}
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-60"
              >
                {isDeleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;