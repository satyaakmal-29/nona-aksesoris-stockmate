"use client";

import { ChangeEvent, useRef, useState } from "react";
import QrisCode from "@/app/(components)/QrisCode";
import {
  useGetStoreSettingsQuery,
  useUpdateStoreSettingsMutation,
  StoreSettings,
} from "@/state/api";
import { decodeQrFromFile, previewQris, QrisPreview } from "@/lib/qris";
import { CheckCircleIcon, QrCodeIcon, StoreIcon, Trash2Icon, UploadIcon } from "lucide-react";

const getErrorMessage = (err: unknown, fallback: string) => {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
};

// Form diisi dari data server; dipisah agar state awal langsung benar (tanpa useEffect)
type Message = { type: "success" | "error"; text: string } | null;

const StoreSettingsForm = ({
  settings, isDarkMode, message, setMessage,
}: {
  settings: StoreSettings;
  isDarkMode: boolean;
  message: Message;
  setMessage: (m: Message) => void;
}) => {
  const [updateSettings, { isLoading: saving }] = useUpdateStoreSettingsMutation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [storeName, setStoreName]       = useState(settings.storeName);
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress);
  const [qrisDraft, setQrisDraft]       = useState("");
  const [draftInfo, setDraftInfo]       = useState<QrisPreview | null>(null);
  const [reading, setReading]           = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const inputCss = `w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${
    isDarkMode ? "border-gray-600 bg-gray-700 text-gray-100" : "border-gray-300 bg-white text-gray-900"
  }`;

  const checkDraft = (text: string) => {
    setQrisDraft(text);
    setMessage(null);
    if (!text.trim()) { setDraftInfo(null); return; }
    try {
      const info = previewQris(text);
      if (info.isDynamic || info.hasAmount) {
        setDraftInfo(null);
        setMessage({ type: "error", text: "Ini QR bernominal / dinamis. Gunakan QRIS statis toko (stiker QRIS tanpa nominal)." });
        return;
      }
      setDraftInfo(info);
    } catch (e) {
      setDraftInfo(null);
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Kode QRIS tidak valid" });
    }
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setReading(true);
    setMessage(null);
    try {
      checkDraft(await decodeQrFromFile(file));
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Gagal membaca QR" });
    } finally {
      setReading(false);
    }
  };

  const save = async (payload: { qrisPayload?: string | null }) => {
    setMessage(null);
    if (!storeName.trim()) return setMessage({ type: "error", text: "Nama toko wajib diisi" });
    try {
      await updateSettings({ storeName: storeName.trim(), storeAddress: storeAddress.trim(), ...payload }).unwrap();
      setQrisDraft("");
      setDraftInfo(null);
      setConfirmRemove(false);
      setMessage({
        type: "success",
        text: payload.qrisPayload === null ? "QRIS toko dihapus" : payload.qrisPayload ? "QRIS toko disimpan" : "Pengaturan toko disimpan",
      });
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err, "Gagal menyimpan pengaturan toko") });
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-1 flex items-center gap-2">
        <StoreIcon className="h-5 w-5 text-blue-500" />
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Toko & QRIS</h3>
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">Super Admin</span>
      </div>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        Nama & alamat tampil di struk. QRIS statis toko dipakai untuk membuat QRIS bernominal otomatis di setiap transaksi;
        dana langsung masuk ke QRIS toko.
      </p>

      <div className="grid max-w-xl gap-3">
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">Nama toko</label>
          <input type="text" maxLength={60} value={storeName} onChange={(e) => setStoreName(e.target.value)} className={inputCss} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">Alamat toko (untuk struk)</label>
          <input type="text" maxLength={120} value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} className={inputCss} />
        </div>
      </div>

      {/* QRIS saat ini */}
      <div className={`mt-5 rounded-lg border p-4 ${isDarkMode ? "border-gray-700 bg-gray-900/40" : "border-gray-200 bg-gray-50"}`}>
        <div className="mb-3 flex items-center gap-2">
          <QrCodeIcon className="h-4 w-4 text-gray-500" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">QRIS Toko</p>
        </div>
        {settings.qrisConfigured && settings.qrisPayload ? (
          <div className="flex flex-wrap items-start gap-4">
            <QrisCode payload={settings.qrisPayload} size={140} />
            <div className="text-sm">
              <p className="flex items-center gap-1 font-semibold text-green-600 dark:text-green-400">
                <CheckCircleIcon className="h-4 w-4" /> QRIS aktif
              </p>
              <p className="mt-1 text-gray-700 dark:text-gray-300">Merchant: <span className="font-semibold">{settings.qrisMerchant}</span></p>
              <p className="text-gray-500 dark:text-gray-400">Kota: {settings.qrisCity}</p>
              {!confirmRemove ? (
                <button onClick={() => setConfirmRemove(true)} className="mt-3 flex items-center gap-1 text-xs font-semibold text-red-500 hover:underline">
                  <Trash2Icon className="h-3.5 w-3.5" /> Hapus QRIS
                </button>
              ) : (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="text-red-500">Kasir tidak bisa menerima QRIS. Yakin?</span>
                  <button onClick={() => save({ qrisPayload: null })} disabled={saving} className="rounded bg-red-500 px-2 py-1 font-semibold text-white">Ya, hapus</button>
                  <button onClick={() => setConfirmRemove(false)} className="font-semibold text-gray-500">Batal</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-orange-600 dark:text-orange-400">Belum diatur — pembayaran QRIS di kasir belum bisa dipakai.</p>
        )}

        {/* Ganti / pasang QRIS */}
        <div className="mt-4 border-t pt-4 dark:border-gray-700">
          <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
            {settings.qrisConfigured ? "Ganti QRIS" : "Pasang QRIS"}: unggah foto stiker QRIS toko, atau tempel kode QRIS
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={reading}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-60 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <UploadIcon className="h-3.5 w-3.5" /> {reading ? "Membaca QR..." : "Unggah foto QRIS"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
          <textarea
            value={qrisDraft}
            onChange={(e) => checkDraft(e.target.value)}
            rows={3}
            placeholder="000201010211..."
            className={`${inputCss} mt-2 font-mono text-xs`}
          />
          {draftInfo && (
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircleIcon className="h-4 w-4" />
              <span>QRIS valid — merchant <b>{draftInfo.merchantName}</b>, {draftInfo.merchantCity}. Pastikan nama merchant sesuai toko.</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => save(draftInfo ? { qrisPayload: qrisDraft.trim() } : {})}
          disabled={saving || (!!qrisDraft.trim() && !draftInfo)}
          className="rounded-lg bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
        >
          {saving ? "Menyimpan..." : draftInfo ? "Simpan Toko & QRIS" : "Simpan Toko"}
        </button>
        {message && (
          <span className={`text-sm font-medium ${message.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
            {message.type === "success" ? "✓" : "✗"} {message.text}
          </span>
        )}
      </div>
    </div>
  );
};

const StoreSettingsSection = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const { data, isLoading, isError } = useGetStoreSettingsQuery();
  // Pesan disimpan di sini agar tidak hilang saat form dibuat ulang setelah simpan
  const [message, setMessage] = useState<Message>(null);
  if (isLoading) return <div className="mt-8 h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />;
  if (isError || !data) return <p className="mt-8 text-sm text-red-500">Gagal memuat pengaturan toko</p>;
  // key: form dibuat ulang saat data server berubah (mis. setelah simpan)
  return (
    <StoreSettingsForm key={data.updatedAt} settings={data} isDarkMode={isDarkMode} message={message} setMessage={setMessage} />
  );
};

export default StoreSettingsSection;
