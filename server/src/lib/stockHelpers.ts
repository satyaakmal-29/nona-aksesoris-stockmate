import { Response } from "express";
import { Prisma } from "@prisma/client";

// Ambang stok menipis (sama dengan client/src/lib/stockThresholds.ts)
//   Gudang menipis : stok < 10
//   Toko menipis   : 0 < stok < 5   (stok 0 = "habis", dihitung terpisah)
export const LOW_STOCK_GUDANG = 10;
export const LOW_STOCK_TOKO = 5;

// Error bisnis → dikirim ke klien sebagai 400 dengan pesan yang jelas
export class BusinessError extends Error {}

export const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof BusinessError) {
    res.status(400).json({ message: error.message });
    return;
  }
  console.error(fallback, error);
  res.status(500).json({ message: fallback });
};

export const isPositiveInt = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= 1;

export const isNonNegativeInt = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= 0;

export const cleanText = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

// Foto bukti harus berupa data URL gambar & tidak terlalu besar
export const requireImage = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    throw new BusinessError(`${label} wajib diunggah (berupa gambar)`);
  }
  if (value.length > 4_000_000) {
    throw new BusinessError(`${label} terlalu besar. Gunakan foto dengan ukuran lebih kecil.`);
  }
  return value;
};

// Prefix nomor dokumen: "SR-20261015" → nomor berikutnya "SR-20261015-001"
export const datePrefix = (prefix: string): string => {
  const d = new Date();
  return `${prefix}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

export const nextNumber = (prefix: string, lastNumber?: string | null): string => {
  const lastSeq = lastNumber ? parseInt(lastNumber.split("-")[2] ?? "0", 10) : 0;
  return `${prefix}-${String(lastSeq + 1).padStart(3, "0")}`;
};

// Sinkronkan stok & harga level produk dari varian aktif
// (stok produk = jumlah stok varian, harga produk = harga varian terendah)
export const syncProductAggregates = async (
  tx: Prisma.TransactionClient,
  productId: string
): Promise<void> => {
  const variants = await tx.productVariant.findMany({
    where: { productId, isActive: true },
  });
  if (variants.length === 0) return;

  const stockGudang = variants.reduce((s, v) => s + v.stockGudang, 0);
  const stockToko = variants.reduce((s, v) => s + v.stockToko, 0);
  const prices = variants
    .map((v) => v.price)
    .filter((p): p is number => p !== null && p !== undefined);

  await tx.products.update({
    where: { productId },
    data: {
      stockGudang,
      stockToko,
      ...(prices.length > 0 ? { price: Math.min(...prices) } : {}),
    },
  });
};