// QRIS (standar EMVCo Merchant-Presented QR, format TLV: ID 2 digit + panjang 2 digit + nilai).
// Dipakai untuk mengubah QRIS STATIS milik toko menjadi QRIS DINAMIS berisi nominal,
// sehingga pembeli tidak perlu mengetik jumlah. Dana tetap masuk ke merchant toko
// (tidak lewat payment gateway); konfirmasi lunas dilakukan kasir.

export type TlvField = { id: string; value: string };

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — dipakai tag 63 QRIS
export const crc16 = (data: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

export const parseTlv = (payload: string): TlvField[] => {
  const fields: TlvField[] = [];
  let i = 0;
  while (i < payload.length) {
    const id = payload.slice(i, i + 2);
    const lenStr = payload.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lenStr)) {
      throw new Error("Format QRIS tidak valid (struktur data rusak)");
    }
    const len = Number(lenStr);
    const value = payload.slice(i + 4, i + 4 + len);
    if (value.length !== len) throw new Error("Format QRIS tidak valid (panjang data tidak sesuai)");
    fields.push({ id, value });
    i += 4 + len;
  }
  return fields;
};

const buildTlv = (fields: TlvField[]): string =>
  fields.map((f) => `${f.id}${String(f.value.length).padStart(2, "0")}${f.value}`).join("");

export type QrisInfo = {
  merchantName: string;
  merchantCity: string;
  isDynamic:    boolean;
  hasAmount:    boolean;
};

// Validasi QRIS statis/dinamis & ambil info merchant. Melempar Error berpesan jelas.
export const validateQris = (raw: string): QrisInfo => {
  const payload = raw.trim();
  if (!payload.startsWith("000201")) {
    throw new Error("Bukan kode QRIS (harus diawali 000201)");
  }
  if (payload.length > 512) throw new Error("Kode QRIS terlalu panjang");

  const fields = parseTlv(payload);
  const last = fields[fields.length - 1];
  if (!last || last.id !== "63" || last.value.length !== 4) {
    throw new Error("Kode QRIS tidak memiliki checksum (tag 63)");
  }
  const expected = crc16(payload.slice(0, payload.length - 4));
  if (expected !== last.value.toUpperCase()) {
    throw new Error("Checksum QRIS tidak cocok. Pastikan kode disalin lengkap tanpa perubahan.");
  }

  const get = (id: string) => fields.find((f) => f.id === id)?.value;
  if (get("53") !== "360") throw new Error("Mata uang QRIS bukan Rupiah (360)");
  if (get("58") !== "ID") throw new Error("QRIS bukan merchant Indonesia");

  const hasMerchantAccount = fields.some((f) => Number(f.id) >= 26 && Number(f.id) <= 51);
  if (!hasMerchantAccount) throw new Error("QRIS tidak memiliki informasi akun merchant");

  return {
    merchantName: get("59") ?? "-",
    merchantCity: get("60") ?? "-",
    isDynamic:    get("01") === "12",
    hasAmount:    !!get("54"),
  };
};

// Buat QRIS dinamis dengan nominal tertentu dari QRIS toko.
export const buildDynamicQris = (staticPayload: string, amount: number): string => {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 9_999_999_999) {
    throw new Error("Nominal QRIS tidak valid");
  }
  validateQris(staticPayload);

  const fields = parseTlv(staticPayload.trim()).filter(
    (f) => f.id !== "63" && f.id !== "54" && f.id !== "01"
  );
  fields.push({ id: "01", value: "12" });                 // 12 = dinamis (sekali pakai)
  fields.push({ id: "54", value: String(amount) });       // nominal Rupiah tanpa desimal
  fields.sort((a, b) => Number(a.id) - Number(b.id));     // 00 selalu pertama, 63 ditambah terakhir

  const body = `${buildTlv(fields)}6304`;
  return body + crc16(body);
};
