import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { BusinessError } from "../lib/stockHelpers";
import {
  validateGmail,
  validatePassword,
  validatePersonName,
  validateUsername,
} from "../lib/validation";

// ── Batas percobaan login (per username/email, disimpan di memori) ──
// 5x salah → dikunci 5 menit. Hitungan direset jika salah terakhir > 15 menit lalu.
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_MS      = 5 * 60 * 1000;
const FAILURE_WINDOW_MS  = 15 * 60 * 1000;
const loginFailures = new Map<string, { count: number; lastAt: number; lockedUntil: number }>();

const pruneLoginFailures = (now: number) => {
  for (const [key, f] of loginFailures) {
    if (f.lockedUntil < now && now - f.lastAt > FAILURE_WINDOW_MS) loginFailures.delete(key);
  }
};

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

    // Aturan sama dengan tambah user (userController)
    const body = req.body ?? {};
    let name: string, username: string, email: string, password: string;
    try {
      name     = validatePersonName(body.name);
      username = validateUsername(body.username);
      email    = validateGmail(body.email);
      password = validatePassword(body.password, username);
    } catch (e) {
      if (e instanceof BusinessError) return res.status(400).json({ message: e.message });
      throw e;
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
    const { username, password } = req.body ?? {};
    const identifier = typeof username === "string" ? username.trim() : "";
    if (!identifier || typeof password !== "string" || !password) {
      return res
        .status(400)
        .json({ message: "Username dan password wajib diisi" });
    }

    const key = identifier.toLowerCase();
    const now = Date.now();
    let failure = loginFailures.get(key);
    if (failure && failure.lockedUntil > now) {
      const minutes = Math.ceil((failure.lockedUntil - now) / 60000);
      return res.status(429).json({
        message: `Terlalu banyak percobaan login gagal. Coba lagi dalam ${minutes} menit.`,
      });
    }
    if (failure && now - failure.lastAt > FAILURE_WINDOW_MS) failure = undefined;

    // Username & email tidak peka huruf besar/kecil (duplikat sudah dicegah tanpa beda huruf)
    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: "insensitive" } },
          { email:    { equals: identifier, mode: "insensitive" } },
        ],
        isActive: true,
      },
    });

    const isValid = !!user && (await bcrypt.compare(password, user.password));
    if (!user || !isValid) {
      const count = (failure?.count ?? 0) + 1;
      const locked = count >= MAX_LOGIN_FAILURES;
      loginFailures.set(key, { count, lastAt: now, lockedUntil: locked ? now + LOGIN_LOCK_MS : 0 });
      if (loginFailures.size > 500) pruneLoginFailures(now);
      if (locked) {
        return res.status(429).json({
          message: `Login gagal ${MAX_LOGIN_FAILURES} kali. Coba lagi dalam ${LOGIN_LOCK_MS / 60000} menit.`,
        });
      }
      return res.status(401).json({
        message: `Username/email atau password salah. Sisa percobaan: ${MAX_LOGIN_FAILURES - count}.`,
      });
    }

    loginFailures.delete(key);

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