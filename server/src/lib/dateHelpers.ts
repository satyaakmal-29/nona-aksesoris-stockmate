// Tanggal menurut zona waktu lokal server (Asia/Jakarta).
// new Date("YYYY-MM-DD") = 00:00 UTC (07:00 WIB), sehingga filter tanggal
// akhir memotong data setelah jam 7 pagi. Selalu pakai helper ini.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const startOfLocalDay = (isoDate: string): Date | null => {
  if (!ISO_DATE.test(isoDate)) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const endOfLocalDay = (isoDate: string): Date | null => {
  if (!ISO_DATE.test(isoDate)) return null;
  const d = new Date(`${isoDate}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Filter Prisma { gte, lte } dari query ?startDate=&endDate= (YYYY-MM-DD).
// Mengembalikan null jika format salah; {} jika keduanya kosong.
export const localDateRange = (
  startDate?: string,
  endDate?: string
): { gte?: Date; lte?: Date } | null => {
  const range: { gte?: Date; lte?: Date } = {};
  if (startDate) {
    const gte = startOfLocalDay(startDate);
    if (!gte) return null;
    range.gte = gte;
  }
  if (endDate) {
    const lte = endOfLocalDay(endDate);
    if (!lte) return null;
    range.lte = lte;
  }
  return range;
};

// "YYYY-MM-DD" lokal dari Date
export const toLocalISODate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const startOfMonth = (d: Date, offsetMonths = 0): Date =>
  new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1);

export const startOfDay = (d: Date, offsetDays = 0): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays);

export const formatRupiah = (n: number): string =>
  "Rp " + Math.round(n).toLocaleString("id-ID");
