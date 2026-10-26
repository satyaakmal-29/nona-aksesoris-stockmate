"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileTypeIcon,
} from "lucide-react";
import { ExportFormat } from "@/lib/reportExport";

// Tombol "Export" dengan pilihan CSV / Excel / PDF
type ExportMenuProps = {
  onExport:   (format: ExportFormat) => Promise<void> | void;
  disabled?:  boolean;
  isDarkMode: boolean;
};

const OPTIONS: Array<{ format: ExportFormat; label: string; desc: string; icon: React.ElementType; color: string }> = [
  { format: "xlsx", label: "Excel (.xlsx)", desc: "Tabel lengkap, bisa diolah",  icon: FileSpreadsheetIcon, color: "text-green-600" },
  { format: "pdf",  label: "PDF",           desc: "Siap cetak / dikirim",        icon: FileTextIcon,        color: "text-red-500" },
  { format: "csv",  label: "CSV",           desc: "Data mentah (tabel utama)",   icon: FileTypeIcon,        color: "text-blue-500" },
];

const ExportMenu = ({ onExport, disabled, isDarkMode }: ExportMenuProps) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Tutup saat klik di luar menu
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = async (format: ExportFormat) => {
    setOpen(false);
    setError("");
    setBusy(format);
    try {
      await onExport(format);
    } catch (err) {
      console.error("Export gagal:", err);
      setError("Gagal membuat file. Coba lagi.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={ref} className="relative print:hidden">
      <button
        type="button"
        disabled={disabled || busy !== null}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
      >
        <DownloadIcon className="h-3.5 w-3.5" />
        {busy ? "Menyiapkan file..." : "Export"}
        <ChevronDownIcon className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className={`absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border shadow-lg ${
            isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
          }`}
        >
          {OPTIONS.map(({ format, label, desc, icon: Icon, color }) => (
            <button
              key={format}
              type="button"
              onClick={() => handleSelect(format)}
              className={`flex w-full items-start gap-3 px-3 py-2.5 text-left ${
                isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"
              }`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
              <span>
                <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">{label}</span>
                <span className="block text-xs text-gray-400">{desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="absolute right-0 mt-1 whitespace-nowrap text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default ExportMenu;
