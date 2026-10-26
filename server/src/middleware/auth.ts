import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

// Cek apakah user sudah login.
// Status & peran dibaca ulang dari database setiap request, sehingga:
//  - akun yang dinonaktifkan langsung kehilangan akses (tanpa menunggu logout),
//  - perubahan peran oleh Super Admin langsung berlaku.
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Tidak terautentikasi. Silakan login." });
    return;
  }

  try {
    const user = await prisma.users.findUnique({
      where:  { userId },
      select: { role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      res.status(401).json({ message: "Akun tidak aktif atau sesi tidak valid. Silakan login kembali." });
      return;
    }

    req.session.role = user.role;
    next();
  } catch (error) {
    console.error("requireAuth error:", error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// Cek role — bisa satu atau beberapa role
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session.userId) {
      res.status(401).json({ message: "Tidak terautentikasi. Silakan login." });
      return;
    }

    if (!roles.includes(req.session.role ?? "")) {
      res.status(403).json({
        message: "Akses ditolak. Anda tidak memiliki wewenang untuk fitur ini.",
      });
      return;
    }

    next();
  };
};

// Shortcut untuk masing-masing role
export const isSuperAdmin  = requireRole("super_admin");
export const isAdminGudang = requireRole("admin_gudang");
export const isAdminToko   = requireRole("admin_toko");

// Super admin + admin gudang
export const isAdminGudangOrSuper = requireRole("super_admin", "admin_gudang");

// Semua role boleh akses
export const isAnyAdmin = requireRole("super_admin", "admin_toko", "admin_gudang");
