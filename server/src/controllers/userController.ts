import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { BusinessError, sendError, cleanText } from "../lib/stockHelpers";

const ROLES = ["super_admin", "admin_toko", "admin_gudang"];
const MIN_PASSWORD = 6;
const USERNAME_RE = /^[a-zA-Z0-9._]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const listSelect = {
  userId:       true,
  name:         true,
  username:     true,
  email:        true,
  role:         true,
  isActive:     true,
  profileImage: true,
  createdAt:    true,
} as const;

const profileSelect = {
  userId:       true,
  name:         true,
  username:     true,
  email:        true,
  role:         true,
  profileImage: true,
  language:     true,
  notification: true,
  isActive:     true,
} as const;

const validatePassword = (password: unknown, label = "Password"): string => {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    throw new BusinessError(`${label} minimal ${MIN_PASSWORD} karakter`);
  }
  return password;
};

const validateEmail = (email: string): string => {
  if (!EMAIL_RE.test(email)) throw new BusinessError("Format email tidak valid");
  return email.toLowerCase();
};

// Jumlah Super Admin aktif selain user tertentu
const otherActiveSuperAdmins = (excludeUserId: string) =>
  prisma.users.count({
    where: { role: "super_admin", isActive: true, userId: { not: excludeUserId } },
  });

// ─── GET /users (Super Admin) ────────────────────────────────────
export const getUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.users.findMany({
      select:  listSelect,
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  } catch (error) {
    sendError(res, error, "Error retrieving users");
  }
};

// ─── GET /users/profile — profil user yang sedang login ──────────
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.users.findUnique({
      where:  { userId: req.session.userId! },
      select: profileSelect,
    });
    if (!user) {
      res.status(404).json({ message: "User tidak ditemukan" });
      return;
    }
    res.json(user);
  } catch (error) {
    sendError(res, error, "Error retrieving profile");
  }
};

// ─── PUT /users/profile/:userId — ubah profil sendiri ───────────
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };
    if (req.session.userId !== userId) {
      res.status(403).json({ message: "Tidak diizinkan mengubah profil user lain" });
      return;
    }

    const { name, email, profileImage, notification, language } = req.body ?? {};
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      const clean = cleanText(name);
      if (!clean) throw new BusinessError("Nama tidak boleh kosong");
      updateData.name = clean;
    }
    if (email !== undefined) {
      const clean = validateEmail(cleanText(email));
      const duplicate = await prisma.users.findFirst({
        where: { email: { equals: clean, mode: "insensitive" }, userId: { not: userId } },
      });
      if (duplicate) throw new BusinessError("Email sudah digunakan akun lain");
      updateData.email = clean;
    }
    if (profileImage !== undefined) {
      if (profileImage !== null && profileImage !== "" &&
          (typeof profileImage !== "string" || !profileImage.startsWith("data:image/"))) {
        throw new BusinessError("Foto profil harus berupa gambar");
      }
      if (typeof profileImage === "string" && profileImage.length > 1_000_000) {
        throw new BusinessError("Foto profil terlalu besar");
      }
      updateData.profileImage = profileImage || null;
    }
    if (typeof notification === "boolean") updateData.notification = notification;
    if (typeof language === "string" && language) updateData.language = language;

    const user = await prisma.users.update({
      where:  { userId },
      data:   updateData,
      select: profileSelect,
    });
    res.json(user);
  } catch (error) {
    sendError(res, error, "Error updating profile");
  }
};

// ─── PATCH /users/profile/password — ganti password sendiri ─────
export const changeOwnPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const { currentPassword, newPassword } = req.body ?? {};

    if (typeof currentPassword !== "string" || !currentPassword) {
      throw new BusinessError("Password lama wajib diisi");
    }
    const password = validatePassword(newPassword, "Password baru");
    if (password === currentPassword) {
      throw new BusinessError("Password baru harus berbeda dari password lama");
    }

    const user = await prisma.users.findUnique({ where: { userId } });
    if (!user) {
      res.status(404).json({ message: "User tidak ditemukan" });
      return;
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      throw new BusinessError("Password lama salah");
    }

    await prisma.users.update({
      where: { userId },
      data:  { password: await bcrypt.hash(password, 12) },
    });
    res.json({ message: "Password berhasil diganti" });
  } catch (error) {
    sendError(res, error, "Error changing password");
  }
};

// ─── POST /users — buat user baru (Super Admin) ──────────────────
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body ?? {};
    const name     = cleanText(body.name);
    const username = cleanText(body.username);
    const email    = cleanText(body.email);
    const role     = cleanText(body.role);

    if (!name || !username || !email || !role) throw new BusinessError("Semua field wajib diisi");
    if (!USERNAME_RE.test(username)) {
      throw new BusinessError("Username 3-30 karakter, hanya huruf, angka, titik, atau garis bawah");
    }
    const cleanEmail = validateEmail(email);
    if (!ROLES.includes(role)) throw new BusinessError("Role tidak valid");
    const password = validatePassword(body.password);

    const existing = await prisma.users.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: "insensitive" } },
          { email:    { equals: cleanEmail, mode: "insensitive" } },
        ],
      },
    });
    if (existing) {
      const field = existing.username.toLowerCase() === username.toLowerCase() ? "Username" : "Email";
      res.status(409).json({ message: `${field} sudah digunakan` });
      return;
    }

    const user = await prisma.users.create({
      data: {
        userId:   uuidv4(),
        name,
        username,
        email:    cleanEmail,
        password: await bcrypt.hash(password, 12),
        role,
        language: "Indonesia",
      },
      select: listSelect,
    });
    res.status(201).json(user);
  } catch (error) {
    sendError(res, error, "Error creating user");
  }
};

// ─── PUT /users/:userId — ubah data user (Super Admin) ───────────
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };
    const body = req.body ?? {};
    const isSelf = req.session.userId === userId;

    const existing = await prisma.users.findUnique({ where: { userId } });
    if (!existing) {
      res.status(404).json({ message: "User tidak ditemukan" });
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = cleanText(body.name);
      if (!name) throw new BusinessError("Nama tidak boleh kosong");
      updateData.name = name;
    }
    if (body.username !== undefined) {
      const username = cleanText(body.username);
      if (!USERNAME_RE.test(username)) {
        throw new BusinessError("Username 3-30 karakter, hanya huruf, angka, titik, atau garis bawah");
      }
      updateData.username = username;
    }
    if (body.email !== undefined) {
      updateData.email = validateEmail(cleanText(body.email));
    }
    if (body.role !== undefined) {
      if (!ROLES.includes(body.role)) throw new BusinessError("Role tidak valid");
      updateData.role = body.role;
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") throw new BusinessError("Status tidak valid");
      updateData.isActive = body.isActive;
    }

    // Akun sendiri: peran & status tidak boleh diubah (hindari terkunci)
    if (isSelf && updateData.role !== undefined && updateData.role !== existing.role) {
      throw new BusinessError("Anda tidak dapat mengubah peran akun sendiri");
    }
    if (isSelf && updateData.isActive === false) {
      throw new BusinessError("Anda tidak dapat menonaktifkan akun sendiri");
    }

    // Harus selalu ada minimal 1 Super Admin aktif
    const losesSuperAdmin =
      existing.role === "super_admin" && existing.isActive &&
      ((updateData.role !== undefined && updateData.role !== "super_admin") ||
        updateData.isActive === false);
    if (losesSuperAdmin && (await otherActiveSuperAdmins(userId)) === 0) {
      throw new BusinessError("Harus ada minimal 1 Super Admin aktif");
    }

    // Duplikat username / email
    if (updateData.username || updateData.email) {
      const duplicate = await prisma.users.findFirst({
        where: {
          userId: { not: userId },
          OR: [
            ...(updateData.username ? [{ username: { equals: updateData.username as string, mode: "insensitive" as const } }] : []),
            ...(updateData.email    ? [{ email:    { equals: updateData.email as string,    mode: "insensitive" as const } }] : []),
          ],
        },
      });
      if (duplicate) {
        const field =
          updateData.username &&
          duplicate.username.toLowerCase() === (updateData.username as string).toLowerCase()
            ? "Username"
            : "Email";
        res.status(409).json({ message: `${field} sudah digunakan` });
        return;
      }
    }

    const user = await prisma.users.update({
      where:  { userId },
      data:   updateData,
      select: listSelect,
    });
    res.json(user);
  } catch (error) {
    sendError(res, error, "Error updating user");
  }
};

// ─── PATCH /users/:userId/password — reset password (Super Admin) ─
export const resetUserPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };
    const password = validatePassword(req.body?.newPassword, "Password baru");

    const existing = await prisma.users.findUnique({ where: { userId } });
    if (!existing) {
      res.status(404).json({ message: "User tidak ditemukan" });
      return;
    }

    await prisma.users.update({
      where: { userId },
      data:  { password: await bcrypt.hash(password, 12) },
    });
    res.json({ message: `Password ${existing.name} berhasil direset` });
  } catch (error) {
    sendError(res, error, "Error resetting password");
  }
};

// ─── DELETE /users/:userId (Super Admin) ─────────────────────────
// User yang punya riwayat (transaksi, PO, SR, mutasi stok, pengeluaran)
// tidak dihapus permanen, tetapi dinonaktifkan agar laporan tetap utuh.
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };

    if (req.session.userId === userId) {
      throw new BusinessError("Tidak dapat menghapus akun sendiri");
    }

    const existing = await prisma.users.findUnique({
      where: { userId },
      include: {
        _count: {
          select: {
            Transactions: true,
            StockMovements: true,
            PurchaseOrdersCreated: true,
            PurchaseOrdersValidated: true,
            StoreReplenishmentsCreated: true,
            StoreReplenishmentsApproved: true,
            StoreReplenishmentsShipped: true,
            StoreReplenishmentsReceived: true,
            ExpensesCreated: true,
            ExpensesUpdated: true,
          },
        },
      },
    });
    if (!existing) {
      res.status(404).json({ message: "User tidak ditemukan" });
      return;
    }

    if (existing.role === "super_admin" && existing.isActive &&
        (await otherActiveSuperAdmins(userId)) === 0) {
      throw new BusinessError("Harus ada minimal 1 Super Admin aktif");
    }

    const historyCount = Object.values(existing._count).reduce((s, n) => s + n, 0);

    if (historyCount > 0) {
      await prisma.users.update({ where: { userId }, data: { isActive: false } });
      res.json({
        message: `${existing.name} memiliki riwayat aktivitas, sehingga dinonaktifkan (tidak dihapus permanen) agar laporan tetap utuh.`,
        deactivated: true,
      });
      return;
    }

    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.users.delete({ where: { userId } }),
    ]);
    res.json({ message: `${existing.name} berhasil dihapus`, deactivated: false });
  } catch (error) {
    sendError(res, error, "Error deleting user");
  }
};
