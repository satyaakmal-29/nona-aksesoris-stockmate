import crypto from "crypto";

// Enkripsi rahasia kecil yang disimpan di database (App Password Gmail toko).
// AES-256-GCM dengan kunci turunan SESSION_SECRET (.env). Jika SESSION_SECRET diganti,
// rahasia lama tidak bisa dibuka lagi → Super Admin cukup menyimpan ulang App Password.
const key = () =>
  crypto
    .createHash("sha256")
    .update(`stockmate:secret-box:${process.env.SESSION_SECRET || "ganti-dengan-secret-yang-kuat"}`)
    .digest();

export const encryptSecret = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
};

// null = tidak bisa dibuka (format salah atau SESSION_SECRET sudah berubah)
export const decryptSecret = (stored: string): string | null => {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
};
