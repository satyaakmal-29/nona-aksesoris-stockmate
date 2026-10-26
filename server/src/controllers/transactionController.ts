import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { v4 as uuidv4 } from "uuid";
import {
  BusinessError,
  sendError,
  isPositiveInt,
  cleanText,
  datePrefix,
  nextNumber,
  syncProductAggregates,
} from "../lib/stockHelpers";
import { localDateRange, formatRupiah } from "../lib/dateHelpers";
import { buildDynamicQris } from "../lib/qris";
import { notifyLowStock } from "./notificationController";
import { getStoreSettingsRow } from "./storeSettingsController";

// Transaksi penjualan toko (hanya Admin Toko yang membuat).
// - Harga diambil dari katalog (harga varian / produk), bukan dari klien.
// - Tunai / transfer: langsung lunas, stok toko dikurangi saat itu juga.
// - QRIS: dibuat "pending_payment" dengan QRIS dinamis (nominal terisi) dari QRIS toko.
//   Stok baru dikurangi saat kasir mengonfirmasi pembayaran diterima.
// Stok selalu dikurangi secara atomik: gagal jika stok tidak cukup.

const PAYMENT_METHODS = ["cash", "transfer", "qris"] as const;
const STATUSES = ["paid", "pending_payment", "cancelled"];

const listInclude = {
  cashier:     { select: { name: true, username: true } },
  confirmedBy: { select: { name: true } },
  cancelledBy: { select: { name: true } },
  Items: {
    include: {
      product: { select: { name: true, imageUrl: true } },
      variant: { select: { name: true, value: true } },
    },
  },
} as const;

type SaleLine = {
  productId:   string;
  variantId:   string | null;
  productName: string;
  variantName: string | null;
  qty:         number;
  unitPrice:   number;
};

type StockChange = { label: string; before: number; after: number };

// Kurangi stok toko + catat mutasi untuk semua baris (di dalam transaksi DB).
// Melempar BusinessError jika stok tidak cukup sehingga seluruh transaksi DB dibatalkan.
const applySale = async (
  tx: Prisma.TransactionClient,
  args: { transactionId: string; transactionNumber: string; userId: string; lines: SaleLine[]; now: Date }
): Promise<StockChange[]> => {
  const changes: StockChange[] = [];
  const touchedProducts = new Set<string>();

  for (const l of args.lines) {
    const label = l.variantName ? `${l.productName} - ${l.variantName}` : l.productName;

    // Kurangi stok hanya jika masih cukup (aman dari transaksi bersamaan)
    let stockAfter: number;
    if (l.variantId) {
      const updated = await tx.productVariant.updateMany({
        where: { variantId: l.variantId, stockToko: { gte: l.qty } },
        data:  { stockToko: { decrement: l.qty } },
      });
      const current = await tx.productVariant.findUnique({
        where: { variantId: l.variantId }, select: { stockToko: true },
      });
      if (updated.count === 0) {
        throw new BusinessError(
          `Stok toko "${label}" tidak cukup. Tersedia ${current?.stockToko ?? 0}, diminta ${l.qty}.`
        );
      }
      stockAfter = current?.stockToko ?? 0;
      touchedProducts.add(l.productId);
    } else {
      const updated = await tx.products.updateMany({
        where: { productId: l.productId, stockToko: { gte: l.qty } },
        data:  { stockToko: { decrement: l.qty } },
      });
      const current = await tx.products.findUnique({
        where: { productId: l.productId }, select: { stockToko: true },
      });
      if (updated.count === 0) {
        throw new BusinessError(
          `Stok toko "${label}" tidak cukup. Tersedia ${current?.stockToko ?? 0}, diminta ${l.qty}.`
        );
      }
      stockAfter = current?.stockToko ?? 0;
    }

    const stockBefore = stockAfter + l.qty;
    changes.push({ label, before: stockBefore, after: stockAfter });

    await tx.stockMovement.create({
      data: {
        productId:     l.productId,
        variantId:     l.variantId,
        userId:        args.userId,
        location:      "toko",
        type:          "sale",
        quantity:      -l.qty,
        stockBefore,
        stockAfter,
        referenceId:   args.transactionId,
        referenceType: "TRANSACTION",
        notes:         `Terjual via ${args.transactionNumber}`,
        createdAt:     args.now,
      },
    });
  }

  // Stok produk = jumlah stok varian; hitung ulang setelah stok varian berkurang
  for (const productId of touchedProducts) {
    await syncProductAggregates(tx, productId);
  }
  return changes;
};

// ─── GET /transactions ────────────────────────────────────────────
// ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&paymentMethod=&search=&status=
export const getTransactions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { startDate, endDate, paymentMethod, search, status } = req.query as {
      startDate?:     string;
      endDate?:       string;
      paymentMethod?: string;
      search?:        string;
      status?:        string;
    };

    const range = localDateRange(startDate, endDate);
    if (!range) throw new BusinessError("Format tanggal tidak valid (YYYY-MM-DD)");
    if (status && !STATUSES.includes(status)) throw new BusinessError("Status tidak valid");

    const term = cleanText(search);

    const transactions = await prisma.transaction.findMany({
      where: {
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(status ? { status } : {}),
        ...(range.gte || range.lte ? { createdAt: range } : {}),
        ...(term
          ? {
              OR: [
                { transactionNumber: { contains: term, mode: "insensitive" } },
                { customerName:      { contains: term, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: listInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json(transactions);
  } catch (error) {
    sendError(res, error, "Error retrieving transactions");
  }
};

// ─── GET /transactions/:transactionId ────────────────────────────
export const getTransactionById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { transactionId } = req.params as { transactionId: string };

    const transaction = await prisma.transaction.findUnique({
      where:   { transactionId },
      include: listInclude,
    });

    if (!transaction) {
      res.status(404).json({ message: "Transaksi tidak ditemukan" });
      return;
    }

    res.json(transaction);
  } catch (error) {
    sendError(res, error, "Error retrieving transaction");
  }
};

// ─── POST /transactions ───────────────────────────────────────────
// Hanya admin_toko
export const createTransaction = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const cashierId = req.session.userId!;
    const body = req.body ?? {};

    // ── Validasi input dasar ──────────────────────────────────────
    const paymentMethod = cleanText(body.paymentMethod);
    if (!PAYMENT_METHODS.includes(paymentMethod as (typeof PAYMENT_METHODS)[number])) {
      throw new BusinessError("Metode pembayaran tidak valid (Tunai / Transfer / QRIS)");
    }

    const rawItems: Array<{ productId?: string; variantId?: string; qty?: number }> =
      Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) throw new BusinessError("Minimal 1 item harus diisi");

    // Gabungkan baris dengan produk/varian yang sama agar cek stok akurat
    const merged = new Map<string, { productId: string; variantId: string | null; qty: number }>();
    for (const it of rawItems) {
      if (!it.productId) throw new BusinessError("Setiap item wajib memilih produk");
      if (!isPositiveInt(it.qty)) throw new BusinessError("Jumlah minimal 1 dan harus bilangan bulat");
      const variantId = it.variantId || null;
      const key = `${it.productId}:${variantId ?? "-"}`;
      const cur = merged.get(key);
      if (cur) cur.qty += it.qty;
      else merged.set(key, { productId: it.productId, variantId, qty: it.qty });
    }

    // ── Validasi produk/varian & ambil harga katalog ──────────────
    const lines: SaleLine[] = [];
    for (const m of merged.values()) {
      const product = await prisma.products.findUnique({
        where:   { productId: m.productId },
        include: { Variants: { where: { isActive: true } } },
      });
      if (!product || !product.isActive) {
        throw new BusinessError("Produk tidak ditemukan atau sudah tidak aktif");
      }

      if (product.Variants.length > 0) {
        if (!m.variantId) throw new BusinessError(`Pilih varian untuk produk "${product.name}"`);
        const variant = product.Variants.find((v) => v.variantId === m.variantId);
        if (!variant) throw new BusinessError(`Varian tidak valid untuk produk "${product.name}"`);
        if (variant.stockToko < m.qty) {
          throw new BusinessError(
            `Stok toko "${product.name} - ${variant.name}" tidak cukup. Tersedia ${variant.stockToko}, diminta ${m.qty}.`
          );
        }
        const unitPrice = variant.price ?? product.price;
        if (!(unitPrice > 0)) throw new BusinessError(`Harga "${product.name} - ${variant.name}" belum diatur`);
        lines.push({
          productId: product.productId, variantId: variant.variantId,
          productName: product.name, variantName: variant.name,
          qty: m.qty, unitPrice,
        });
      } else {
        if (m.variantId) throw new BusinessError(`Produk "${product.name}" tidak memiliki varian`);
        if (product.stockToko < m.qty) {
          throw new BusinessError(
            `Stok toko "${product.name}" tidak cukup. Tersedia ${product.stockToko}, diminta ${m.qty}.`
          );
        }
        if (!(product.price > 0)) throw new BusinessError(`Harga "${product.name}" belum diatur`);
        lines.push({
          productId: product.productId, variantId: null,
          productName: product.name, variantName: null,
          qty: m.qty, unitPrice: product.price,
        });
      }
    }

    const totalAmount = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

    // ── Validasi pembayaran ───────────────────────────────────────
    // Transfer / QRIS selalu dibayar pas; tunai boleh lebih (ada kembalian)
    let paymentAmount = totalAmount;
    if (paymentMethod === "cash") {
      paymentAmount = Number(body.paymentAmount);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        throw new BusinessError("Jumlah uang dibayar wajib diisi");
      }
      if (paymentAmount < totalAmount) {
        throw new BusinessError(
          `Pembayaran kurang ${formatRupiah(totalAmount - paymentAmount)}. Total ${formatRupiah(totalAmount)}, dibayar ${formatRupiah(paymentAmount)}.`
        );
      }
    }
    const changeAmount = paymentAmount - totalAmount;

    // ── QRIS: siapkan QRIS dinamis dari QRIS toko ─────────────────
    const isQris = paymentMethod === "qris";
    let qrisPayload: string | null = null;
    if (isQris) {
      const settings = await getStoreSettingsRow();
      if (!settings.qrisPayload) {
        throw new BusinessError(
          "QRIS toko belum diatur. Minta Super Admin mengunggah QRIS toko di menu Pengaturan."
        );
      }
      if (!Number.isInteger(totalAmount)) {
        throw new BusinessError("Total belanja harus bilangan bulat Rupiah untuk pembayaran QRIS");
      }
      qrisPayload = buildDynamicQris(settings.qrisPayload, totalAmount);
    }

    const customerName = cleanText(body.customerName) || null;
    const notes        = cleanText(body.notes) || null;

    // ── Simpan: nomor dibuat di dalam transaksi DB; ulangi jika bentrok ──
    const transactionId = uuidv4();
    const prefix = datePrefix("TRX");
    let done = false;
    let lowStock: StockChange[] = [];

    for (let attempt = 0; attempt < 3 && !done; attempt++) {
      try {
        lowStock = await prisma.$transaction(async (tx) => {
          const last = await tx.transaction.findFirst({
            where:   { transactionNumber: { startsWith: prefix } },
            orderBy: { transactionNumber: "desc" },
          });
          const transactionNumber = nextNumber(prefix, last?.transactionNumber);
          const now = new Date();

          await tx.transaction.create({
            data: {
              transactionId,
              transactionNumber,
              cashierId,
              customerName,
              paymentMethod,
              paymentAmount,
              totalAmount,
              changeAmount,
              notes,
              status:        isQris ? "pending_payment" : "paid",
              paidAt:        isQris ? null : now,
              confirmedById: isQris ? null : cashierId,
              qrisPayload,
              createdAt:     now,
              Items: {
                create: lines.map((l) => ({
                  itemId:      uuidv4(),
                  productId:   l.productId,
                  variantId:   l.variantId,
                  productName: l.productName,
                  variantName: l.variantName,
                  qty:         l.qty,
                  unitPrice:   l.unitPrice,
                  subtotal:    l.unitPrice * l.qty,
                })),
              },
            },
          });

          // QRIS: stok baru dikurangi setelah pembayaran dikonfirmasi
          if (isQris) return [];
          return applySale(tx, { transactionId, transactionNumber, userId: cashierId, lines, now });
        });
        done = true;
      } catch (e) {
        const isDuplicate =
          e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
        if (!isDuplicate || attempt === 2) throw e;
      }
    }

    // Peringatan stok toko menipis / habis (setelah transaksi tersimpan)
    await notifyLowStock("toko", lowStock);

    const transaction = await prisma.transaction.findUnique({
      where:   { transactionId },
      include: listInclude,
    });

    res.status(201).json(transaction);
  } catch (error) {
    sendError(res, error, "Error creating transaction");
  }
};

// ─── POST /transactions/:transactionId/confirm-payment ───────────
// Admin Toko mengonfirmasi pembayaran QRIS sudah masuk → stok dikurangi.
export const confirmPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const { transactionId } = req.params as { transactionId: string };

    const trx = await prisma.transaction.findUnique({
      where:   { transactionId },
      include: { Items: true },
    });
    if (!trx) {
      res.status(404).json({ message: "Transaksi tidak ditemukan" });
      return;
    }
    if (trx.status !== "pending_payment") {
      throw new BusinessError(
        trx.status === "paid" ? "Transaksi ini sudah lunas" : "Transaksi ini sudah dibatalkan"
      );
    }

    const lines: SaleLine[] = trx.Items.map((it) => ({
      productId:   it.productId,
      variantId:   it.variantId,
      productName: it.productName,
      variantName: it.variantName,
      qty:         it.qty,
      unitPrice:   it.unitPrice,
    }));

    const now = new Date();
    const lowStock = await prisma.$transaction(async (tx) => {
      // Ubah status hanya jika masih menunggu (mencegah konfirmasi ganda)
      const updated = await tx.transaction.updateMany({
        where: { transactionId, status: "pending_payment" },
        data:  { status: "paid", paidAt: now, confirmedById: userId },
      });
      if (updated.count === 0) throw new BusinessError("Transaksi ini sudah diproses");

      return applySale(tx, {
        transactionId, transactionNumber: trx.transactionNumber, userId, lines, now,
      });
    });

    await notifyLowStock("toko", lowStock);

    const result = await prisma.transaction.findUnique({
      where:   { transactionId },
      include: listInclude,
    });
    res.json(result);
  } catch (error) {
    sendError(res, error, "Error confirming payment");
  }
};

// ─── POST /transactions/:transactionId/cancel ────────────────────
// Batalkan transaksi QRIS yang belum dibayar. Stok tidak berubah.
export const cancelTransaction = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const { transactionId } = req.params as { transactionId: string };
    const reason = cleanText(req.body?.reason) || "Dibatalkan kasir";

    const updated = await prisma.transaction.updateMany({
      where: { transactionId, status: "pending_payment" },
      data:  { status: "cancelled", cancelledAt: new Date(), cancelledById: userId, cancelReason: reason },
    });

    if (updated.count === 0) {
      const exists = await prisma.transaction.findUnique({ where: { transactionId }, select: { status: true } });
      if (!exists) {
        res.status(404).json({ message: "Transaksi tidak ditemukan" });
        return;
      }
      throw new BusinessError(
        exists.status === "paid"
          ? "Transaksi yang sudah lunas tidak dapat dibatalkan"
          : "Transaksi ini sudah dibatalkan"
      );
    }

    const result = await prisma.transaction.findUnique({
      where:   { transactionId },
      include: listInclude,
    });
    res.json(result);
  } catch (error) {
    sendError(res, error, "Error cancelling transaction");
  }
};
