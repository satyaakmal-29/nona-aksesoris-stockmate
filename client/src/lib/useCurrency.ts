// Format angka ke Rupiah (IDR).
// Nilai di database diperlakukan sudah dalam Rupiah (tanpa konversi kurs).

export const formatCurrency = (
  amount: number | undefined | null,
  compact = false
): string => {
  // Guard: jika amount bukan angka valid, return "-"
  if (amount == null || isNaN(amount) || typeof amount !== "number") return "-";

  const value = Math.round(amount);

  if (compact && value >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  }
  if (compact && value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
};

// Dipertahankan agar semua pemanggil `useCurrency()` tidak perlu diubah
export const useCurrency = () => ({ formatCurrency });