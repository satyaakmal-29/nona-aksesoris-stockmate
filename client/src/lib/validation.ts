// Aturan validasi form. Nilai & pesan HARUS sama dengan server/src/lib/validation.ts
// (server tetap penentu akhir; di sini agar kesalahan terlihat sebelum dikirim).
// Setiap fungsi mengembalikan pesan error, atau "" jika valid.

export const MIN_PASSWORD     = 6;
export const MAX_PASSWORD     = 72;
export const PRICE_MAX        = 100_000_000;
export const QTY_MAX          = 100_000;
export const TRX_QTY_MAX      = 999;
export const CASH_OVERPAY_MAX = 1_000_000;
export const EXPENSE_MAX      = 100_000_000;

// Panjang maksimal kolom teks (juga dipakai sebagai maxLength input)
export const MAX_LEN = {
  personName:   50,
  username:     30,
  email:        74, // 64 karakter + "@gmail.com"
  productName:  100,
  description:  500,
  category:     40,
  variantName:  50,
  variantSize:  30,
  docNumber:    50,
  supplier:     60,
  courier:      60,
  customerName: 50,
  customerEmail: 100,
  note:         200,
} as const;

const USERNAME_RE    = /^[a-zA-Z0-9._]{3,30}$/;
const GMAIL_RE       = /^[a-z0-9._%+-]{1,64}@gmail\.com$/;
// Email pembeli boleh selain Gmail (yahoo, outlook, email kantor, dll.)
const EMAIL_RE       = /^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
// App Password Google: 16 huruf (spasi pemisah kelompok dibuang)
const APP_PASSWORD_RE = /^[a-z]{16}$/;
// Nomor HP Indonesia format internasional tanpa "+": 628 + 8–11 digit
const WHATSAPP_RE = /^628\d{8,11}$/;
const PERSON_NAME_RE = /^[\p{L} .']{3,50}$/u;
const DOC_NUMBER_RE  = /^[A-Za-z0-9./-]{3,50}$/;

export const formatLimit = (n: number) => n.toLocaleString("id-ID");

// Spasi di ujung dibuang, spasi ganda jadi satu (sama dengan server)
export const squeeze = (v: string) => v.trim().replace(/\s+/g, " ");

// ── Akun ─────────────────────────────────────────────────────────
export const personNameError = (v: string, label = "Nama") => {
  const s = squeeze(v);
  if (!s) return `${label} wajib diisi`;
  return PERSON_NAME_RE.test(s) ? "" : `${label} 3–50 karakter, hanya huruf, spasi, titik, atau apostrof`;
};

export const usernameError = (v: string) => {
  const s = v.trim();
  if (!s) return "Username wajib diisi";
  return USERNAME_RE.test(s) ? "" : "Username 3–30 karakter, hanya huruf, angka, titik, atau garis bawah";
};

export const gmailError = (v: string) => {
  const s = v.trim().toLowerCase();
  if (!s) return "Email wajib diisi";
  return GMAIL_RE.test(s) ? "" : "Email harus alamat Gmail yang valid (contoh: nama@gmail.com)";
};

// Email pembeli (nota digital): opsional
export const customerEmailError = (v: string, label = "Email pembeli") => {
  const s = v.trim().toLowerCase();
  if (!s) return "";
  return s.length <= MAX_LEN.customerEmail && EMAIL_RE.test(s) ? "" : `${label} tidak valid (contoh: nama@gmail.com)`;
};

// App Password Gmail toko: "abcd efgh ijkl mnop" → "abcdefghijklmnop"
export const normalizeAppPassword = (v: string) => v.replace(/\s+/g, "").toLowerCase();
export const appPasswordError = (v: string) =>
  APP_PASSWORD_RE.test(normalizeAppPassword(v)) ? "" : "App Password harus 16 huruf (contoh: abcd efgh ijkl mnop)";

// Nomor WhatsApp (opsional): "0812-3456 7890" / "+62 812…" / "812…" → "6281234567890"
export const normalizeWhatsapp = (v: string) => {
  const digits = v.replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("8")) return "62" + digits;
  return digits;
};
export const whatsappError = (v: string) =>
  !v.trim() || WHATSAPP_RE.test(normalizeWhatsapp(v))
    ? ""
    : "Nomor WhatsApp harus nomor HP Indonesia (contoh: 0812 3456 7890)";

export const passwordError = (pw: string, username?: string, label = "Password") => {
  if (pw.length < MIN_PASSWORD) return `${label} minimal ${MIN_PASSWORD} karakter`;
  if (pw.length > MAX_PASSWORD) return `${label} maksimal ${MAX_PASSWORD} karakter`;
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return `${label} harus mengandung huruf dan angka`;
  if (username?.trim() && pw.toLowerCase() === username.trim().toLowerCase()) {
    return `${label} tidak boleh sama dengan username`;
  }
  return "";
};

export const confirmPasswordError = (pw: string, confirm: string) =>
  !confirm ? "Ulangi password" : pw !== confirm ? "Konfirmasi password tidak sama" : "";

// Keterangan aturan password untuk ditampilkan di bawah input
export const PASSWORD_HINT = `Minimal ${MIN_PASSWORD} karakter, berisi huruf dan angka, tidak sama dengan username.`;

// ── Teks umum ────────────────────────────────────────────────────
export const requiredTextError = (v: string, label: string, min: number, max: number) => {
  const s = squeeze(v);
  if (!s) return `${label} wajib diisi`;
  return s.length < min || s.length > max ? `${label} ${min}–${max} karakter` : "";
};

export const optionalTextError = (v: string, label: string, max: number) =>
  squeeze(v).length > max ? `${label} maksimal ${max} karakter` : "";

export const docNumberError = (v: string, label: string) => {
  const s = v.trim();
  if (!s) return `${label} wajib diisi`;
  return DOC_NUMBER_RE.test(s) ? "" : `${label} 3–50 karakter, hanya huruf, angka, "-", "/", atau "." (tanpa spasi)`;
};

// ── Angka ────────────────────────────────────────────────────────
export const priceError = (v: number, label = "Harga") =>
  Number.isInteger(v) && v >= 1 && v <= PRICE_MAX ? "" : `${label} harus Rp 1 – Rp ${formatLimit(PRICE_MAX)}`;

export const qtyError = (v: number, label = "Jumlah", max = QTY_MAX) =>
  Number.isInteger(v) && v >= 1 && v <= max ? "" : `${label} harus bilangan bulat 1 – ${formatLimit(max)}`;

export const stockError = (v: number, label: string) =>
  Number.isInteger(v) && v >= 0 && v <= QTY_MAX ? "" : `${label} harus bilangan bulat 0 – ${formatLimit(QTY_MAX)}`;
