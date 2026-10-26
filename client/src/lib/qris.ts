// client/src/lib/qris.ts
// Membaca QRIS dari foto (jsQR) dan pengecekan awal kode QRIS di browser.
// Validasi final & pembuatan QRIS dinamis tetap dilakukan server.

// CRC-16/CCITT-FALSE, sama dengan server/src/lib/qris.ts
const crc16 = (data: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

export type QrisPreview = {
  merchantName: string;
  merchantCity: string;
  isDynamic:    boolean;
  hasAmount:    boolean;
};

// Pengecekan awal agar user langsung tahu jika kode salah. Melempar Error berpesan.
export const previewQris = (raw: string): QrisPreview => {
  const payload = raw.trim();
  if (!payload.startsWith("000201")) throw new Error("Bukan kode QRIS (harus diawali 000201)");

  const fields = new Map<string, string>();
  let i = 0;
  let lastId = "";
  while (i < payload.length) {
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || Number.isNaN(len)) throw new Error("Struktur kode QRIS rusak");
    const value = payload.slice(i + 4, i + 4 + len);
    if (value.length !== len) throw new Error("Panjang data QRIS tidak sesuai");
    fields.set(id, value);
    lastId = id;
    i += 4 + len;
  }
  if (lastId !== "63") throw new Error("Kode QRIS tidak memiliki checksum");
  if (crc16(payload.slice(0, -4)) !== payload.slice(-4).toUpperCase()) {
    throw new Error("Checksum QRIS tidak cocok. Pastikan kode lengkap.");
  }

  return {
    merchantName: fields.get("59") ?? "-",
    merchantCity: fields.get("60") ?? "-",
    isDynamic:    fields.get("01") === "12",
    hasAmount:    fields.has("54"),
  };
};

// Baca isi QR dari foto (mis. foto stiker QRIS toko). Mengembalikan teks QR.
export const decodeQrFromFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("File harus berupa gambar"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak dapat dibaca"));
    };
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const { default: jsQR } = await import("jsqr");

      // Coba beberapa ukuran: foto kamera besar kadang lebih mudah dibaca setelah diperkecil
      const sizes = [1000, 1600, 700, Math.max(img.width, img.height)];
      for (const max of sizes) {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) break;
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        const code = jsQR(data.data, w, h, { inversionAttempts: "attemptBoth" });
        if (code?.data) {
          resolve(code.data);
          return;
        }
      }
      reject(new Error("QR tidak terdeteksi. Gunakan foto yang lebih jelas, lurus, dan tidak terpotong."));
    };
    img.src = url;
  });
