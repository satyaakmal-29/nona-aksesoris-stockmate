import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { v4 as uuidv4 } from "uuid";

// ─── Helper validasi ────────────────────────────────────────────
const isValidPrice = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

const isValidStock = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

// Nilai bawaan agar kolom type/value di database tetap terisi
const DEFAULT_VARIANT_TYPE  = "Ukuran";
const DEFAULT_VARIANT_VALUE = "-";

type VariantInput = {
  name:         string;
  type?:        string;   // opsional, default "Ukuran"
  value?:       string;   // opsional (ukuran, contoh: 30ml), default "-"
  imageUrl?:    string | null;
  price:        number;
  stockGudang?: number;
  stockToko?:   number;
};

// Mengembalikan pesan error, atau null jika varian valid
const validateVariant = (v: Partial<VariantInput>): string | null => {
  if (!v.name?.toString().trim()) return "Nama varian wajib diisi";
  if (v.price === undefined || v.price === null) return "Harga varian wajib diisi";
  if (!isValidPrice(v.price)) return "Harga varian harus berupa angka 0 atau lebih";
  if (v.stockGudang !== undefined && !isValidStock(v.stockGudang))
    return "Stok gudang varian harus bilangan bulat 0 atau lebih";
  if (v.stockToko !== undefined && !isValidStock(v.stockToko))
    return "Stok toko varian harus bilangan bulat 0 atau lebih";
  return null;
};

// Jika produk punya varian aktif:
//  - stok produk  = jumlah stok semua varian
//  - harga produk = harga terendah dari varian
// Jika tidak punya varian, data produk dibiarkan apa adanya.
const syncProductAggregates = async (
  tx: Prisma.TransactionClient,
  productId: string
): Promise<{ stockGudang: number; stockToko: number }> => {
  const variants = await tx.productVariant.findMany({
    where:  { productId, isActive: true },
    select: { price: true, stockGudang: true, stockToko: true },
  });

  if (variants.length === 0) {
    const p = await tx.products.findUnique({ where: { productId } });
    return { stockGudang: p?.stockGudang ?? 0, stockToko: p?.stockToko ?? 0 };
  }

  const stockGudang = variants.reduce((sum, v) => sum + v.stockGudang, 0);
  const stockToko   = variants.reduce((sum, v) => sum + v.stockToko, 0);
  const prices = variants
    .map((v) => v.price)
    .filter((p): p is number => p !== null && p !== undefined);

  const data: { stockGudang: number; stockToko: number; price?: number } = {
    stockGudang,
    stockToko,
  };
  if (prices.length > 0) data.price = Math.min(...prices);

  await tx.products.update({ where: { productId }, data });
  return { stockGudang, stockToko };
};

type MovementInput = {
  productId:   string;
  userId:      string;
  location:    string;
  type:        string;
  quantity:    number;
  stockBefore: number;
  stockAfter:  number;
  notes:       string;
};

// ─── GET /products ──────────────────────────────────────────────
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const search   = req.query.search?.toString();
    const category = req.query.category?.toString();

    const products = await prisma.products.findMany({
      where: {
        isActive: true,
        ...(search   ? { name:     { contains: search,   mode: "insensitive" } } : {}),
        ...(category ? { category: { equals:   category, mode: "insensitive" } } : {}),
      },
      include: {
        Variants: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(products);
  } catch (error) {
    console.error("getProducts error:", error);
    res.status(500).json({ message: "Error retrieving products" });
  }
};

// ─── POST /products ─────────────────────────────────────────────
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      category,
      imageUrl,
      variants = [],
    } = req.body as {
      name:         string;
      description?: string;
      category?:    string;
      imageUrl?:    string | null; // foto sampul produk
      variants?:    VariantInput[];
    };

    // ── Validasi ──
    if (!name || !name.toString().trim()) {
      res.status(400).json({ message: "Nama produk wajib diisi" });
      return;
    }
    if (!Array.isArray(variants) || variants.length === 0) {
      res.status(400).json({ message: "Produk wajib memiliki minimal 1 varian" });
      return;
    }
    for (const v of variants) {
      const err = validateVariant(v);
      if (err) {
        res.status(400).json({ message: err });
        return;
      }
    }

    // Stok & harga produk dihitung dari varian
    const totalGudang  = variants.reduce((sum, v) => sum + (v.stockGudang ?? 0), 0);
    const totalToko    = variants.reduce((sum, v) => sum + (v.stockToko   ?? 0), 0);
    const lowestPrice  = Math.min(...variants.map((v) => v.price));

    const productId     = uuidv4();
    const currentUserId = req.session.userId ?? "";

    // Produk, varian, dan log stok awal disimpan dalam satu transaksi
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.products.create({
        data: {
          productId,
          name:        name.toString().trim(),
          description: description || null,
          category:    category    || null,
          price:       lowestPrice,
          imageUrl:    imageUrl    || null,
          stockGudang: totalGudang,
          stockToko:   totalToko,
          Variants: {
            create: variants.map((v) => ({
              variantId:   uuidv4(),
              name:        v.name.trim(),
              type:        v.type?.trim()  || DEFAULT_VARIANT_TYPE,
              value:       v.value?.trim() || DEFAULT_VARIANT_VALUE,
              imageUrl:    v.imageUrl      || null,
              price:       v.price,
              stockGudang: v.stockGudang ?? 0,
              stockToko:   v.stockToko   ?? 0,
            })),
          },
        },
        include: { Variants: true },
      });

      // Catat stock movement jika ada stok awal
      const movements: MovementInput[] = [];

      if (totalGudang > 0) {
        movements.push({
          productId,
          userId:      currentUserId,
          location:    "gudang",
          type:        "restock_gudang",
          quantity:    totalGudang,
          stockBefore: 0,
          stockAfter:  totalGudang,
          notes:       "Stok awal saat produk dibuat",
        });
      }
      if (totalToko > 0) {
        movements.push({
          productId,
          userId:      currentUserId,
          location:    "toko",
          type:        "adjustment",
          quantity:    totalToko,
          stockBefore: 0,
          stockAfter:  totalToko,
          notes:       "Stok awal toko saat produk dibuat",
        });
      }
      if (movements.length > 0) {
        await tx.stockMovement.createMany({ data: movements });
      }

      return created;
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("createProduct error:", error);
    res.status(500).json({ message: "Error creating product" });
  }
};

// ─── PUT /products/:productId ────────────────────────────────────
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params as { productId: string };
    const {
      name,
      description,
      category,
      price,
      imageUrl,
      isActive,
    } = req.body;

    const existing = await prisma.products.findUnique({
      where:   { productId },
      include: { Variants: { where: { isActive: true } } },
    });
    if (!existing) {
      res.status(404).json({ message: "Produk tidak ditemukan" });
      return;
    }

    // ── Validasi ──
    if (name !== undefined && !name.toString().trim()) {
      res.status(400).json({ message: "Nama produk tidak boleh kosong" });
      return;
    }

    const hasVariants = existing.Variants.length > 0;

    const updateData: Record<string, unknown> = {};
    if (name        !== undefined) updateData.name        = name.toString().trim();
    if (description !== undefined) updateData.description = description;
    if (category    !== undefined) updateData.category    = category;
    if (imageUrl    !== undefined) updateData.imageUrl    = imageUrl;
    if (isActive    !== undefined) updateData.isActive    = isActive;

    // Harga produk dihitung dari varian. Hanya produk lama tanpa varian
    // yang masih boleh diubah harganya langsung.
    if (price !== undefined && !hasVariants) {
      if (!isValidPrice(price)) {
        res.status(400).json({ message: "Harga harus berupa angka 0 atau lebih" });
        return;
      }
      updateData.price = price;
    }

    const product = await prisma.products.update({
      where: { productId },
      data:  updateData,
      include: { Variants: { where: { isActive: true } } },
    });

    res.json(product);
  } catch (error) {
    console.error("updateProduct error:", error);
    res.status(500).json({ message: "Error updating product" });
  }
};

// ─── DELETE /products/:productId ─────────────────────────────────
// Soft delete: produk & variannya dinonaktifkan agar riwayat transaksi,
// PO, restock, pergerakan stok, dan laporan tetap utuh.
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params as { productId: string };

    const existing = await prisma.products.findUnique({ where: { productId } });
    if (!existing || !existing.isActive) {
      res.status(404).json({ message: "Produk tidak ditemukan" });
      return;
    }

    await prisma.$transaction([
      prisma.productVariant.updateMany({
        where: { productId },
        data:  { isActive: false },
      }),
      prisma.products.update({
        where: { productId },
        data:  { isActive: false },
      }),
    ]);

    res.json({ message: "Produk berhasil dihapus" });
  } catch (error) {
    console.error("deleteProduct error:", error);
    res.status(500).json({ message: "Error deleting product" });
  }
};

// ─── POST /products/:productId/variants ──────────────────────────
export const addVariant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params as { productId: string };
    const body = req.body as Partial<VariantInput>;

    const product = await prisma.products.findUnique({
      where:   { productId },
      include: { Variants: { where: { isActive: true } } },
    });
    if (!product || !product.isActive) {
      res.status(404).json({ message: "Produk tidak ditemukan" });
      return;
    }

    const err = validateVariant(body);
    if (err) {
      res.status(400).json({ message: err });
      return;
    }

    // Produk lama yang masih punya stok tanpa varian tidak boleh langsung ditambah varian,
    // karena stok produk akan dihitung ulang dari stok varian.
    if (
      product.Variants.length === 0 &&
      (product.stockGudang > 0 || product.stockToko > 0)
    ) {
      res.status(400).json({
        message:
          "Produk ini masih memiliki stok tanpa varian. Kosongkan stok lebih dulu sebelum menambah varian.",
      });
      return;
    }

    const vGudang       = body.stockGudang ?? 0;
    const vToko         = body.stockToko   ?? 0;
    const currentUserId = req.session.userId ?? "";
    const variantName   = body.name!.trim();

    const variant = await prisma.$transaction(async (tx) => {
      const created = await tx.productVariant.create({
        data: {
          variantId:   uuidv4(),
          productId,
          name:        variantName,
          type:        body.type?.trim()  || DEFAULT_VARIANT_TYPE,
          value:       body.value?.trim() || DEFAULT_VARIANT_VALUE,
          imageUrl:    body.imageUrl      || null,
          price:       body.price!,
          stockGudang: vGudang,
          stockToko:   vToko,
        },
      });

      const before = { gudang: product.stockGudang, toko: product.stockToko };
      const after  = await syncProductAggregates(tx, productId);

      const movements: MovementInput[] = [];
      if (vGudang > 0) {
        movements.push({
          productId,
          userId:      currentUserId,
          location:    "gudang",
          type:        "restock_gudang",
          quantity:    vGudang,
          stockBefore: before.gudang,
          stockAfter:  after.stockGudang,
          notes:       `Stok awal varian ${variantName}`,
        });
      }
      if (vToko > 0) {
        movements.push({
          productId,
          userId:      currentUserId,
          location:    "toko",
          type:        "adjustment",
          quantity:    vToko,
          stockBefore: before.toko,
          stockAfter:  after.stockToko,
          notes:       `Stok awal toko varian ${variantName}`,
        });
      }
      if (movements.length > 0) {
        await tx.stockMovement.createMany({ data: movements });
      }

      return created;
    });

    res.status(201).json(variant);
  } catch (error) {
    console.error("addVariant error:", error);
    res.status(500).json({ message: "Error adding variant" });
  }
};

// ─── PUT /products/:productId/variants/:variantId ────────────────
// Stok varian tidak diubah di sini; perubahan stok lewat mutasi stok.
export const updateVariant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, variantId } = req.params as { productId: string; variantId: string };
    const body = req.body as Partial<VariantInput>;

    const existing = await prisma.productVariant.findFirst({
      where: { variantId, productId, isActive: true },
    });
    if (!existing) {
      res.status(404).json({ message: "Varian tidak ditemukan" });
      return;
    }

    // Gabungkan data lama + baru lalu validasi hasil akhirnya
    const merged: Partial<VariantInput> = {
      name:  body.name  ?? existing.name,
      price: body.price !== undefined ? body.price : existing.price ?? undefined,
    };
    const err = validateVariant(merged);
    if (err) {
      res.status(400).json({ message: err });
      return;
    }

    const variant = await prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({
        where: { variantId },
        data: {
          name:     merged.name!.trim(),
          type:     body.type !== undefined  ? (body.type.trim()  || DEFAULT_VARIANT_TYPE)  : existing.type,
          value:    body.value !== undefined ? (body.value.trim() || DEFAULT_VARIANT_VALUE) : existing.value,
          imageUrl: body.imageUrl !== undefined ? (body.imageUrl || null) : existing.imageUrl,
          price:    merged.price!,
        },
      });
      // Harga varian berubah → harga produk (harga terendah) dihitung ulang
      await syncProductAggregates(tx, productId);
      return updated;
    });

    res.json(variant);
  } catch (error) {
    console.error("updateVariant error:", error);
    res.status(500).json({ message: "Error updating variant" });
  }
};

// ─── DELETE /products/:productId/variants/:variantId ─────────────
// Soft delete: varian dinonaktifkan, lalu stok & harga produk dihitung ulang.
export const deleteVariant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, variantId } = req.params as { productId: string; variantId: string };

    const existing = await prisma.productVariant.findFirst({
      where: { variantId, productId, isActive: true },
    });
    if (!existing) {
      res.status(404).json({ message: "Varian tidak ditemukan" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { variantId },
        data:  { isActive: false },
      });

      // Jika masih ada varian aktif, stok & harga produk dihitung ulang.
      // Jika varian terakhir dihapus, stok produk menjadi 0 (tidak ada lagi sumber stok).
      const remaining = await tx.productVariant.count({
        where: { productId, isActive: true },
      });
      if (remaining > 0) {
        await syncProductAggregates(tx, productId);
      } else {
        await tx.products.update({
          where: { productId },
          data:  { stockGudang: 0, stockToko: 0 },
        });
      }
    });

    res.json({ message: "Varian berhasil dihapus" });
  } catch (error) {
    console.error("deleteVariant error:", error);
    res.status(500).json({ message: "Error deleting variant" });
  }
};

// ─── PATCH /products/:productId/rating ───────────────────────────
export const addRating = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params as { productId: string };
    const { rating } = req.body as { rating: number };

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ message: "Rating harus antara 1-5" });
      return;
    }

    const existing = await prisma.products.findUnique({ where: { productId } });
    if (!existing) {
      res.status(404).json({ message: "Produk tidak ditemukan" });
      return;
    }

    const oldRating = existing.rating      ?? 0;
    const oldCount  = existing.ratingCount ?? 0;
    const newCount  = oldCount + 1;
    const newRating = ((oldRating * oldCount) + rating) / newCount;

    const product = await prisma.products.update({
      where: { productId },
      data: {
        rating:      Math.round(newRating * 100) / 100,
        ratingCount: newCount,
      },
    });

    res.json(product);
  } catch (error) {
    console.error("addRating error:", error);
    res.status(500).json({ message: "Error adding rating" });
  }
};