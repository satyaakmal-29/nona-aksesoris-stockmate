import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { sendError, LOW_STOCK_GUDANG, LOW_STOCK_TOKO } from "../lib/stockHelpers";
import { startOfDay, startOfMonth, toLocalISODate } from "../lib/dateHelpers";

// GET /dashboard — ringkasan dari data nyata (transaksi, PO, SR, stok, pengeluaran).
// Isi disesuaikan peran: data pengeluaran & arus kas hanya untuk Super Admin.

const percentChange = (current: number, previous: number): number | null =>
  previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;

export const getDashboardMetrics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const role = req.session.role ?? "";
    const isSuper = role === "super_admin";

    const now            = new Date();
    const todayStart     = startOfDay(now);
    const weekStart      = startOfDay(now, -6); // 7 hari termasuk hari ini
    const monthStart     = startOfMonth(now);
    const lastMonthStart = startOfMonth(now, -1);

    // ── Penjualan (hanya transaksi lunas) ────────────────────────────────────────────────
    const [todayAgg, monthAgg, lastMonthAgg, weekTrx, monthItems, recent] = await Promise.all([
      prisma.transaction.aggregate({
        where: { status: "paid", createdAt: { gte: todayStart } },
        _sum: { totalAmount: true }, _count: true,
      }),
      prisma.transaction.aggregate({
        where: { status: "paid", createdAt: { gte: monthStart } },
        _sum: { totalAmount: true }, _count: true,
      }),
      prisma.transaction.aggregate({
        where: { status: "paid", createdAt: { gte: lastMonthStart, lt: monthStart } },
        _sum: { totalAmount: true }, _count: true,
      }),
      prisma.transaction.findMany({
        where:  { status: "paid", createdAt: { gte: weekStart } },
        select: { createdAt: true, totalAmount: true },
      }),
      prisma.transactionItem.findMany({
        where:  { transaction: { status: "paid", createdAt: { gte: monthStart } } },
        select: { productName: true, variantName: true, qty: true, subtotal: true },
      }),
      prisma.transaction.findMany({
        where:   { status: "paid" },
        orderBy: { createdAt: "desc" },
        take:    5,
        select: {
          transactionId: true, transactionNumber: true, createdAt: true,
          totalAmount: true, paymentMethod: true,
          cashier: { select: { name: true } },
        },
      }),
    ]);

    // 7 hari terakhir per tanggal lokal (hari tanpa transaksi = 0)
    const daily = Array.from({ length: 7 }, (_, i) => ({
      date: toLocalISODate(startOfDay(now, i - 6)), total: 0, count: 0,
    }));
    for (const t of weekTrx) {
      const day = daily.find((d) => d.date === toLocalISODate(t.createdAt));
      if (day) { day.total += t.totalAmount; day.count += 1; }
    }

    // Produk terlaris bulan ini (per produk + varian)
    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const it of monthItems) {
      const name = it.variantName ? `${it.productName} - ${it.variantName}` : it.productName;
      const cur = productMap.get(name) ?? { name, qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.subtotal;
      productMap.set(name, cur);
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const monthSales     = monthAgg._sum.totalAmount ?? 0;
    const lastMonthSales = lastMonthAgg._sum.totalAmount ?? 0;

    // ── Stok ─────────────────────────────────────────────────────
    const products = await prisma.products.findMany({
      where:   { isActive: true },
      include: { Variants: { where: { isActive: true } } },
      orderBy: { name: "asc" },
    });

    const valueGudang = products.reduce((sum, p) => {
      if (p.Variants.length === 0) return sum + p.price * p.stockGudang;
      return sum + p.Variants.reduce((vs, v) => vs + (v.price ?? p.price) * v.stockGudang, 0);
    }, 0);

    const lowGudang = products.filter((p) => p.stockGudang < LOW_STOCK_GUDANG);
    const lowToko   = products.filter((p) => p.stockToko > 0 && p.stockToko < LOW_STOCK_TOKO);
    const outToko   = products.filter((p) => p.stockToko <= 0);
    const brief = (list: typeof products, field: "stockGudang" | "stockToko") =>
      list.slice(0, 8).map((p) => ({ productId: p.productId, name: p.name, stock: p[field] }));

    // ── Purchase Order & Store Replenishment ─────────────────────
    const pendingQris = await prisma.transaction.count({ where: { status: "pending_payment" } });

    const [poPending, poMonth, srGroups] = await Promise.all([
      prisma.purchaseOrder.count({ where: { status: "pending" } }),
      prisma.purchaseOrder.aggregate({
        where: { invoiceDate: { gte: monthStart } },
        _sum: { invoiceTotal: true },
      }),
      prisma.storeReplenishment.groupBy({ by: ["status"], _count: true }),
    ]);
    const srCount = (status: string) =>
      srGroups.find((g) => g.status === status)?._count ?? 0;

    // ── Pengeluaran & arus kas (Super Admin) ─────────────────────
    let expenses = null;
    if (isSuper) {
      const [opMonth, opLastMonth, poLastMonth, opByCategory] = await Promise.all([
        prisma.operationalExpense.aggregate({
          where: { isActive: true, expenseDate: { gte: monthStart } },
          _sum: { amount: true },
        }),
        prisma.operationalExpense.aggregate({
          where: { isActive: true, expenseDate: { gte: lastMonthStart, lt: monthStart } },
          _sum: { amount: true },
        }),
        prisma.purchaseOrder.aggregate({
          where: { invoiceDate: { gte: lastMonthStart, lt: monthStart } },
          _sum: { invoiceTotal: true },
        }),
        prisma.operationalExpense.groupBy({
          by:    ["category"],
          where: { isActive: true, expenseDate: { gte: monthStart } },
          _sum:  { amount: true },
        }),
      ]);

      const monthOperational = opMonth._sum.amount ?? 0;
      const monthPurchases   = poMonth._sum.invoiceTotal ?? 0;
      const monthTotal       = monthOperational + monthPurchases;
      const lastMonthTotal   = (opLastMonth._sum.amount ?? 0) + (poLastMonth._sum.invoiceTotal ?? 0);

      expenses = {
        monthOperational,
        monthPurchases,
        monthTotal,
        lastMonthTotal,
        changePercent: percentChange(monthTotal, lastMonthTotal),
        byCategory: opByCategory
          .map((c) => ({ category: c.category, amount: c._sum.amount ?? 0 }))
          .sort((a, b) => b.amount - a.amount),
        cashFlowMonth: monthSales - monthTotal,
      };
    }

    res.json({
      role,
      generatedAt: now.toISOString(),
      sales: {
        todayAmount:     todayAgg._sum.totalAmount ?? 0,
        todayCount:      todayAgg._count,
        monthAmount:     monthSales,
        monthCount:      monthAgg._count,
        lastMonthAmount: lastMonthSales,
        changePercent:   percentChange(monthSales, lastMonthSales),
        daily,
      },
      topProducts,
      pendingQris,
      recentTransactions: recent.map((t) => ({
        transactionId:     t.transactionId,
        transactionNumber: t.transactionNumber,
        createdAt:         t.createdAt.toISOString(),
        totalAmount:       t.totalAmount,
        paymentMethod:     t.paymentMethod,
        cashierName:       t.cashier?.name ?? "-",
      })),
      stock: {
        totalProducts:    products.length,
        totalUnitsGudang: products.reduce((s, p) => s + p.stockGudang, 0),
        totalUnitsToko:   products.reduce((s, p) => s + p.stockToko, 0),
        valueGudang,
        lowGudangCount:   lowGudang.length,
        lowTokoCount:     lowToko.length,
        outTokoCount:     outToko.length,
        lowGudangItems:   brief(lowGudang, "stockGudang"),
        lowTokoItems:     brief(lowToko, "stockToko"),
        outTokoItems:     brief(outToko, "stockToko"),
      },
      purchaseOrders: {
        pending:    poPending,
        monthTotal: isSuper ? poMonth._sum.invoiceTotal ?? 0 : null,
      },
      replenishments: {
        pending:   srCount("pending"),
        approved:  srCount("approved"),
        shipped:   srCount("shipped"),
        completedMonth: await prisma.storeReplenishment.count({
          where: { status: "completed", receivedAt: { gte: monthStart } },
        }),
      },
      expenses,
    });
  } catch (error) {
    sendError(res, error, "Error retrieving dashboard metrics");
  }
};
