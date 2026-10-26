import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// GET /inventory/gudang — stok semua produk di gudang
export const getStockGudang = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const search = req.query.search?.toString();

    const products = await prisma.products.findMany({
      where: {
        isActive: true,
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      select: {
        productId:   true,
        name:        true,
        category:    true,
        price:       true,
        stockGudang: true,
        stockToko:   true,
        imageUrl:    true,
        Variants: {
          where:   { isActive: true },
          orderBy: { createdAt: "asc" },
          select: {
            variantId:   true,
            name:        true,
            type:        true,
            value:       true,
            imageUrl:    true,
            price:       true,
            stockGudang: true,
            stockToko:   true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json(products);
  } catch (error) {
    console.error("getStockGudang error:", error);
    res.status(500).json({ message: "Error retrieving stock gudang" });
  }
};

// GET /inventory/toko — stok semua produk di toko
export const getStockToko = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const search = req.query.search?.toString();

    const products = await prisma.products.findMany({
      where: {
        isActive: true,
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      select: {
        productId:  true,
        name:       true,
        category:   true,
        price:      true,
        stockToko:  true,
        imageUrl:   true,
        Variants: {
          where:   { isActive: true },
          orderBy: { createdAt: "asc" },
          select: {
            variantId: true,
            name:      true,
            type:      true,
            value:     true,
            imageUrl:  true,
            price:     true,
            stockToko: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json(products);
  } catch (error) {
    console.error("getStockToko error:", error);
    res.status(500).json({ message: "Error retrieving stock toko" });
  }
};

// GET /inventory/movements — riwayat pergerakan stok
export const getStockMovements = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const location  = req.query.location?.toString();  // "gudang" | "toko"
    const productId = req.query.productId?.toString();
    const limit     = Number(req.query.limit) || 100;

    const movements = await prisma.stockMovement.findMany({
      where: {
        ...(location  ? { location }  : {}),
        ...(productId ? { productId } : {}),
      },
      include: {
        product: {
          select: { name: true, category: true },
        },
        user: {
          select: { name: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take:    limit,
    });

    res.json(movements);
  } catch (error) {
    console.error("getStockMovements error:", error);
    res.status(500).json({ message: "Error retrieving stock movements" });
  }
};