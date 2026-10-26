import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { LOW_STOCK_GUDANG, LOW_STOCK_TOKO } from "../lib/stockHelpers";
import { localDateRange } from "../lib/dateHelpers";

// GET /reports/sales?startDate=&endDate=
export const getSalesReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?:   string;
    };

    const range = localDateRange(startDate, endDate);
    if (!range) {
      res.status(400).json({ message: "Format tanggal tidak valid (YYYY-MM-DD)" });
      return;
    }

    // Hanya transaksi lunas (QRIS menunggu / dibatalkan tidak dihitung)
    const dateFilter = { status: "paid", ...(range.gte || range.lte ? { createdAt: range } : {}) };

    const transactions = await prisma.transaction.findMany({
      where: dateFilter,
      include: {
        cashier: { select: { name: true } },
        Items: {
          include: {
            product: { select: { name: true, category: true } },
            variant: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Hitung summary
    const totalRevenue    = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalTransaksi  = transactions.length;
    const totalItemTerjual = transactions.reduce(
      (sum, t) => sum + t.Items.reduce((s, i) => s + i.qty, 0), 0
    );

    // Breakdown per metode pembayaran
    const paymentBreakdown = transactions.reduce(
      (acc, t) => {
        acc[t.paymentMethod] = (acc[t.paymentMethod] ?? 0) + t.totalAmount;
        return acc;
      },
      {} as Record<string, number>
    );

    // Produk terlaris
    const productSales = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const t of transactions) {
      for (const item of t.Items) {
        const key  = item.productId;
        const prev = productSales.get(key) ?? { name: item.productName, qty: 0, revenue: 0 };
        productSales.set(key, {
          name:    item.productName,
          qty:     prev.qty     + item.qty,
          revenue: prev.revenue + item.subtotal,
        });
      }
    }

    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    res.json({
      summary: {
        totalRevenue,
        totalTransaksi,
        totalItemTerjual,
        paymentBreakdown,
      },
      topProducts,
      transactions,
    });
  } catch (error) {
    console.error("getSalesReport error:", error);
    res.status(500).json({ message: "Error generating sales report" });
  }
};

// GET /reports/stock
export const getStockReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const products = await prisma.products.findMany({
      where:   { isActive: true },
      include: { Variants: { where: { isActive: true } } },
      orderBy: { name: "asc" },
    });

    // Toko: "menipis" dan "habis" dipisah agar tidak terhitung dua kali
    const lowStockGudang = products.filter((p) => p.stockGudang < LOW_STOCK_GUDANG);
    const lowStockToko   = products.filter((p) => p.stockToko > 0 && p.stockToko < LOW_STOCK_TOKO);
    const outOfStockToko = products.filter((p) => p.stockToko <= 0);

    res.json({
      products,
      summary: {
        totalProduk:      products.length,
        lowStockGudang:   lowStockGudang.length,
        lowStockToko:     lowStockToko.length,
        outOfStockToko:   outOfStockToko.length,
      },
      alerts: {
        lowStockGudang,
        lowStockToko,
        outOfStockToko,
      },
    });
  } catch (error) {
    console.error("getStockReport error:", error);
    res.status(500).json({ message: "Error generating stock report" });
  }
};