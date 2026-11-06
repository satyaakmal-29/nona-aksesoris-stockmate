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
import {
  EMAIL_NOT_READY,
  getMailAccount,
  getStoreSettingsRow,
  isBankConfigured,
} from "./storeSettingsController";
import { CASH_OVERPAY_MAX, TRX_QTY_MAX, formatLimit, optionalEmail, optionalText } from "../lib/validation";
import { mailErrorMessage, sendMail } from "../lib/mailer";
import { buildReceiptEmail } from "../lib/receiptEmail";

// Transaksi penjualan toko (hanya Admin Toko yang membuat).
// - Harga diambil dari katalog (harga varian / produk), bukan dari klien.
// - Tunai / transfer: langsung lunas, stok toko dikurangi saat itu juga.
//   Transfer wajib ada rekening toko di Pengaturan (kasir mengecek bukti transfer dulu).
// - QRIS: dibuat "pending_payment" dengan QRIS dinamis (nominal terisi) dari QRIS toko.
//   Stok baru dikurangi saat kasir mengonfirmasi pembayaran diterima.
// Stok selalu dikurangi secara atomik: gagal jika stok tidak cukup.
// - Nota email: begitu lunas, nota dikirim di latar belakang ke email toko (+ email pembeli
//   jika diisi). Transaksi tidak pernah gagal / menunggu karena email.

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

// Status "sending" lebih lama dari ini dianggap macet → boleh kirim ulang
const EMAIL_SENDING_STALE_MS = 60_000;

// Dipanggil saat server menyala: pengiriman yang terputus karena server berhenti
// ditandai gagal agar kasir bisa mengirim ulang (tidak tertahan di "sending").
export const resetInterruptedReceiptEmails = async (): Promise<void> => {
  try {
    const { count } = await prisma.transaction.updateMany({
      where: { receiptEmailStatus: "sending" },
      data:  {
        receiptEmailStatus: "failed",
        receiptEmailError:  "Pengiriman terputus karena server dimulai ulang. Kirim ulang nota.",
      },
    });
    if (count > 0) console.log(`Nota email terputus ditandai gagal: ${count}`);
  } catch (err) {
    console.error("Gagal memeriksa nota email yang terputus:", err);
  }
};

// Kirim nota email & catat hasilnya di transaksi. Tidak pernah melempar error.
// auto = pengiriman otomatis saat lunas: ke pembeli (jika ada) + salinan ke toko.
// Manual (kirim ulang): ke pembeli; salinan toko hanya jika toko belum pernah menerimanya.
const deliverReceiptEmail = async (
  transactionId: string,
  auto: boolean
): Promise<{ ok: boolean; message: string }> => {
  try {
    const trx = await prisma.transaction.findUnique({
      where:   { transactionId },
      include: { cashier: { select: { name: true } }, Items: true },
    });
    if (!trx || trx.status !== "paid") {
      return { ok: false, message: "Nota hanya bisa dikirim untuk transaksi yang sudah lunas" };
    }

    const settings = await getStoreSettingsRow();
    const account = getMailAccount(settings);
    if (!account) {
      await prisma.transaction.update({
        where: { transactionId },
        data:  { receiptEmailStatus: "failed", receiptEmailError: EMAIL_NOT_READY, receiptEmailAt: new Date() },
      });
      return { ok: false, message: EMAIL_NOT_READY };
    }

    const delivered = (trx.receiptEmailTo ?? "").split(", ").filter(Boolean);
    const buyer = trx.customerEmail && trx.customerEmail !== account.user ? trx.customerEmail : null;
    const withStore = auto || !buyer || !delivered.includes(account.user);
    const to = buyer ?? account.user;
    const bcc = buyer && withStore ? account.user : undefined;

    await prisma.transaction.update({
      where: { transactionId },
      data:  { receiptEmailStatus: "sending", receiptEmailError: null, receiptEmailAt: new Date() },
    });

    try {
      await sendMail(account, { to, bcc, ...buildReceiptEmail(trx, settings) });
    } catch (err) {
      const message = mailErrorMessage(err);
      console.error(`Nota email ${trx.transactionNumber} gagal:`, err);
      await prisma.transaction.update({
        where: { transactionId },
        data:  { receiptEmailStatus: "failed", receiptEmailError: message },
      });
      return { ok: false, message };
    }

    // receiptEmailTo = semua alamat yang sudah berhasil menerima nota ini
    const recipients = [to, ...(bcc ? [bcc] : [])];
    await prisma.transaction.update({
      where: { transactionId },
      data:  {
        receiptEmailStatus: "sent",
        receiptEmailError:  null,
        receiptEmailTo:     [...new Set([...delivered, ...recipients])].join(", "),
      },
    });
    return { ok: true, message: `Nota terkirim ke ${recipients.join(" & ")}` };
  } catch (err) {
    console.error("Gagal memproses nota email:", err);
    return { ok: false, message: "Gagal memproses nota email" };
  }
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
    const qtyError = `Jumlah per item harus bilangan bulat 1 – ${formatLimit(TRX_QTY_MAX)}`;
    for (const it of rawItems) {
      if (!it.productId) throw new BusinessError("Setiap item wajib memilih produk");
      if (!isPositiveInt(it.qty) || it.qty > TRX_QTY_MAX) throw new BusinessError(qtyError);
      const variantId = it.variantId || null;
      const key = `${it.productId}:${variantId ?? "-"}`;
      const cur = merged.get(key);
      if (cur) cur.qty += it.qty;
      else merged.set(key, { productId: it.productId, variantId, qty: it.qty });
    }
    // Baris dengan varian sama dijumlahkan → batas berlaku untuk totalnya
    if ([...merged.values()].some((m) => m.qty > TRX_QTY_MAX)) throw new BusinessError(qtyError);

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
      // Cegah salah ketik nol berlebih (kembalian tidak wajar)
      if (paymentAmount > totalAmount + CASH_OVERPAY_MAX) {
        throw new BusinessError(
          `Uang dibayar terlalu besar. Maksimal ${formatRupiah(totalAmount + CASH_OVERPAY_MAX)} (total + ${formatRupiah(CASH_OVERPAY_MAX)}). Periksa kembali nominalnya.`
        );
      }
    }
    const changeAmount = paymentAmount - totalAmount;
    const settings = await getStoreSettingsRow();

    // ── Transfer: kasir sudah mengecek bukti transfer ke rekening toko → langsung lunas.
    // Ditolak jika rekening tujuan belum diatur (pembeli tidak tahu harus transfer ke mana).
    // Rekening saat ini disalin ke transaksi agar audit tetap benar walau rekening diganti.
    let transferAccount: {
      transferBankName: string; transferAccountNumber: string; transferAccountName: string;
    } | null = null;
    if (paymentMethod === "transfer") {
      if (!isBankConfigured(settings)) {
        throw new BusinessError(
          "Rekening transfer toko belum diatur. Minta Super Admin mengisi rekening di menu Pengaturan."
        );
      }
      transferAccount = {
        transferBankName:      settings.bankName!,
        transferAccountNumber: settings.bankAccountNumber!,
        transferAccountName:   settings.bankAccountName!,
      };
    }

    // ── QRIS: siapkan QRIS dinamis dari QRIS toko ─────────────────
    const isQris = paymentMethod === "qris";
    let qrisPayload: string | null = null;
    if (isQris) {
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

    const customerName = optionalText(body.customerName, "Nama pelanggan", 50);
    const notes        = optionalText(body.notes, "Catatan", 200);

    // ── Nota email: salinan ke toko selalu (jika email toko diatur); ke pembeli jika diisi
    const emailReady    = !!getMailAccount(settings);
    const customerEmail = optionalEmail(body.customerEmail);
    if (customerEmail && !emailReady) {
      throw new BusinessError(
        "Nota digital belum bisa dikirim karena email toko belum diatur. Kosongkan email pembeli atau minta Super Admin mengatur email di Pengaturan."
      );
    }
    // Tunai / transfer langsung lunas → nota langsung dikirim; QRIS saat pembayaran dikonfirmasi
    const sendNow = emailReady && !isQris;

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
              ...transferAccount,
              customerEmail,
              receiptEmailStatus: sendNow ? "sending" : null,
              receiptEmailAt:     sendNow ? now : null,
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

    // Nota email dikirim di latar belakang (respons tidak menunggu email)
    if (sendNow) void deliverReceiptEmail(transactionId, true);

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
    const sendNow = !!getMailAccount(await getStoreSettingsRow());
    const lowStock = await prisma.$transaction(async (tx) => {
      // Ubah status hanya jika masih menunggu (mencegah konfirmasi ganda)
      const updated = await tx.transaction.updateMany({
        where: { transactionId, status: "pending_payment" },
        data:  {
          status: "paid", paidAt: now, confirmedById: userId,
          receiptEmailStatus: sendNow ? "sending" : null,
          receiptEmailAt:     sendNow ? now : null,
        },
      });
      if (updated.count === 0) throw new BusinessError("Transaksi ini sudah diproses");

      return applySale(tx, {
        transactionId, transactionNumber: trx.transactionNumber, userId, lines, now,
      });
    });

    await notifyLowStock("toko", lowStock);

    // QRIS lunas → nota email dikirim di latar belakang
    if (sendNow) void deliverReceiptEmail(transactionId, true);

    const result = await prisma.transaction.findUnique({
      where:   { transactionId },
      include: listInclude,
    });
    res.json(result);
  } catch (error) {
    sendError(res, error, "Error confirming payment");
  }
};

// ─── POST /transactions/:transactionId/email-receipt ─────────────
// Kirim (ulang) nota digital. body.email: string = email pembeli baru/diganti
// ("" = tanpa email pembeli → nota dikirim ulang ke email toko); tidak dikirim = tetap.
export const emailReceipt = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { transactionId } = req.params as { transactionId: string };

    const trx = await prisma.transaction.findUnique({
      where:  { transactionId },
      select: { status: true, receiptEmailStatus: true, receiptEmailAt: true },
    });
    if (!trx) {
      res.status(404).json({ message: "Transaksi tidak ditemukan" });
      return;
    }
    if (trx.status !== "paid") {
      throw new BusinessError("Nota hanya bisa dikirim untuk transaksi yang sudah lunas");
    }
    if (!getMailAccount(await getStoreSettingsRow())) throw new BusinessError(EMAIL_NOT_READY);
    if (
      trx.receiptEmailStatus === "sending" && trx.receiptEmailAt &&
      Date.now() - trx.receiptEmailAt.getTime() < EMAIL_SENDING_STALE_MS
    ) {
      throw new BusinessError("Nota sedang dikirim. Tunggu sebentar lalu coba lagi.");
    }

    if (typeof req.body?.email === "string") {
      const customerEmail = optionalEmail(req.body.email);
      await prisma.transaction.update({ where: { transactionId }, data: { customerEmail } });
    }

    const result = await deliverReceiptEmail(transactionId, false);
    if (!result.ok) throw new BusinessError(result.message);

    const updated = await prisma.transaction.findUnique({
      where:   { transactionId },
      include: listInclude,
    });
    res.json(updated);
  } catch (error) {
    sendError(res, error, "Error sending receipt email");
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
    const reason = optionalText(req.body?.reason, "Alasan pembatalan", 200) || "Dibatalkan kasir";

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
