"use client";

import { ChangeEvent, useRef, useState } from "react";
import QrisCode from "@/app/(components)/QrisCode";
import {
  useGetStoreSettingsQuery,
  useUpdateStoreSettingsMutation,
  useSendTestEmailMutation,
  StoreSettings,
} from "@/state/api";
import { decodeQrFromFile, previewQris, QrisPreview } from "@/lib/qris";
import FieldError from "@/app/(components)/FieldError";
import { MAX_LEN, appPasswordError, gmailError, normalizeAppPassword } from "@/lib/validation";
import {
  CheckCircleIcon, LandmarkIcon, MailIcon, QrCodeIcon, SendIcon, StoreIcon, Trash2Icon, UploadIcon,
} from "lucide-react";

const getErrorMessage = (err: unknown, fallback: string) => {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
};

// Saran isian nama bank (tetap boleh diketik bebas)
const BANK_OPTIONS = [
  "BCA", "BRI", "BNI", "Mandiri", "BSI", "BTN", "CIMB Niaga", "Permata",
  "Danamon", "SeaBank", "Bank Jago", "blu by BCA Digital",
];

// Sama dengan aturan server: spasi, titik, tanda hubung dibuang
const accountDigits = (v: string) => v.replace(/[\s.-]/g, "");

// Rekening: diisi ketiganya atau dikosongkan semua
const validateBank = (bankName: string, accountNumber: string, accountName: string) => {
  if (![bankName, accountNumber, accountName].some((v) => v.trim())) return "";
  if (!bankName.trim() || !accountDigits(accountNumber) || !accountName.trim()) {
    return "Lengkapi nama bank, nomor rekening, dan atas nama rekening";
  }
  if (!/^\d{5,20}$/.test(accountDigits(accountNumber))) return "Nomor rekening harus berupa angka (5–20 digit)";
  return "";
};

// Error per kolom rekening (untuk ditampilkan di bawah tiap input)
const bankFieldErrors = (bankName: string, accountNumber: string, accountName: string) => {
  const anyFilled = [bankName, accountNumber, accountName].some((v) => v.trim());
  const digits = accountDigits(accountNumber);
  return {
    bankName:      anyFilled && !bankName.trim() ? "Nama bank wajib diisi" : "",
    accountNumber: anyFilled && !digits ? "Nomor rekening wajib diisi"
      : digits && !/^\d{5,20}$/.test(digits) ? "Nomor rekening harus berupa angka (5–20 digit)" : "",
    accountName:   anyFilled && !accountName.trim() ? "Atas nama wajib diisi" : "",
  };
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
  const [bankName, setBankName]           = useState(settings.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(settings.bankAccountNumber ?? "");
  const [accountName, setAccountName]     = useState(settings.bankAccountName ?? "");
  const [confirmRemoveBank, setConfirmRemoveBank] = useState(false);
  // Email nota: App Password tidak pernah dikirim server, kolomnya selalu mulai kosong
  const [storeEmail, setStoreEmail]   = useState(settings.storeEmail ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [confirmRemoveEmail, setConfirmRemoveEmail] = useState(false);
  const [sendTestEmail, { isLoading: testing }] = useSendTestEmailMutation();
  const [testMessage, setTestMessage] = useState<Message>(null);
  // Error per kolom tampil setelah tombol simpan ditekan, lalu diperbarui saat mengetik
  const [showErrors, setShowErrors] = useState(false);
  const bankErrors = bankFieldErrors(bankName, accountNumber, accountName);
  // App Password wajib jika belum ada yang bisa dipakai, atau Gmail toko diganti
  const emailChanged = storeEmail.trim().toLowerCase() !== (settings.storeEmail ?? "");
  const needsAppPassword = !!storeEmail.trim() && (emailChanged || !settings.emailConfigured);
  const emailErrors = {
    storeEmail:  storeEmail.trim() ? gmailError(storeEmail) : appPassword.trim() ? "Isi Gmail toko" : "",
    appPassword: appPassword.trim() ? appPasswordError(appPassword)
      : needsAppPassword ? "Isi App Password untuk Gmail toko" : "",
  };
  const shown = (msg: string) => (showErrors ? msg : "");
  const errCss = (msg: string) => (shown(msg) ? "!border-red-400" : "");

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

  // clearBank: tombol "Hapus rekening" (ketiga data dikirim kosong)
  // clearEmail: tombol "Hapus email nota" (Gmail & App Password dihapus)
  const save = async (payload: { qrisPayload?: string | null; clearBank?: boolean; clearEmail?: boolean }) => {
    setMessage(null);
    if (!storeName.trim()) return setMessage({ type: "error", text: "Nama toko wajib diisi" });
    const { clearBank, clearEmail, ...rest } = payload;
    if (!clearBank && !clearEmail) {
      setShowErrors(true);
      const bankError = validateBank(bankName, accountNumber, accountName);
      if (bankError) return setMessage({ type: "error", text: bankError });
      const emailError = emailErrors.storeEmail || emailErrors.appPassword;
      if (emailError) return setMessage({ type: "error", text: emailError });
    }
    // Tombol hapus hanya mengirim bagian yang dihapus (isian lain yang belum disimpan tidak ikut)
    const bankPayload = clearEmail ? {} : {
      bankName:          clearBank ? "" : bankName.trim(),
      bankAccountNumber: clearBank ? "" : accountDigits(accountNumber),
      bankAccountName:   clearBank ? "" : accountName.trim(),
    };
    const emailPayload = clearEmail ? { storeEmail: "" } : clearBank ? {} : {
      storeEmail:      storeEmail.trim().toLowerCase(),
      smtpAppPassword: normalizeAppPassword(appPassword) || undefined,
    };
    try {
      await updateSettings({
        storeName:         storeName.trim(),
        storeAddress:      storeAddress.trim(),
        ...bankPayload,
        ...emailPayload,
        ...rest,
      }).unwrap();
      setQrisDraft("");
      setDraftInfo(null);
      setConfirmRemove(false);
      setConfirmRemoveBank(false);
      setConfirmRemoveEmail(false);
      setMessage({
        type: "success",
        text: payload.qrisPayload === null ? "QRIS toko dihapus"
          : clearBank ? "Rekening transfer dihapus"
          : clearEmail ? "Email nota dihapus"
          : payload.qrisPayload ? "QRIS toko disimpan"
          : "Pengaturan toko disimpan",
      });
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err, "Gagal menyimpan pengaturan toko") });
    }
  };

  const handleTestEmail = async () => {
    setTestMessage(null);
    try {
      const result = await sendTestEmail().unwrap();
      setTestMessage({ type: "success", text: result.message });
    } catch (err) {
      setTestMessage({ type: "error", text: getErrorMessage(err, "Email uji gagal dikirim") });
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-1 flex items-center gap-2">
        <StoreIcon className="h-5 w-5 text-blue-500" />
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Toko, QRIS, Rekening & Email Nota</h3>
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">Super Admin</span>
      </div>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        Nama & alamat tampil di struk. QRIS statis toko dipakai untuk membuat QRIS bernominal otomatis di setiap transaksi;
        dana langsung masuk ke QRIS toko. Rekening transfer ditampilkan kasir kepada pembeli yang membayar dengan Transfer.
        Gmail toko mengirim nota digital setiap transaksi lunas.
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

      {/* Rekening Transfer */}
      <div className={`mt-5 rounded-lg border p-4 ${isDarkMode ? "border-gray-700 bg-gray-900/40" : "border-gray-200 bg-gray-50"}`}>
        <div className="mb-2 flex items-center gap-2">
          <LandmarkIcon className="h-4 w-4 text-gray-500" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Rekening Transfer</p>
        </div>
        {settings.bankConfigured ? (
          <p className="mb-3 flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400">
            <CheckCircleIcon className="h-4 w-4" /> Rekening aktif — tampil di kasir saat pembeli memilih Transfer
          </p>
        ) : (
          <p className="mb-3 text-sm text-orange-600 dark:text-orange-400">Belum diatur — pembayaran Transfer di kasir belum bisa dipakai.</p>
        )}

        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="bank-name" className="mb-1 block text-sm text-gray-600 dark:text-gray-300">Nama bank</label>
            <input
              id="bank-name"
              type="text"
              list="bank-options"
              maxLength={40}
              placeholder="mis. BCA"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className={`${inputCss} ${errCss(bankErrors.bankName)}`}
            />
            <datalist id="bank-options">
              {BANK_OPTIONS.map((b) => <option key={b} value={b} />)}
            </datalist>
            <FieldError message={shown(bankErrors.bankName)} />
          </div>
          <div>
            <label htmlFor="bank-number" className="mb-1 block text-sm text-gray-600 dark:text-gray-300">Nomor rekening</label>
            <input
              id="bank-number"
              type="text"
              inputMode="numeric"
              maxLength={30}
              placeholder="mis. 1234567890"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className={`${inputCss} font-mono tracking-wide ${errCss(bankErrors.accountNumber)}`}
            />
            <FieldError message={shown(bankErrors.accountNumber)} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="bank-holder" className="mb-1 block text-sm text-gray-600 dark:text-gray-300">Atas nama</label>
            <input
              id="bank-holder"
              type="text"
              maxLength={60}
              placeholder="Nama pemilik rekening sesuai buku tabungan"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className={`${inputCss} ${errCss(bankErrors.accountName)}`}
            />
            <FieldError message={shown(bankErrors.accountName)} />
          </div>
        </div>

        {settings.bankConfigured && (
          !confirmRemoveBank ? (
            <button onClick={() => setConfirmRemoveBank(true)} className="mt-3 flex items-center gap-1 text-xs font-semibold text-red-500 hover:underline">
              <Trash2Icon className="h-3.5 w-3.5" /> Hapus rekening
            </button>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-red-500">Kasir tidak bisa menerima Transfer. Yakin?</span>
              <button onClick={() => save({ clearBank: true })} disabled={saving} className="rounded bg-red-500 px-2 py-1 font-semibold text-white">Ya, hapus</button>
              <button onClick={() => setConfirmRemoveBank(false)} className="font-semibold text-gray-500">Batal</button>
            </div>
          )
        )}
      </div>

      {/* Email Nota (Gmail toko) */}
      <div className={`mt-5 rounded-lg border p-4 ${isDarkMode ? "border-gray-700 bg-gray-900/40" : "border-gray-200 bg-gray-50"}`}>
        <div className="mb-2 flex items-center gap-2">
          <MailIcon className="h-4 w-4 text-gray-500" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Email Nota</p>
        </div>
        {settings.emailConfigured ? (
          <p className="mb-3 flex items-start gap-1 text-sm font-semibold text-green-600 dark:text-green-400">
            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            Email nota aktif — setiap transaksi lunas, nota dikirim dari {settings.storeEmail} (salinan masuk ke kotak masuk yang sama, dan ke pembeli bila emailnya diisi)
          </p>
        ) : settings.storeEmail && settings.emailPasswordSaved ? (
          <p className="mb-3 text-sm text-orange-600 dark:text-orange-400">
            App Password tersimpan tidak bisa dibaca (kunci server berubah). Isi ulang App Password lalu simpan.
          </p>
        ) : (
          <p className="mb-3 text-sm text-orange-600 dark:text-orange-400">Belum diatur — nota digital lewat email belum bisa dikirim.</p>
        )}

        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="store-email" className="mb-1 block text-sm text-gray-600 dark:text-gray-300">Gmail toko</label>
            <input
              id="store-email"
              type="email"
              maxLength={MAX_LEN.email}
              placeholder="nonaaksesoris@gmail.com"
              value={storeEmail}
              onChange={(e) => setStoreEmail(e.target.value)}
              className={`${inputCss} ${errCss(emailErrors.storeEmail)}`}
            />
            <FieldError message={shown(emailErrors.storeEmail)} />
          </div>
          <div>
            <label htmlFor="store-app-password" className="mb-1 block text-sm text-gray-600 dark:text-gray-300">App Password Gmail</label>
            <input
              id="store-app-password"
              type="password"
              autoComplete="new-password"
              maxLength={24}
              placeholder={settings.emailConfigured && !emailChanged ? "•••• tersimpan (isi untuk mengganti)" : "abcd efgh ijkl mnop"}
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              className={`${inputCss} font-mono ${errCss(emailErrors.appPassword)}`}
            />
            <FieldError message={shown(emailErrors.appPassword)} />
          </div>
        </div>

        <details className="mt-3 max-w-xl text-xs text-gray-600 dark:text-gray-300">
          <summary className="cursor-pointer font-semibold text-blue-600 dark:text-blue-400">Cara membuat App Password Gmail</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Login ke akun Gmail toko di browser.</li>
            <li>Buka <b>myaccount.google.com/security</b>, aktifkan <b>Verifikasi 2 Langkah</b> (wajib).</li>
            <li>Buka <b>myaccount.google.com/apppasswords</b>, ketik nama aplikasi &quot;StockMate&quot;, tekan <b>Buat</b>.</li>
            <li>Salin 16 huruf yang muncul ke kolom App Password di atas, lalu tekan <b>Simpan Pengaturan Toko</b>.</li>
            <li>Tekan <b>Kirim email uji</b> dan pastikan emailnya masuk ke Gmail toko.</li>
          </ol>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            App Password BUKAN password Gmail. Disimpan terenkripsi di server dan tidak pernah ditampilkan lagi.
          </p>
        </details>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {settings.emailConfigured && (
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testing}
              className="flex items-center gap-1.5 rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-60 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <SendIcon className="h-3.5 w-3.5" /> {testing ? "Mengirim..." : "Kirim email uji"}
            </button>
          )}
          {settings.storeEmail && (
            !confirmRemoveEmail ? (
              <button onClick={() => setConfirmRemoveEmail(true)} className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:underline">
                <Trash2Icon className="h-3.5 w-3.5" /> Hapus email nota
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-red-500">Nota tidak dikirim lewat email lagi. Yakin?</span>
                <button onClick={() => save({ clearEmail: true })} disabled={saving} className="rounded bg-red-500 px-2 py-1 font-semibold text-white">Ya, hapus</button>
                <button onClick={() => setConfirmRemoveEmail(false)} className="font-semibold text-gray-500">Batal</button>
              </div>
            )
          )}
        </div>
        {testMessage && (
          <p className={`mt-2 text-xs font-medium ${testMessage.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
            {testMessage.type === "success" ? "✓" : "✗"} {testMessage.text}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => save(draftInfo ? { qrisPayload: qrisDraft.trim() } : {})}
          disabled={saving || (!!qrisDraft.trim() && !draftInfo)}
          className="rounded-lg bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
        >
          {saving ? "Menyimpan..." : draftInfo ? "Simpan Toko & QRIS" : "Simpan Pengaturan Toko"}
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
