"use client";

import { ChangeEvent, useRef, useState } from "react";
import Image from "next/image";
import { CameraIcon, ExpandIcon, ImageOffIcon, XIcon } from "lucide-react";
import { compressProofImage } from "@/lib/imageCompress";

// ── Unggah foto bukti (nota, surat jalan, barang diterima) ─────────
type ProofImageInputProps = {
  label:      string;
  value:      string | null;
  onChange:   (v: string | null) => void;
  onError:    (msg: string) => void;
  isDarkMode: boolean;
  required?:  boolean;
  hint?:      string;
};

const ProofImageInput = ({
  label,
  value,
  onChange,
  onError,
  isDarkMode,
  required,
  hint,
}: ProofImageInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    try {
      onChange(await compressProofImage(file));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Gagal memproses gambar");
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="mb-3">
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      {value ? (
        <div className="flex items-start gap-3">
          <Image
            src={value}
            alt={label}
            width={96}
            height={96}
            unoptimized
            className="h-24 w-24 shrink-0 rounded-lg border object-cover dark:border-gray-600"
          />
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-left text-xs font-semibold text-blue-500 hover:underline"
            >
              Ganti foto
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex items-center gap-1 text-left text-xs font-semibold text-red-500 hover:underline"
            >
              <XIcon className="h-3 w-3" /> Hapus foto
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={processing}
          onClick={() => inputRef.current?.click()}
          className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed py-5 text-xs disabled:opacity-60 ${
            isDarkMode
              ? "border-gray-600 text-gray-400 hover:bg-gray-700/50"
              : "border-gray-300 text-gray-500 hover:bg-gray-50"
          }`}
        >
          <CameraIcon className="h-5 w-5" />
          {processing ? "Memproses foto..." : "Klik untuk unggah foto"}
        </button>
      )}

      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
};

// ── Tampilkan foto bukti (dipakai di modal "Lihat Bukti") ──────────
// Browser memblokir membuka data URL di tab baru, jadi ukuran penuh
// ditampilkan sebagai overlay di halaman yang sama.
export const ProofImageView = ({
  label,
  src,
}: {
  label: string;
  src?:  string | null;
}) => {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="mb-4">
      <p className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</p>
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label}
            onClick={() => setFullscreen(true)}
            className="max-h-96 w-full cursor-zoom-in rounded-lg border object-contain dark:border-gray-600"
          />
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="mt-1 inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
          >
            <ExpandIcon className="h-3 w-3" /> Lihat ukuran penuh
          </button>

          {fullscreen && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
              onClick={() => setFullscreen(false)}
            >
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                onClick={() => setFullscreen(false)}
              >
                <XIcon className="h-5 w-5" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={label} className="max-h-full max-w-full object-contain" />
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-4 text-xs text-gray-400 dark:bg-gray-700/50">
          <ImageOffIcon className="h-4 w-4" /> Belum ada foto
        </div>
      )}
    </div>
  );
};

export default ProofImageInput;
