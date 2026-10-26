import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { BusinessError, sendError, cleanText } from "../lib/stockHelpers";
import { validateQris } from "../lib/qris";

const SETTINGS_ID = "default";

// Ambil pengaturan toko (buat baris default jika belum ada)
export const getStoreSettingsRow = async () =>
  prisma.storeSettings.upsert({
    where:  { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });

const toResponse = (
  s: Awaited<ReturnType<typeof getStoreSettingsRow>>,
  includePayload: boolean
) => ({
  storeName:      s.storeName,
  storeAddress:   s.storeAddress,
  qrisConfigured: !!s.qrisPayload,
  qrisMerchant:   s.qrisMerchant,
  qrisCity:       s.qrisCity,
  updatedAt:      s.updatedAt,
  // Kode QRIS statis hanya dikirim ke Super Admin (untuk pratinjau)
  ...(includePayload ? { qrisPayload: s.qrisPayload } : {}),
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

    await getStoreSettingsRow();
    const updated = await prisma.storeSettings.update({ where: { id: SETTINGS_ID }, data });
    res.json(toResponse(updated, true));
  } catch (error) {
    sendError(res, error, "Error updating store settings");
  }
};
