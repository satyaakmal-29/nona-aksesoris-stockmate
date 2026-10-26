// client/src/lib/stockThresholds.ts
// Ambang stok menipis (keputusan final user). Nilai yang sama dipakai
// server di server/src/lib/stockHelpers.ts.
//   Gudang menipis : stok < 10
//   Toko menipis   : 0 < stok < 5   (stok 0 = "habis", dihitung terpisah)

export const LOW_STOCK_GUDANG = 10;
export const LOW_STOCK_TOKO = 5;

export const isLowGudang = (stock: number): boolean => stock < LOW_STOCK_GUDANG;

export const isOutToko = (stock: number): boolean => stock <= 0;

export const isLowToko = (stock: number): boolean =>
  stock > 0 && stock < LOW_STOCK_TOKO;
