import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { BusinessError, sendError, cleanText } from "../lib/stockHelpers";
import { validateQris } from "../lib/qris";
import { APP_PASSWORD_RE, validateGmail } from "../lib/validation";
import { decryptSecret, encryptSecret } from "../lib/secretBox";
import { MailAccount, mailErrorMessage, sendMail } from "../lib/mailer";

const SETTINGS_ID = "default";

// Ambil pengaturan toko (buat baris default jika belum ada)
export const getStoreSettingsRow = async () =>
  prisma.storeSettings.upsert({
    where:  { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });

type SettingsRow = Awaited<ReturnType<typeof getStoreSettingsRow>>;

// Rekening Transfer dianggap siap hanya jika ketiga datanya terisi
export const isBankConfigured = (s: SettingsRow) =>
  !!(s.bankName && s.bankAccountNumber && s.bankAccountName);

// Akun Gmail pengirim nota; null = belum diatur / App Password tidak bisa dibuka
export const getMailAccount = (s: SettingsRow): MailAccount | null => {
  if (!s.storeEmail || !s.smtpPasswordEnc) return null;
  const pass = decryptSecret(s.smtpPasswordEnc);
  return pass ? { user: s.storeEmail, pass, senderName: s.storeName } : null;
};

export const EMAIL_NOT_READY =
  "Email toko belum diatur. Minta Super Admin mengisi Gmail toko & App Password di menu Pengaturan.";

const toResponse = (s: SettingsRow, includePayload: boolean) => ({
  storeName:      s.storeName,
  storeAddress:   s.storeAddress,
  qrisConfigured: !!s.qrisPayload,
  qrisMerchant:   s.qrisMerchant,
  qrisCity:       s.qrisCity,
  // Rekening Transfer dikirim ke semua peran (kasir menampilkannya ke pembeli)
  bankConfigured:    isBankConfigured(s),
  bankName:          s.bankName,
  bankAccountNumber: s.bankAccountNumber,
  bankAccountName:   s.bankAccountName,
  // Email nota: kasir hanya perlu tahu siap/tidak; App Password TIDAK pernah dikirim
  emailConfigured:   !!getMailAccount(s),
  storeEmail:        s.storeEmail,
  updatedAt:      s.updatedAt,
  // Kode QRIS statis & status App Password hanya dikirim ke Super Admin
  ...(includePayload ? { qrisPayload: s.qrisPayload, emailPasswordSaved: !!s.smtpPasswordEnc } : {}),
});

// ─── GET /settings/store (semua peran) ───────────────────────────
export const getStoreSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await getStoreSettingsRow();
    res.json(toResponse(settings, req.session.role === "super_admin"));
  } catch (error) {
    sendError(res, error, "Error retrieving store settings");
  }
};

// ─── PUT /settings/store (Super Admin) ───────────────────────────
// qrisPayload: string = simpan QRIS statis baru, null = hapus, tidak dikirim = tetap
// bankName/bankAccountNumber/bankAccountName: dikirim bersama; semua kosong = hapus rekening,
// tidak dikirim = tetap
// storeEmail: "" = hapus email nota (beserta App Password), tidak dikirim = tetap.
// smtpAppPassword wajib saat pertama kali / saat Gmail diganti; kosong = pakai yang tersimpan.
export const updateStoreSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body ?? {};
    const data: Record<string, unknown> = { updatedById: req.session.userId! };

    if (body.storeName !== undefined) {
      const name = cleanText(body.storeName);
      if (!name) throw new BusinessError("Nama toko wajib diisi");
      if (name.length > 60) throw new BusinessError("Nama toko maksimal 60 karakter");
      data.storeName = name;
    }
    if (body.storeAddress !== undefined) {
      const address = cleanText(body.storeAddress);
      if (address.length > 120) throw new BusinessError("Alamat toko maksimal 120 karakter");
      data.storeAddress = address;
    }

    if (body.qrisPayload === null || body.qrisPayload === "") {
      data.qrisPayload = null;
      data.qrisMerchant = null;
      data.qrisCity = null;
    } else if (body.qrisPayload !== undefined) {
      const payload = cleanText(body.qrisPayload);
      let info;
      try {
        info = validateQris(payload);
      } catch (e) {
        throw new BusinessError(e instanceof Error ? e.message : "Kode QRIS tidak valid");
      }
      if (info.isDynamic || info.hasAmount) {
        throw new BusinessError(
          "Gunakan QRIS statis toko (yang tercetak, tanpa nominal), bukan QR yang sudah berisi nominal."
        );
      }
      data.qrisPayload = payload;
      data.qrisMerchant = info.merchantName;
      data.qrisCity = info.merchantCity;
    }

    if (
      body.bankName !== undefined ||
      body.bankAccountNumber !== undefined ||
      body.bankAccountName !== undefined
    ) {
      const bankName = cleanText(body.bankName);
      // Spasi, titik, dan tanda hubung dibuang (mis. "123-456 789" → "123456789")
      const accountNumber = cleanText(body.bankAccountNumber).replace(/[\s.-]/g, "");
      const accountName = cleanText(body.bankAccountName);

      if (!bankName && !accountNumber && !accountName) {
        data.bankName = null;
        data.bankAccountNumber = null;
        data.bankAccountName = null;
      } else {
        if (!bankName || !accountNumber || !accountName) {
          throw new BusinessError("Lengkapi nama bank, nomor rekening, dan atas nama rekening");
        }
        if (bankName.length > 40) throw new BusinessError("Nama bank maksimal 40 karakter");
        if (!/^\d{5,20}$/.test(accountNumber)) {
          throw new BusinessError("Nomor rekening harus berupa angka (5–20 digit)");
        }
        if (accountName.length > 60) throw new BusinessError("Nama pemilik rekening maksimal 60 karakter");
        data.bankName = bankName;
        data.bankAccountNumber = accountNumber;
        data.bankAccountName = accountName;
      }
    }

    const current = await getStoreSettingsRow();

    if (body.storeEmail !== undefined) {
      if (!cleanText(body.storeEmail)) {
        data.storeEmail = null;
        data.smtpPasswordEnc = null;
      } else {
        // Pengiriman memakai server Gmail → email toko wajib Gmail
        const email = validateGmail(body.storeEmail);
        const appPassword = cleanText(body.smtpAppPassword).replace(/\s+/g, "").toLowerCase();
        if (appPassword) {
          if (!APP_PASSWORD_RE.test(appPassword)) {
            throw new BusinessError("App Password harus 16 huruf (contoh: abcd efgh ijkl mnop)");
          }
          data.smtpPasswordEnc = encryptSecret(appPassword);
        } else if (!current.smtpPasswordEnc || current.storeEmail !== email) {
          throw new BusinessError("Isi App Password untuk Gmail toko");
        }
        data.storeEmail = email;
      }
    }

    const updated = await prisma.storeSettings.update({ where: { id: SETTINGS_ID }, data });
    res.json(toResponse(updated, true));
  } catch (error) {
    sendError(res, error, "Error updating store settings");
  }
};

// ─── POST /settings/store/test-email (Super Admin) ───────────────
// Kirim email uji ke Gmail toko untuk memastikan App Password benar & internet tersambung
export const sendTestEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await getStoreSettingsRow();
    const account = getMailAccount(settings);
    if (!account) {
      throw new BusinessError(
        settings.smtpPasswordEnc
          ? "App Password tersimpan tidak bisa dibaca. Simpan ulang App Password."
          : "Simpan Gmail toko & App Password terlebih dahulu"
      );
    }
    const text =
      `Pengaturan email nota ${settings.storeName} berhasil.\n` +
      "Nota setiap transaksi lunas akan dikirim dari alamat ini, dan salinannya masuk ke kotak masuk ini.";
    try {
      await sendMail(account, {
        to:      account.user,
        subject: `Email uji - ${settings.storeName}`,
        text,
        html:    `<p style="font-family:Arial,Helvetica,sans-serif">${text.replace(/\n/g, "<br>")}</p>`,
      });
    } catch (err) {
      console.error("Email uji gagal:", err);
      throw new BusinessError(mailErrorMessage(err));
    }
    res.json({ message: `Email uji terkirim ke ${account.user}. Periksa kotak masuk Gmail toko.` });
  } catch (error) {
    sendError(res, error, "Error sending test email");
  }
};
