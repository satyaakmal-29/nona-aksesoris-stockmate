import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { notifyByRole } from "./notificationController";
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

// Purchase Order = pembelian barang ke SUPPLIER.
// Super Admin membuat (dengan bukti nota) → Admin Gudang memvalidasi penerimaan fisik.

const REF_TYPE = "PURCHASE_ORDER";

// Foto tidak ikut daftar (berat); foto hanya dikirim di endpoint detail
const LIST_OMIT = { invoiceImage: true, receiptImage: true } as const;

const userSelect = { select: { name: true, role: true } } as const;

const itemInclude = {
  product: { select: { name: true, imageUrl: true } },
  variant: {
    select: {
      name: true,
      value: true,
      imageUrl: true,
      price: true,
      stockGudang: true,
    },
  },
} as const;

const fullInclude = {
  createdBy: userSelect,
  validatedBy: userSelect,
  Items: { include: itemInclude },
} as const;

const formatRupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

// ─── GET /purchase-orders ────────────────────────────────────────
export const getPurchaseOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const status = req.query.status?.toString();

    const orders = await prisma.purchaseOrder.findMany({
      where: status ? { status } : {},
      include: fullInclude,
      omit: LIST_OMIT,
      orderBy: { createdAt: "desc" },
    });

    res.json(orders);
  } catch (error) {
    sendError(res, error, "Error retrieving purchase orders");
  }
};

// ─── GET /purchase-orders/:poId ──────────────────────────────────
// Detail lengkap termasuk foto nota & foto bukti penerimaan
export const getPurchaseOrderById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { poId } = req.params as { poId: string };

    const order = await prisma.purchaseOrder.findUnique({
      where: { poId },
      include: fullInclude,
    });

    if (!order) {
      res.status(404).json({ message: "Purchase Order tidak ditemukan" });
      return;
    }

    res.json(order);
  } catch (error) {
    sendError(res, error, "Error retrieving purchase order");
  }
};

// ─── POST /purchase-orders ───────────────────────────────────────
// Hanya super_admin. Bukti pembelian (nota, resi, foto nota) wajib.
export const createPurchaseOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const body = req.body ?? {};

    // ── Bukti pembelian ──
    const supplier = cleanText(body.supplier);
    const invoiceNumber = cleanText(body.invoiceNumber);
    const trackingNumber = cleanText(body.trackingNumber);
    if (!supplier) throw new BusinessError("Nama supplier wajib diisi");
    if (!invoiceNumber) throw new BusinessError("Nomor nota / invoice wajib diisi");
    if (!trackingNumber) throw new BusinessError("Nomor resi / pengiriman wajib diisi");

    const invoiceDate = new Date(body.invoiceDate);
    if (!body.invoiceDate || Number.isNaN(invoiceDate.getTime())) {
      throw new BusinessError("Tanggal nota tidak valid");
    }
    if (invoiceDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      throw new BusinessError("Tanggal nota tidak boleh di masa depan");
    }

    const invoiceTotal = body.invoiceTotal;
    if (typeof invoiceTotal !== "number" || !(invoiceTotal > 0)) {
      throw new BusinessError("Total nota harus lebih dari 0");
    }

    const invoiceImage = requireImage(body.invoiceImage, "Foto nota");
    const notes = cleanText(body.notes) || null;

    // Nota yang sama dari supplier yang sama tidak boleh dicatat dua kali
    const duplicate = await prisma.purchaseOrder.findFirst({
      where: {
        supplier: { equals: supplier, mode: "insensitive" },
        invoiceNumber: { equals: invoiceNumber, mode: "insensitive" },
      },
      select: { poNumber: true },
    });
    if (duplicate) {
      throw new BusinessError(
        `Nota ${invoiceNumber} dari ${supplier} sudah tercatat di ${duplicate.poNumber}`
      );
    }

    // ── Item ──
    const items: Array<{
      productId: string;
      variantId?: string;
      qtyOrdered: number;
      unitCost: number;
    }> = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) throw new BusinessError("Item tidak boleh kosong");

    for (const item of items) {
      if (!item.productId) throw new BusinessError("Setiap item wajib memilih produk");
      if (!isPositiveInt(item.qtyOrdered)) {
        throw new BusinessError("Jumlah minimal 1 dan harus bilangan bulat");
      }
      if (typeof item.unitCost !== "number" || !(item.unitCost > 0)) {
        throw new BusinessError("Harga beli satuan harus lebih dari 0");
      }

      const product = await prisma.products.findUnique({
        where: { productId: item.productId },
        include: { Variants: { where: { isActive: true } } },
      });
      if (!product || !product.isActive) {
        throw new BusinessError("Produk tidak ditemukan atau sudah tidak aktif");
      }

      if (product.Variants.length > 0) {
        if (!item.variantId) {
          throw new BusinessError(`Pilih varian untuk produk "${product.name}"`);
        }
        if (!product.Variants.some((v) => v.variantId === item.variantId)) {
          throw new BusinessError(`Varian tidak valid untuk produk "${product.name}"`);
        }
      } else if (item.variantId) {
        throw new BusinessError(`Produk "${product.name}" tidak memiliki varian`);
      }
    }

    // Total item harus sama dengan total di nota
    const itemsTotal = items.reduce((s, i) => s + i.unitCost * i.qtyOrdered, 0);
    if (Math.abs(itemsTotal - invoiceTotal) > 0.5) {
      throw new BusinessError(
        `Total nota (${formatRupiah(invoiceTotal)}) tidak sama dengan total item (${formatRupiah(itemsTotal)}). Periksa kembali jumlah dan harga.`
      );
    }

    // ── Simpan (nomor dibuat di dalam transaksi; ulangi jika bentrok) ──
    const poId = uuidv4();
    const prefix = datePrefix("PO");
    let order = null;
    let poNumber = "";

    for (let attempt = 0; attempt < 3 && !order; attempt++) {
      try {
        order = await prisma.$transaction(async (tx) => {
          const last = await tx.purchaseOrder.findFirst({
            where: { poNumber: { startsWith: prefix } },
            orderBy: { poNumber: "desc" },
          });
          poNumber = nextNumber(prefix, last?.poNumber);

          return tx.purchaseOrder.create({
            data: {
              poId,
              poNumber,
              supplier,
              invoiceNumber,
              trackingNumber,
              invoiceDate,
              invoiceTotal,
              invoiceImage,
              notes,
              createdById: userId,
              Items: {
                create: items.map((item) => ({
                  poItemId: uuidv4(),
                  productId: item.productId,
                  variantId: item.variantId ?? null,
                  qtyOrdered: item.qtyOrdered,
                  unitCost: item.unitCost,
                  subtotal: item.unitCost * item.qtyOrdered,
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
      title: "Purchase Order Baru",
      message: `${poNumber} dari ${supplier} (resi ${trackingNumber}) akan datang. Validasi saat barang diterima.`,
      type: "po_created",
      referenceId: poId,
      referenceType: REF_TYPE,
    });

    res.status(201).json(order);
  } catch (error) {
    sendError(res, error, "Error creating purchase order");
  }
};

// ─── PATCH /purchase-orders/:poId/receive ────────────────────────
// Admin gudang memvalidasi penerimaan fisik barang dari supplier dengan foto bukti.
// Stok gudang bertambah sesuai jumlah yang benar-benar diterima.
export const receivePurchaseOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const { poId } = req.params as { poId: string };
    const body = req.body ?? {};

    const receiptImage = requireImage(body.receiptImage, "Foto bukti penerimaan");
    const deliveryNoteNumber = cleanText(body.deliveryNoteNumber) || null;
    const receiveNotes = cleanText(body.receiveNotes) || null;

    const receivedItems: Array<{
      poItemId: string;
      qtyReceived: number;
      receiveNote?: string;
    }> = Array.isArray(body.receivedItems) ? body.receivedItems : [];

    const order = await prisma.purchaseOrder.findUnique({
      where: { poId },
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
      res.status(404).json({ message: "Purchase Order tidak ditemukan" });
      return;
    }
    if (order.status !== "pending") {
      throw new BusinessError(
        `Purchase Order sudah diproses, status saat ini: ${order.status}`
      );
    }

    // Qty diterima per item (default = qty dipesan)
    const resolved = order.Items.map((item) => {
      const given = receivedItems.find((r) => r.poItemId === item.poItemId);
      const qty = given ? given.qtyReceived : item.qtyOrdered;
      const note = cleanText(given?.receiveNote);
      return { item, qty, note };
    });

    for (const { item, qty, note } of resolved) {
      if (!isNonNegativeInt(qty) || qty > item.qtyOrdered) {
        throw new BusinessError(
          "Jumlah diterima harus bilangan bulat dan tidak boleh melebihi jumlah dipesan"
        );
      }
      if (qty < item.qtyOrdered && !note) {
        throw new BusinessError(
          "Isi alasan untuk item yang diterima kurang dari jumlah dipesan"
        );
      }
    }
    if (resolved.every((r) => r.qty === 0)) {
      throw new BusinessError("Tidak ada barang yang diterima");
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const touchedProducts = new Set<string>();

      for (const { item, qty, note } of resolved) {
        await tx.purchaseOrderItem.update({
          where: { poItemId: item.poItemId },
          data: { qtyReceived: qty, receiveNote: note || null },
        });
        if (qty === 0) continue;

        const movementNote = `Pembelian dari ${order.supplier} via ${order.poNumber} (nota ${order.invoiceNumber})`;

        if (item.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { variantId: item.variantId },
          });
          if (!variant) throw new BusinessError("Varian pada PO tidak ditemukan");

          await tx.productVariant.update({
            where: { variantId: item.variantId },
            data: { stockGudang: { increment: qty } },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId,
              userId,
              location: "gudang",
              type: "restock_gudang",
              quantity: qty,
              stockBefore: variant.stockGudang,
              stockAfter: variant.stockGudang + qty,
              referenceId: poId,
              referenceType: REF_TYPE,
              notes: movementNote,
              createdAt: now,
            },
          });

          touchedProducts.add(item.productId);
        } else {
          const product = await tx.products.findUnique({
            where: { productId: item.productId },
          });
          if (!product) throw new BusinessError("Produk pada PO tidak ditemukan");

          await tx.products.update({
            where: { productId: item.productId },
            data: { stockGudang: { increment: qty } },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              userId,
              location: "gudang",
              type: "restock_gudang",
              quantity: qty,
              stockBefore: product.stockGudang,
              stockAfter: product.stockGudang + qty,
              referenceId: poId,
              referenceType: REF_TYPE,
              notes: movementNote,
              createdAt: now,
            },
          });
        }
      }

      for (const productId of touchedProducts) {
        await syncProductAggregates(tx, productId);
      }

      await tx.purchaseOrder.update({
        where: { poId },
        data: {
          status: "received",
          validatedById: userId,
          receivedAt: now,
          receiptImage,
          deliveryNoteNumber,
          receiveNotes,
        },
      });
    });

    await notifyByRole({
      role: "super_admin",
      title: "Barang Supplier Diterima",
      message: `Barang dari ${order.poNumber} (${order.supplier}) telah diterima dan stok gudang diperbarui.`,
      type: "po_received",
      referenceId: poId,
      referenceType: REF_TYPE,
    });

    // Selisih jumlah dipesan vs diterima → peringatan khusus ke Super Admin
    const discrepancies = resolved.filter((r) => r.qty < r.item.qtyOrdered);
    if (discrepancies.length > 0) {
      const detail = discrepancies
        .map(({ item, qty }) => {
          const label = item.variant
            ? `${item.product.name} - ${item.variant.name}`
            : item.product.name;
          return `${label} (dipesan ${item.qtyOrdered}, diterima ${qty})`;
        })
        .join("; ");
      await notifyByRole({
        role: "super_admin",
        title: "Selisih Penerimaan dari Supplier",
        message: `${order.poNumber} memiliki selisih: ${detail}. Mohon ditindaklanjuti ke supplier.`,
        type: "po_discrepancy",
        referenceId: poId,
        referenceType: REF_TYPE,
      });
    }

    const result = await prisma.purchaseOrder.findUnique({
      where: { poId },
      include: fullInclude,
      omit: LIST_OMIT,
    });
    res.json(result);
  } catch (error) {
    sendError(res, error, "Error receiving purchase order");
  }
};