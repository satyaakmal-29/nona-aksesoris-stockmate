import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

// Nama & opsi cookie harus sama dengan konfigurasi session di index.ts,
// kalau tidak clearCookie tidak akan menghapus cookie yang benar.
const SESSION_COOKIE_NAME = "stockmate.sid";

const clearSessionCookie = (res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    path:     "/",
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
};

// ── Init Super Admin (hanya sekali, saat DB kosong) ──────────────
export const initSuperAdmin = async (req: Request, res: Response) => {
  try {
    const existingUser = await prisma.users.findFirst();
    if (existingUser) {
      return res.status(403).json({
        message:
          "Setup sudah pernah dilakukan. Hubungi super admin untuk tambah user.",
      });
    }

    const { name, username, email, password } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password minimal 8 karakter" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.users.create({
      data: {
        name,
        username,
        email,
        password: hashedPassword,
        role: "super_admin",
        isActive: true,
      },
    });

    return res.status(201).json({
      message: "Super admin berhasil dibuat. Silakan login.",
      username: user.username,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ message: "Username atau email sudah digunakan" });
    }
    return res.status(500).json({ message: "Gagal membuat super admin" });
  }
};

// ── Login ─────────────────────────────────────────────────────────
export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username dan password wajib diisi" });
    }

    const user = await prisma.users.findFirst({
      where: {
        OR: [{ username }, { email: username }],
        isActive: true,
      },
    });

    if (!user) {
      return res
        .status(401)
        .json({ message: "Username/email atau password salah" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res
        .status(401)
        .json({ message: "Username/email atau password salah" });
    }

    req.session.userId   = user.userId;
    req.session.username = user.username;
    req.session.role     = user.role;

    return res.status(200).json({
      message: "Login berhasil",
      user: {
        userId:       user.userId,
        name:         user.name,
        username:     user.username,
        email:        user.email,
        role:         user.role,
        profileImage: user.profileImage,
        language:     user.language,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ── Logout ────────────────────────────────────────────────────────
export const logout = async (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Gagal logout" });
    }
    clearSessionCookie(res);
    return res.status(200).json({ message: "Logout berhasil" });
  });
};

// ── Me (cek session) ──────────────────────────────────────────────
export const me = async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      // Cookie basi (mis. server restart) -> bersihkan supaya tidak loop
      clearSessionCookie(res);
      return res.status(401).json({ message: "Tidak terautentikasi" });
    }

    const user = await prisma.users.findUnique({
      where: { userId: req.session.userId },
      select: {
        userId:       true,
        name:         true,
        username:     true,
        email:        true,
        role:         true,
        profileImage: true,
        language:     true,
        isActive:     true,
      },
    });

    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      clearSessionCookie(res);
      return res.status(401).json({ message: "Sesi tidak valid" });
    }

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ── Check apakah DB sudah disetup ────────────────────────────────
export const checkSetup = async (req: Request, res: Response) => {
  try {
    const existingUser = await prisma.users.findFirst();
    return res.status(200).json({ isSetup: !!existingUser });
  } catch (error) {
    return res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};