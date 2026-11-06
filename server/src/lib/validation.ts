import { BusinessError, cleanText } from "./stockHelpers";

// ── Batas validasi bersama ───────────────────────────────────────
// Nilai HARUS sama dengan client/src/lib/validation.ts
export const MIN_PASSWORD     = 6;
export const MAX_PASSWORD     = 72;          // bcrypt hanya memakai 72 byte pertama
export const PRICE_MAX        = 100_000_000; // harga varian & harga beli (Rp)
export const QTY_MAX          = 100_000;     // stok / jumlah per input (produk, PO, SR)
export const TRX_QTY_MAX      = 999;         // jumlah per item transaksi
export const CASH_OVERPAY_MAX = 1_000_000;   // uang tunai maks = total belanja + nilai ini
export const EXPENSE_MAX      = 100_000_000; // pengeluaran per entri (Rp)

export const CUSTOMER_EMAIL_MAX = 100;       // email pembeli (nota digital)

export const USERNAME_RE    = /^[a-zA-Z0-9._]{3,30}$/;
export const GMAIL_RE       = /^[a-z0-9._%+-]{1,64}@gmail\.com$/;
// Email pembeli boleh selain Gmail (yahoo, outlook, email kantor, dll.)
export const EMAIL_RE       = /^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
// App Password Google: 16 huruf (ditampilkan Google dalam 4 kelompok, spasi dibuang)
export const APP_PASSWORD_RE = /^[a-z]{16}$/;
// Nomor HP Indonesia format internasional tanpa "+": 628 + 8–11 digit (0812-3456-78 s.d. 0812-3456-78901)
export const WHATSAPP_RE    = /^628\d{8,11}$/;
export const PERSON_NAME_RE = /^[\p{L} .']{3,50}$/u;
export const DOC_NUMBER_RE  = /^[A-Za-z0-9./-]{3,50}$/;

// Teks dirapikan: spasi di ujung dibuang, spasi ganda jadi satu
export const squeeze = (v: unknown): string => cleanText(v).replace(/\s+/g, " ");

// ── Akun ─────────────────────────────────────────────────────────
export const validatePersonName = (v: unknown, label = "Nama"): string => {
  const name = squeeze(v);
  if (!name) throw new BusinessError(`${label} wajib diisi`);
  if (!PERSON_NAME_RE.test(name)) {
    throw new BusinessError(`${label} 3–50 karakter, hanya huruf, spasi, titik, atau apostrof`);
  }
  return name;
};

export const validateUsername = (v: unknown): string => {
  const username = cleanText(v);
  if (!username) throw new BusinessError("Username wajib diisi");
  if (!USERNAME_RE.test(username)) {
    throw new BusinessError("Username 3–30 karakter, hanya huruf, angka, titik, atau garis bawah");
  }
  return username;
};

// Email wajib Gmail; disimpan huruf kecil
export const validateGmail = (v: unknown): string => {
  const email = cleanText(v).toLowerCase();
  if (!email) throw new BusinessError("Email wajib diisi");
  if (!GMAIL_RE.test(email)) {
    throw new BusinessError("Email harus alamat Gmail yang valid (contoh: nama@gmail.com)");
  }
  return email;
};

// Email pembeli untuk nota digital: opsional (kosong → null); disimpan huruf kecil
export const optionalEmail = (v: unknown, label = "Email pembeli"): string | null => {
  const email = cleanText(v).toLowerCase();
  if (!email) return null;
  if (email.length > CUSTOMER_EMAIL_MAX || !EMAIL_RE.test(email)) {
    throw new BusinessError(`${label} tidak valid (contoh: nama@gmail.com)`);
  }
  return email;
};

// Nomor WhatsApp opsional: "0812-3456 7890" / "+62 812…" / "812…" → "6281234567890"; kosong → null
export const optionalWhatsapp = (v: unknown): string | null => {
  const raw = cleanText(v);
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  else if (digits.startsWith("8")) digits = "62" + digits;
  if (!WHATSAPP_RE.test(digits)) {
    throw new BusinessError("Nomor WhatsApp harus nomor HP Indonesia (contoh: 0812 3456 7890)");
  }
  return digits;
};

export const validatePassword = (
  password: unknown,
  username?: string | null,
  label = "Password"
): string => {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    throw new BusinessError(`${label} minimal ${MIN_PASSWORD} karakter`);
  }
  if (password.length > MAX_PASSWORD) {
    throw new BusinessError(`${label} maksimal ${MAX_PASSWORD} karakter`);
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new BusinessError(`${label} harus mengandung huruf dan angka`);
  }
  if (username && password.toLowerCase() === username.toLowerCase()) {
    throw new BusinessError(`${label} tidak boleh sama dengan username`);
  }
  return password;
};

// ── Teks umum ────────────────────────────────────────────────────
export const requiredText = (v: unknown, label: string, min: number, max: number): string => {
  const s = squeeze(v);
  if (!s) throw new BusinessError(`${label} wajib diisi`);
  if (s.length < min || s.length > max) {
    throw new BusinessError(`${label} ${min}–${max} karakter`);
  }
  return s;
};

// Teks opsional: kosong → null
export const optionalText = (v: unknown, label: string, max: number): string | null => {
  const s = squeeze(v);
  if (s.length > max) throw new BusinessError(`${label} maksimal ${max} karakter`);
  return s || null;
};

// Nomor nota / resi / surat jalan
export const validateDocNumber = (v: unknown, label: string): string => {
  const s = cleanText(v);
  if (!s) throw new BusinessError(`${label} wajib diisi`);
  if (!DOC_NUMBER_RE.test(s)) {
    throw new BusinessError(`${label} 3–50 karakter, hanya huruf, angka, "-", "/", atau "." (tanpa spasi)`);
  }
  return s;
};

// ── Angka ────────────────────────────────────────────────────────
// Harga Rupiah bulat, Rp 1 – Rp 100 juta
export const isValidPrice = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= PRICE_MAX;

// Jumlah barang per input: 1 – 100.000
export const isValidQty = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= QTY_MAX;

// Stok awal: 0 – 100.000
export const isValidStock = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= QTY_MAX;

export const formatLimit = (n: number) => n.toLocaleString("id-ID");
