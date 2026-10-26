// Hitung ulang stok & harga tingkat produk dari varian aktifnya
// (stok produk = jumlah stok varian, harga produk = harga varian terendah).
//
// Pratinjau (tidak mengubah data):  npm run resync-stock
// Terapkan perubahan:               npm run resync-stock -- --apply
//
// Dipakai untuk memperbaiki data lama yang tidak sinkron, mis. dari alur
// Restock / PO lama yang menaikkan stok varian tanpa memperbarui produk.

import { prisma } from "../lib/prisma";
import { syncProductAggregates } from "../lib/stockHelpers";

const apply = process.argv.includes("--apply");

const main = async () => {
  const products = await prisma.products.findMany({
    where:   { isActive: true },
    include: { Variants: { where: { isActive: true } } },
    orderBy: { name: "asc" },
  });

  const mismatched = products
    .filter((p) => p.Variants.length > 0)
    .map((p) => {
      const gudang = p.Variants.reduce((s, v) => s + v.stockGudang, 0);
      const toko   = p.Variants.reduce((s, v) => s + v.stockToko, 0);
      const prices = p.Variants
        .map((v) => v.price)
        .filter((x): x is number => x !== null && x !== undefined);
      const price  = prices.length > 0 ? Math.min(...prices) : p.price;
      return { p, gudang, toko, price };
    })
    .filter(({ p, gudang, toko, price }) =>
      p.stockGudang !== gudang || p.stockToko !== toko || p.price !== price
    );

  console.log(`Produk aktif bervarian diperiksa: ${products.filter((p) => p.Variants.length > 0).length}`);

  if (mismatched.length === 0) {
    console.log("Semua produk sudah sinkron. Tidak ada yang diubah.");
    return;
  }

  console.log(`Tidak sinkron: ${mismatched.length} produk`);
  for (const { p, gudang, toko, price } of mismatched) {
    console.log(
      `- ${p.name}: gudang ${p.stockGudang} -> ${gudang}, toko ${p.stockToko} -> ${toko}, harga ${p.price} -> ${price}`
    );
  }

  if (!apply) {
    console.log("\nMode pratinjau. Jalankan dengan --apply untuk menyimpan perubahan.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const { p } of mismatched) {
      await syncProductAggregates(tx, p.productId);
    }
  });
  console.log(`\nSelesai: ${mismatched.length} produk diperbarui.`);
};

main()
  .catch((e) => {
    console.error("resyncStock gagal:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
