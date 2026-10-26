// client/src/lib/imageCompress.ts
// Kompres gambar di klien sebelum dikirim sebagai data URL (base64).

// Batas panjang data URL, sama dengan requireImage di server
export const MAX_IMAGE_DATA_URL = 4_000_000;

// Batas ukuran file asli sebelum dikompres
const MAX_PROOF_FILE_SIZE = 10 * 1024 * 1024;

// Kompres gambar & ubah ke base64 (algoritma sama dengan ProductFormModal)
export const compressImage = (
  file: File,
  maxSize: number,
  quality: number
): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.onloadend = () => {
      const img = document.createElement("img");
      img.onerror = () => reject(new Error("File bukan gambar yang valid"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
        } else {
          if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
        }
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

// Foto bukti (nota, surat jalan, barang diterima) perlu resolusi lebih besar
// agar tulisannya tetap terbaca. Jika hasilnya masih terlalu besar, dicoba
// sekali lagi dengan ukuran & kualitas lebih rendah.
export const compressProofImage = async (file: File): Promise<string> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar");
  }
  if (file.size > MAX_PROOF_FILE_SIZE) {
    throw new Error("Ukuran foto maksimal 10MB");
  }

  const first = await compressImage(file, 1200, 0.7);
  if (first.length <= MAX_IMAGE_DATA_URL) return first;

  const second = await compressImage(file, 1000, 0.5);
  if (second.length <= MAX_IMAGE_DATA_URL) return second;

  throw new Error("Foto terlalu besar. Gunakan foto dengan resolusi lebih kecil.");
};
