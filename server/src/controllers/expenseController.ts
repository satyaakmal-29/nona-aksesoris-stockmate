import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { v4 as uuidv4 } from "uuid";
import {
  BusinessError,
  sendError,
  cleanText,
  requireImage,
  datePrefix,
  nextNumber,
} from "../lib/stockHelpers";
import { localDateRange, startOfLocalDay } from "../lib/dateHelpers";

// Pengeluaran = operasional (input manual Super Admin) + pembelian stok
// (otomatis dari Purchase Order supplier, berdasarkan tanggal nota).

export const EXPENSE_CATEGORIES = [
  "Gaji",
  "Sewa",
  "Listrik & Air",
  "Internet & Telepon",
  "Transportasi",
  "Perlengkapan",
  "Perawatan",
  "Lainnya",
] as const;

const PAYMENT_METHODS = ["cash", "transfer", "qris"];

const userSelect = { select: { name: true } } as const;

// Foto tidak ikut daftar (berat); diambil lewat GET /expenses/:id
const listSelect = {
  expenseId:     true,
  expenseNumber: true,
  category:      true,
  description:   true,
  amount:        true,
  expenseDate:   true,
  paymentMethod: true,
  notes:         true,
  createdAt:     true,
  updatedAt:     true,
  createdBy:     userSelect,
  updatedBy:     userSelect,
} as const;

// ── Validasi isi form (dipakai tambah & ubah) ────────────────────
const parseExpenseBody = (body: Record<string, unknown>) => {
  const category = cleanText(body.category);
  if (!EXPENSE_CATEGORIES.includes(category as (typeof EXPENSE_CATEGORIES)[number])) {
    throw new BusinessError("Kategori pengeluaran tidak valid");
  }

  const description = cleanText(body.description);
  if (!description) throw new BusinessError("Keterangan pengeluaran wajib diisi");
  if (description.length > 200) throw new BusinessError("Keterangan maksimal 200 karakter");

  const amount = body.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || !(amount > 0)) {
    throw new BusinessError("Jumlah pengeluaran harus lebih dari 0");
  }

  const expenseDate = startOfLocalDay(cleanText(body.expenseDate));
  if (!expenseDate) throw new BusinessError("Tanggal pengeluaran tidak valid");
  if (expenseDate.getTime() > Date.now()) {
    throw new BusinessError("Tanggal pengeluaran tidak boleh di masa depan");
  }

  const paymentMethod = cleanText(body.paymentMethod) || "cash";
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw new BusinessError("Metode pembayaran tidak valid");
  }

  // Foto opsional: null / "" = tanpa foto
  const receiptImage =
    body.receiptImage === null || body.receiptImage === undefined || body.receiptImage === ""
      ? null
      : requireImage(body.receiptImage, "Foto bukti");

  const notes = cleanText(body.notes) || null;

  return { category, description, amount, expenseDate, paymentMethod, receiptImage, notes };
};

// ─── GET /expenses?startDate=&endDate=&category= ─────────────────
export const getExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, category } = req.query as {
      startDate?: string;
      endDate?:   string;
      category?:  string;
    };

    const range = localDateRange(startDate, endDate);
    if (!range) throw new BusinessError("Format tanggal tidak valid (YYYY-MM-DD)");
    const hasRange = !!(range.gte || range.lte);

    const where: Prisma.OperationalExpenseWhereInput = {
      isActive: true,
      ...(hasRange ? { expenseDate: range } : {}),
      ...(category ? { category } : {}),
    };

    const [expenses, withReceipt, purchases] = await Promise.all([
      prisma.operationalExpense.findMany({
        where,
        select:  listSelect,
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      }),
      prisma.operationalExpense.findMany({
        where:  { ...where, receiptImage: { not: null } },
        select: { expenseId: true },
      }),
      // Pembelian stok hanya relevan jika filter kategori kosong / "Pembelian Stok"
      !category || category === "Pembelian Stok"
        ? prisma.purchaseOrder.findMany({
            where:   hasRange ? { invoiceDate: range } : {},
            select: {
              poId:          true,
              poNumber:      true,
              supplier:      true,
              invoiceNumber: true,
              invoiceDate:   true,
              invoiceTotal:  true,
              status:        true,
            },
            orderBy: { invoiceDate: "desc" },
          })
        : Promise.resolve([]),
    ]);

    // Filter kategori "Pembelian Stok" berarti tanpa pengeluaran operasional
    const operational = category === "Pembelian Stok" ? [] : expenses;
    const receiptIds = new Set(withReceipt.map((e) => e.expenseId));

    const byCategory: Record<string, number> = {};
    for (const e of operational) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;

    const totalOperational = operational.reduce((s, e) => s + e.amount, 0);
    const totalPurchases   = purchases.reduce((s, p) => s + p.invoiceTotal, 0);

    res.json({
      expenses: operational.map((e) => ({ ...e, hasReceipt: receiptIds.has(e.expenseId) })),
      purchases,
      summary: {
        totalOperational,
        totalPurchases,
        total:            totalOperational + totalPurchases,
        countOperational: operational.length,
        countPurchases:   purchases.length,
        byCategory,
      },
    });
  } catch (error) {
    sendError(res, error, "Error retrieving expenses");
  }
};

// ─── GET /expenses/:expenseId (termasuk foto) ────────────────────
export const getExpenseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { expenseId } = req.params as { expenseId: string };
    const expense = await prisma.operationalExpense.findFirst({
      where:   { expenseId, isActive: true },
      include: { createdBy: userSelect, updatedBy: userSelect },
    });
    if (!expense) {
      res.status(404).json({ message: "Pengeluaran tidak ditemukan" });
      return;
    }
    res.json(expense);
  } catch (error) {
    sendError(res, error, "Error retrieving expense");
  }
};

// ─── POST /expenses ──────────────────────────────────────────────
export const createExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const data = parseExpenseBody(req.body ?? {});

    const expenseId = uuidv4();
    const prefix = datePrefix("EXP");
    let created = null;

    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const last = await tx.operationalExpense.findFirst({
            where:   { expenseNumber: { startsWith: prefix } },
            orderBy: { expenseNumber: "desc" },
          });
          return tx.operationalExpense.create({
            data: {
              expenseId,
              expenseNumber: nextNumber(prefix, last?.expenseNumber),
              ...data,
              createdById: userId,
            },
            select: listSelect,
          });
        });
      } catch (e) {
        const isDuplicate =
          e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
        if (!isDuplicate || attempt === 2) throw e;
      }
    }

    res.status(201).json(created);
  } catch (error) {
    sendError(res, error, "Error creating expense");
  }
};

// ─── PUT /expenses/:expenseId ────────────────────────────────────
// receiptImage: string = ganti foto, null = hapus foto, tidak dikirim = tetap
export const updateExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const { expenseId } = req.params as { expenseId: string };
    const body = req.body ?? {};

    const existing = await prisma.operationalExpense.findFirst({
      where: { expenseId, isActive: true },
    });
    if (!existing) {
      res.status(404).json({ message: "Pengeluaran tidak ditemukan" });
      return;
    }

    const keepReceipt = !("receiptImage" in body);
    const data = parseExpenseBody(keepReceipt ? { ...body, receiptImage: null } : body);

    const updated = await prisma.operationalExpense.update({
      where: { expenseId },
      data: {
        category:      data.category,
        description:   data.description,
        amount:        data.amount,
        expenseDate:   data.expenseDate,
        paymentMethod: data.paymentMethod,
        notes:         data.notes,
        ...(keepReceipt ? {} : { receiptImage: data.receiptImage }),
        updatedById:   userId,
      },
      select: listSelect,
    });

    res.json(updated);
  } catch (error) {
    sendError(res, error, "Error updating expense");
  }
};

// ─── DELETE /expenses/:expenseId (soft delete) ───────────────────
export const deleteExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const { expenseId } = req.params as { expenseId: string };

    const existing = await prisma.operationalExpense.findFirst({
      where: { expenseId, isActive: true },
    });
    if (!existing) {
      res.status(404).json({ message: "Pengeluaran tidak ditemukan" });
      return;
    }

    await prisma.operationalExpense.update({
      where: { expenseId },
      data:  { isActive: false, updatedById: userId },
    });

    res.json({ message: `Pengeluaran ${existing.expenseNumber} dihapus` });
  } catch (error) {
    sendError(res, error, "Error deleting expense");
  }
};
