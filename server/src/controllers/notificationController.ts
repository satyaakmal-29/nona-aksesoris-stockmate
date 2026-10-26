import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { LOW_STOCK_GUDANG, LOW_STOCK_TOKO } from "../lib/stockHelpers";

// GET /notifications — ambil notifikasi milik user yang login
export const getNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ message: "Tidak terautentikasi" });
      return;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where:   { userId },
        orderBy: { createdAt: "desc" },
        take:    50, // maksimal 50 notifikasi terbaru
      }),
      // Dihitung terpisah agar akurat walau belum dibaca > 50
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("getNotifications error:", error);
    res.status(500).json({ message: "Error retrieving notifications" });
  }
};

// PATCH /notifications/:notifId — tandai satu notifikasi sebagai dibaca
export const markAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId  = req.session.userId;
    const { notifId } = req.params as { notifId: string };

    if (!userId) {
      res.status(401).json({ message: "Tidak terautentikasi" });
      return;
    }

    // Pastikan notifikasi milik user yang sedang login
    const notif = await prisma.notification.findUnique({
      where: { notifId },
    });

    if (!notif || notif.userId !== userId) {
      res.status(404).json({ message: "Notifikasi tidak ditemukan" });
      return;
    }

    const updated = await prisma.notification.update({
      where: { notifId },
      data:  { isRead: true },
    });

    res.json(updated);
  } catch (error) {
    console.error("markAsRead error:", error);
    res.status(500).json({ message: "Error marking notification as read" });
  }
};

// PATCH /notifications/read-all — tandai semua notifikasi sebagai dibaca
export const markAllAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ message: "Tidak terautentikasi" });
      return;
    }

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true },
    });

    res.json({ message: "Semua notifikasi telah ditandai dibaca" });
  } catch (error) {
    console.error("markAllAsRead error:", error);
    res.status(500).json({ message: "Error marking all notifications as read" });
  }
};

// Helper: buat notifikasi untuk satu user
// referenceType: "PURCHASE_ORDER" | "STORE_REPLENISHMENT"
export const createNotification = async ({
  userId,
  title,
  message,
  type,
  referenceId,
  referenceType,
}: {
  userId:         string;
  title:          string;
  message:        string;
  type:           string;
  referenceId?:   string;
  referenceType?: string;
}) => {
  return prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      referenceId:   referenceId   ?? null,
      referenceType: referenceType ?? null,
    },
  });
};

// Helper: kirim notifikasi ke semua user aktif dengan role tertentu
export const notifyByRole = async ({
  role,
  title,
  message,
  type,
  referenceId,
  referenceType,
}: {
  role:           string;
  title:          string;
  message:        string;
  type:           string;
  referenceId?:   string;
  referenceType?: string;
}) => {
  const users = await prisma.users.findMany({
    where:  { role, isActive: true },
    select: { userId: true },
  });

  if (users.length === 0) return;

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId:        u.userId,
      title,
      message,
      type,
      referenceId:   referenceId   ?? null,
      referenceType: referenceType ?? null,
    })),
  });
};

// Helper: peringatan stok menipis / habis setelah stok berkurang.
// Hanya dikirim saat stok BARU melewati ambang (sebelum >= ambang, sesudah < ambang)
// atau baru habis, agar tidak muncul berulang di setiap transaksi.
//   toko   -> super_admin & admin_gudang (perlu Store Replenishment)
//   gudang -> super_admin (perlu Purchase Order ke supplier)
export const notifyLowStock = async (
  location: "toko" | "gudang",
  changes: Array<{ label: string; before: number; after: number }>
): Promise<void> => {
  const threshold = location === "toko" ? LOW_STOCK_TOKO : LOW_STOCK_GUDANG;

  const empty = changes.filter((c) => c.after <= 0 && c.before > 0);
  const low   = changes.filter((c) => c.after > 0 && c.after < threshold && c.before >= threshold);
  if (empty.length === 0 && low.length === 0) return;

  const parts: string[] = [];
  if (empty.length > 0) parts.push(`Habis: ${empty.map((c) => c.label).join(", ")}.`);
  if (low.length > 0) {
    parts.push(`Menipis (< ${threshold}): ${low.map((c) => `${c.label} (${c.after})`).join(", ")}.`);
  }

  const isToko = location === "toko";
  const payload = {
    title:         isToko ? "Stok Toko Menipis" : "Stok Gudang Menipis",
    message:       `${parts.join(" ")} ${isToko ? "Ajukan Store Replenishment dari gudang." : "Pertimbangkan membuat Purchase Order ke supplier."}`,
    type:          isToko ? "stock_low_toko" : "stock_low_gudang",
    referenceType: isToko ? "STOCK_TOKO" : "STOCK_GUDANG",
  };

  // Gagal kirim notifikasi tidak boleh menggagalkan proses utama
  try {
    await notifyByRole({ role: "super_admin", ...payload });
    if (isToko) await notifyByRole({ role: "admin_gudang", ...payload });
  } catch (error) {
    console.error("notifyLowStock error:", error);
  }
};
