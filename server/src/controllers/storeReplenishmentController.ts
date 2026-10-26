import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { notifyByRole, notifyLowStock } from "./notificationController";
import {
  BusinessError,
  sendError,
  isPositiveInt,
  isNonNegativeInt,
  cleanText,
  requireImage,
  datePrefix,
  nextNumber,
  syncProductAggregates,
} from "../lib/stockHelpers";

const REF_TYPE = "STORE_REPLENISHMENT";

// Admin Toko hanya melihat permintaan yang sudah dikirim / selesai
const TOKO_VISIBLE_STATUSES = ["shipped", "completed"];

// Field foto tidak ikut daftar (berat); foto hanya dikirim di endpoint detail
const LIST_OMIT = { deliveryNoteImage: true, receiveImage: true } as const;

const itemInclude = {
  product: { select: { name: true, imageUrl: true } },
  variant: {
    select: {
      name: true,
      value: true,
      imageUrl: true,
      price: true,
      stockGudang: true,
      stockToko: true,
    },
  },
} as const;

const userSelect = { select: { name: true, role: true } } as const;

const fullInclude = {
  createdBy: userSelect,
  approvedBy: userSelect,
  shippedBy: userSelect,
  receivedBy: userSelect,
  Items: { include: itemInclude },
} as const;

// ─── Stok gudang ──────────────────────────────────────────────────
const getGudangStock = async (
  tx: Prisma.TransactionClient,
  item: { productId: string; variantId: string | null }
): Promise<{ stock: number; label: string }> => {
  if (item.variantId) {
    const v = await tx.productVariant.findUnique({
      where: { variantId: item.variantId },
      include: { product: { select: { name: true } } },
    });
    if (!v) throw new BusinessError("Varian pada permintaan tidak ditemukan");
    return { stock: v.stockGudang, label: `${v.product.name} - ${v.name}` };
  }
  const p = await tx.products.findUnique({ where: { productId: item.productId } });
  if (!p) throw new BusinessError("Produk pada permintaan tidak ditemukan");
  return { stock: p.stockGudang, label: p.name };
};

// Total qty per produk/varian tidak boleh melebihi stok gudang
const assertGudangStockEnough = async (
  tx: Prisma.TransactionClient,
  items: Array<{ productId: string; variantId: string | null; qty: number }>
): Promise<void> => {
  const needed = new Map<
    string,
    { productId: string; variantId: string | null; qty: number }
  >();
  for (const it of items) {
    if (it.qty <= 0) continue;
    const key = it.variantId ?? `P:${it.productId}`;
    const cur = needed.get(key);
    if (cur) cur.qty += it.qty;
    else needed.set(key, { ...it });
  }

  for (const n of needed.values()) {
    const { stock, label } = await getGudangStock(tx, n);
    if (stock < n.qty) {
      throw new BusinessError(
        `Stok gudang tidak cukup untuk "${label}". Dibutuhkan ${n.qty}, tersedia ${stock}.`
      );
    }
  }
};

// ─── GET /store-replenishments ───────────────────────────────────
export const getStoreReplenishments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const status = req.query.status?.toString();
    const role = req.session.role;

    let where: Prisma.StoreReplenishmentWhereInput = {};
    if (role === "admin_toko") {
      if (status && !TOKO_VISIBLE_STATUSES.includes(status)) {
        res.json([]);
        return;
      }
      where = { status: status ? status : { in: TOKO_VISIBLE_STATUSES } };
    } else if (status) {
      where = { status };
    }

    const orders = await prisma.storeReplenishment.findMany({
      where,
      include: fullInclude,
      omit: LIST_OMIT,
      orderBy: { createdAt: "desc" },
    });

    res.json(orders);
  } catch (error) {
    sendError(res, error, "Error retrieving store replenishments");
  }
};

// ─── GET /store-replenishments/:srId ─────────────────────────────
// Detail lengkap termasuk foto bukti
export const getStoreReplenishmentById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { srId } = req.params as { srId: string };

    const order = await prisma.storeReplenishment.findUnique({
      where: { srId },
      include: fullInclude,
    });

    if (
      !order ||
      (req.session.role === "admin_toko" &&
        !TOKO_VISIBLE_STATUSES.includes(order.status))
    ) {
      res.status(404).json({ message: "Store Replenishment tidak ditemukan" });
      return;
    }

    res.json(order);
  } catch (error) {
    sendError(res, error, "Error retrieving store replenishment");
  }
};

// ─── POST /store-replenishments ──────────────────────────────────
// Hanya super_admin
export const createStoreReplenishment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const {
      notes,
      items,
    }: {
      notes?: string;
      items: Array<{
        productId: string;
        variantId?: string;
        qtyRequested: number;
        unitCost?: number;
      }>;
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new BusinessError("Item tidak boleh kosong");
    }

    // Validasi item & tentukan harga satuan (default: harga varian / produk)
    const prepared: Array<{
      productId: string;
      variantId: string | null;
      qtyRequested: number;
      unitCost: number;
    }> = [];

    for (const item of items) {
      if (!item.productId) throw new BusinessError("Setiap item wajib memilih produk");
      if (!isPositiveInt(item.qtyRequested)) {
        throw new BusinessError("Jumlah minimal 1 dan harus bilangan bulat");
      }

      const product = await prisma.products.findUnique({
        where: { productId: item.productId },
        include: { Variants: { where: { isActive: true } } },
      });
      if (!product || !product.isActive) {
        throw new BusinessError("Produk tidak ditemukan atau sudah tidak aktif");
      }

      let defaultPrice = product.price;
      if (product.Variants.length > 0) {
        if (!item.variantId) {
          throw new BusinessError(`Pilih varian untuk produk "${product.name}"`);
        }
        const variant = product.Variants.find((v) => v.variantId === item.variantId);
        if (!variant) {
          throw new BusinessError(`Varian tidak valid untuk produk "${product.name}"`);
        }
        defaultPrice = variant.price ?? product.price;
      } else if (item.variantId) {
        throw new BusinessError(`Produk "${product.name}" tidak memiliki varian`);
      }

      const unitCost =
        typeof item.unitCost === "number" && item.unitCost > 0
          ? item.unitCost
          : defaultPrice;
      if (!(unitCost > 0)) throw new BusinessError("Harga satuan harus lebih dari 0");

      prepared.push({
        productId: item.productId,
        variantId: item.variantId ?? null,
        qtyRequested: item.qtyRequested,
        unitCost,
      });
    }

    // Nomor dibuat di dalam transaksi; ulangi jika bentrok nomor (unique)
    const srId = uuidv4();
    let order = null;
    let srNumber = "";
    const prefix = datePrefix("SR");

    for (let attempt = 0; attempt < 3 && !order; attempt++) {
      try {
        order = await prisma.$transaction(async (tx) => {
          const last = await tx.storeReplenishment.findFirst({
            where: { srNumber: { startsWith: prefix } },
            orderBy: { srNumber: "desc" },
          });
          srNumber = nextNumber(prefix, last?.srNumber);

          return tx.storeReplenishment.create({
            data: {
              srId,
              srNumber,
              createdById: userId,
              notes: cleanText(notes) || null,
              Items: {
                create: prepared.map((p) => ({
                  srItemId: uuidv4(),
                  productId: p.productId,
                  variantId: p.variantId,
                  qtyRequested: p.qtyRequested,
                  unitCost: p.unitCost,
                  subtotal: p.unitCost * p.qtyRequested,
                })),
              },
            },
            include: fullInclude,
            omit: LIST_OMIT,
          });
        });
      } catch (e) {
        const isDuplicate =
          e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
        if (!isDuplicate || attempt === 2) throw e;
      }
    }

    await notifyByRole({
      role: "admin_gudang",
      title: "Store Replenishment Baru",
      message: `Permintaan ${srNumber} menunggu persetujuan Anda.`,
      type: "sr_created",
      referenceId: srId,
      referenceType: REF_TYPE,
    });

    res.status(201).json(order);
  } catch (error) {
    sendError(res, error, "Error creating store replenishment");
  }
};

// ─── PATCH /store-replenishments/:srId/approve ───────────────────
// Hanya admin_gudang. Stok gudang dicek sebelum disetujui.
export const approveStoreReplenishment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const { srId } = req.params as { srId: string };
    const { approvedItems }: {
      approvedItems?: Array<{ srItemId: string; qtyApproved: number }>;
    } = req.body ?? {};

    const order = await prisma.storeReplenishment.findUnique({
      where: { srId },
      include: { Items: true },
    });
    if (!order) {
      res.status(404).json({ message: "Store Replenishment tidak ditemukan" });
      return;
    }
    if (order.status !== "pending") {
      throw new BusinessError(
        `Tidak bisa disetujui, status saat ini: ${order.status}`
      );
    }

    const resolved = order.Items.map((item) => {
      const given = approvedItems?.find((a) => a.srItemId === item.srItemId);
      return { item, qty: given ? given.qtyApproved : item.qtyRequested };
    });

    for (const { item, qty } of resolved) {
      if (!isNonNegativeInt(qty) || qty > item.qtyRequested) {
        throw new BusinessError(
          "Jumlah disetujui harus bilangan bulat antara 0 dan jumlah yang diminta"
        );
      }
    }
    if (resolved.every((r) => r.qty === 0)) {
      throw new BusinessError(
        "Minimal 1 item harus disetujui. Jika menolak semua, gunakan Tolak."
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await assertGudangStockEnough(
        tx,
        resolved.map(({ item, qty }) => ({
          productId: item.productId,
          variantId: item.variantId,
          qty,
        }))
      );

      for (const { item, qty } of resolved) {
        await tx.storeReplenishmentItem.update({
          where: { srItemId: item.srItemId },
          data: { qtyApproved: qty },
        });
      }

      return tx.storeReplenishment.update({
        where: { srId },
        data: {
          status: "approved",
          approvedById: userId,
          approvedAt: new Date(),
        },
        omit: LIST_OMIT,
      });
    });

    await notifyByRole({
      role: "super_admin",
      title: "Store Replenishment Disetujui",
      message: `Permintaan ${order.srNumber} disetujui Admin Gudang dan siap dikirim.`,
      type: "sr_approved",
      referenceId: srId,
      referenceType: REF_TYPE,
    });

    res.json(updated);
  } catch (error) {
    sendError(res, error, "Error approving store replenishment");
  }
};

// ─── PATCH /store-replenishments/:srId/reject ────────────────────
// Hanya admin_gudang. Alasan wajib.
export const rejectStoreReplenishment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const { srId } = req.params as { srId: string };
    const reason = cleanText(req.body?.reason);

    if (!reason) throw new BusinessError("Alasan penolakan wajib diisi");

    const order = await prisma.storeReplenishment.findUnique({ where: { srId } });
    if (!order) {
      res.status(404).json({ message: "Store Replenishment tidak ditemukan" });
      return;
    }
    if (order.status !== "pending") {
      throw new BusinessError(`Tidak bisa ditolak, status saat ini: ${order.status}`);
    }

    const updated = await prisma.storeReplenishment.update({
      where: { srId },
      data: {
        status: "rejected",
        approvedById: userId,
        approvedAt: new Date(),
        rejectedReason: reason,
      },
      omit: LIST_OMIT,
    });

    await notifyByRole({
      role: "super_admin",
      title: "Store Replenishment Ditolak",
      message: `Permintaan ${order.srNumber} ditolak. Alasan: ${reason}.`,
      type: "sr_rejected",
      referenceId: srId,
      referenceType: REF_TYPE,
    });

    res.json(updated);
  } catch (error) {
    sendError(res, error, "Error rejecting store replenishment");
  }
};

// ─── PATCH /store-replenishments/:srId/ship ──────────────────────
// Admin gudang memvalidasi pengiriman dengan bukti surat jalan.
// Stok GUDANG berkurang sekarang; stok TOKO baru bertambah setelah toko mengonfirmasi.
export const shipStoreReplenishment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const { srId } = req.params as { srId: string };
    const body = req.body ?? {};

    // Bukti pengiriman (semua wajib kecuali catatan umum)
    const deliveryNoteNumber = cleanText(body.deliveryNoteNumber);
    const courierName = cleanText(body.courierName);
    if (!deliveryNoteNumber) throw new BusinessError("Nomor surat jalan wajib diisi");
    if (!courierName) throw new BusinessError("Nama pengantar wajib diisi");
    const deliveryNoteImage = requireImage(body.deliveryNoteImage, "Foto surat jalan");
    const shipNotes = cleanText(body.shipNotes) || null;

    const shippedItems: Array<{
      srItemId: string;
      qtyShipped: number;
      shipNote?: string;
    }> = Array.isArray(body.shippedItems) ? body.shippedItems : [];

    const order = await prisma.storeReplenishment.findUnique({
      where: { srId },
      include: { Items: true },
    });
    if (!order) {
      res.status(404).json({ message: "Store Replenishment tidak ditemukan" });
      return;
    }
    if (order.status !== "approved") {
      throw new BusinessError(
        `Belum disetujui atau sudah diproses, status saat ini: ${order.status}`
      );
    }

    // Qty kirim per item (default = qty disetujui)
    const resolved = order.Items.map((item) => {
      const approved = item.qtyApproved ?? 0;
      const given = shippedItems.find((s) => s.srItemId === item.srItemId);
      const qty = given ? given.qtyShipped : approved;
      const note = cleanText(given?.shipNote);
      return { item, approved, qty, note };
    });

    for (const { approved, qty, note } of resolved) {
      if (!isNonNegativeInt(qty) || qty > approved) {
        throw new BusinessError(
          "Jumlah kirim harus bilangan bulat dan tidak boleh melebihi jumlah disetujui"
        );
      }
      if (qty < approved && !note) {
        throw new BusinessError(
          "Isi alasan untuk item yang dikirim kurang dari jumlah disetujui"
        );
      }
    }
    if (resolved.every((r) => r.qty === 0)) {
      throw new BusinessError("Tidak ada item yang dikirim");
    }

    const now = new Date();
    const gudangChanges: Array<{ label: string; before: number; after: number }> = [];

    await prisma.$transaction(async (tx) => {
      // Cek ulang stok gudang tepat sebelum stok dikurangi
      await assertGudangStockEnough(
        tx,
        resolved.map(({ item, qty }) => ({
          productId: item.productId,
          variantId: item.variantId,
          qty,
        }))
      );

      const touchedProducts = new Set<string>();

      for (const { item, qty, note } of resolved) {
        await tx.storeReplenishmentItem.update({
          where: { srItemId: item.srItemId },
          data: { qtyShipped: qty, shipNote: note || null },
        });
        if (qty === 0) continue;

        if (item.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { variantId: item.variantId },
            include: { product: { select: { name: true } } },
          });
          if (!variant) throw new BusinessError("Varian pada permintaan tidak ditemukan");

          await tx.productVariant.update({
            where: { variantId: item.variantId },
            data: { stockGudang: { decrement: qty } },
          });
          gudangChanges.push({
            label:  `${variant.product.name} - ${variant.name}`,
            before: variant.stockGudang,
            after:  variant.stockGudang - qty,
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId,
              userId,
              location: "gudang",
              type: "sr_transfer",
              quantity: -qty,
              stockBefore: variant.stockGudang,
              stockAfter: variant.stockGudang - qty,
              referenceId: srId,
              referenceType: REF_TYPE,
              notes: `Dikirim ke toko via ${order.srNumber} (surat jalan ${deliveryNoteNumber})`,
              createdAt: now,
            },
          });

          touchedProducts.add(item.productId);
        } else {
          const product = await tx.products.findUnique({
            where: { productId: item.productId },
          });
          if (!product) throw new BusinessError("Produk pada permintaan tidak ditemukan");

          await tx.products.update({
            where: { productId: item.productId },
            data: { stockGudang: { decrement: qty } },
          });
          gudangChanges.push({
            label:  product.name,
            before: product.stockGudang,
            after:  product.stockGudang - qty,
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              userId,
              location: "gudang",
              type: "sr_transfer",
              quantity: -qty,
              stockBefore: product.stockGudang,
              stockAfter: product.stockGudang - qty,
              referenceId: srId,
              referenceType: REF_TYPE,
              notes: `Dikirim ke toko via ${order.srNumber} (surat jalan ${deliveryNoteNumber})`,
              createdAt: now,
            },
          });
        }
      }

      for (const productId of touchedProducts) {
        await syncProductAggregates(tx, productId);
      }

      await tx.storeReplenishment.update({
        where: { srId },
        data: {
          status: "shipped",
          shippedById: userId,
          shippedAt: now,
          deliveryNoteNumber,
          courierName,
          deliveryNoteImage,
          shipNotes,
        },
      });
    });

    // Peringatan stok gudang menipis / habis akibat pengiriman
    await notifyLowStock("gudang", gudangChanges);

    // Admin Toko diminta konfirmasi; Super Admin diberi tahu
    await notifyByRole({
      role: "admin_toko",
      title: "Barang Dalam Pengiriman",
      message: `Barang dari ${order.srNumber} sedang dikirim ke toko. Mohon konfirmasi saat barang diterima.`,
      type: "sr_shipped",
      referenceId: srId,
      referenceType: REF_TYPE,
    });
    await notifyByRole({
      role: "super_admin",
      title: "Barang Dikirim ke Toko",
      message: `Barang dari ${order.srNumber} dikirim oleh Admin Gudang (surat jalan ${deliveryNoteNumber}). Menunggu konfirmasi toko.`,
      type: "sr_shipped",
      referenceId: srId,
      referenceType: REF_TYPE,
    });

    const result = await prisma.storeReplenishment.findUnique({
      where: { srId },
      include: fullInclude,
      omit: LIST_OMIT,
    });
    res.json(result);
  } catch (error) {
    sendError(res, error, "Error shipping store replenishment");
  }
};

// ─── PATCH /store-replenishments/:srId/receive ───────────────────
// Admin toko mengonfirmasi penerimaan dengan foto bukti.
// Stok TOKO bertambah sesuai jumlah yang benar-benar diterima.
export const receiveStoreReplenishment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const { srId } = req.params as { srId: string };
    const body = req.body ?? {};

    const receiveImage = requireImage(body.receiveImage, "Foto bukti penerimaan");
    const receiveNotes = cleanText(body.receiveNotes) || null;

    const receivedItems: Array<{
      srItemId: string;
      qtyReceived: number;
      receiveNote?: string;
    }> = Array.isArray(body.receivedItems) ? body.receivedItems : [];

    const order = await prisma.storeReplenishment.findUnique({
      where: { srId },
      include: {
        Items: {
          include: {
            product: { select: { name: true } },
            variant: { select: { name: true } },
          },
        },
      },
    });
    if (!order) {
      res.status(404).json({ message: "Store Replenishment tidak ditemukan" });
      return;
    }
    if (order.status !== "shipped") {
      throw new BusinessError(
        `Belum dikirim atau sudah dikonfirmasi, status saat ini: ${order.status}`
      );
    }

    // Qty diterima per item (default = qty dikirim)
    const resolved = order.Items.map((item) => {
      const shipped = item.qtyShipped ?? 0;
      const given = receivedItems.find((r) => r.srItemId === item.srItemId);
      const qty = given ? given.qtyReceived : shipped;
      const note = cleanText(given?.receiveNote);
      return { item, shipped, qty, note };
    });

    for (const { shipped, qty, note } of resolved) {
      if (!isNonNegativeInt(qty) || qty > shipped) {
        throw new BusinessError(
          "Jumlah diterima harus bilangan bulat dan tidak boleh melebihi jumlah dikirim"
        );
      }
      if (qty < shipped && !note) {
        throw new BusinessError(
          "Isi alasan untuk item yang diterima kurang dari jumlah dikirim"
        );
      }
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const touchedProducts = new Set<string>();

      for (const { item, qty, note } of resolved) {
        await tx.storeReplenishmentItem.update({
          where: { srItemId: item.srItemId },
          data: { qtyReceived: qty, receiveNote: note || null },
        });
        if (qty === 0) continue;

        if (item.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { variantId: item.variantId },
          });
          if (!variant) throw new BusinessError("Varian pada permintaan tidak ditemukan");

          await tx.productVariant.update({
            where: { variantId: item.variantId },
            data: { stockToko: { increment: qty } },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId,
              userId,
              location: "toko",
              type: "sr_transfer",
              quantity: qty,
              stockBefore: variant.stockToko,
              stockAfter: variant.stockToko + qty,
              referenceId: srId,
              referenceType: REF_TYPE,
              notes: `Diterima dari gudang via ${order.srNumber}`,
              createdAt: now,
            },
          });

          touchedProducts.add(item.productId);
        } else {
          const product = await tx.products.findUnique({
            where: { productId: item.productId },
          });
          if (!product) throw new BusinessError("Produk pada permintaan tidak ditemukan");

          await tx.products.update({
            where: { productId: item.productId },
            data: { stockToko: { increment: qty } },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              userId,
              location: "toko",
              type: "sr_transfer",
              quantity: qty,
              stockBefore: product.stockToko,
              stockAfter: product.stockToko + qty,
              referenceId: srId,
              referenceType: REF_TYPE,
              notes: `Diterima dari gudang via ${order.srNumber}`,
              createdAt: now,
            },
          });
        }
      }

      for (const productId of touchedProducts) {
        await syncProductAggregates(tx, productId);
      }

      await tx.storeReplenishment.update({
        where: { srId },
        data: {
          status: "completed",
          receivedById: userId,
          receivedAt: now,
          receiveImage,
          receiveNotes,
        },
      });
    });

    // Notifikasi selesai
    const doneMessage = `Barang dari ${order.srNumber} telah diterima toko dan stok toko diperbarui.`;
    await notifyByRole({
      role: "super_admin",
      title: "Penerimaan Toko Dikonfirmasi",
      message: doneMessage,
      type: "sr_received",
      referenceId: srId,
      referenceType: REF_TYPE,
    });
    await notifyByRole({
      role: "admin_gudang",
      title: "Penerimaan Toko Dikonfirmasi",
      message: doneMessage,
      type: "sr_received",
      referenceId: srId,
      referenceType: REF_TYPE,
    });

    // Selisih jumlah dikirim vs diterima → peringatan khusus ke Super Admin
    const discrepancies = resolved.filter((r) => r.qty < r.shipped);
    if (discrepancies.length > 0) {
      const detail = discrepancies
        .map(({ item, shipped, qty }) => {
          const label = item.variant
            ? `${item.product.name} - ${item.variant.name}`
            : item.product.name;
          return `${label} (dikirim ${shipped}, diterima ${qty})`;
        })
        .join("; ");
      await notifyByRole({
        role: "super_admin",
        title: "Selisih Penerimaan Barang",
        message: `${order.srNumber} memiliki selisih: ${detail}. Mohon ditindaklanjuti.`,
        type: "sr_discrepancy",
        referenceId: srId,
        referenceType: REF_TYPE,
      });
    }

    const result = await prisma.storeReplenishment.findUnique({
      where: { srId },
      include: fullInclude,
      omit: LIST_OMIT,
    });
    res.json(result);
  } catch (error) {
    sendError(res, error, "Error receiving store replenishment");
  }
};