"use client";

import { useState } from "react";
import { useAppSelector } from "@/app/redux";
import { useGetStoreSettingsQuery, useGetWaContactsQuery } from "@/state/api";
import { WA_ROLE_LABELS, WaNotice, composeWaMessage, formatWhatsapp, waLink } from "@/lib/whatsapp";
import { CheckIcon, CopyIcon, MessageCircleIcon, SendIcon, XIcon } from "lucide-react";

// Modal "Kirim via WhatsApp": daftar penerima (peran sesuai tahap PO / Store Replenishment)
// dengan tombol wa.me berisi pesan siap kirim. Tanpa gateway: pengguna menekan Kirim di WhatsApp.
const WhatsAppNotifyModal = ({ notice, onClose }: { notice: WaNotice; onClose: () => void }) => {
  const isDarkMode = useAppSelector((s) => s.global.isDarkMode);
  const { data: contacts, isLoading, isError } = useGetWaContactsQuery(notice.roles.join(","));
  const { data: store } = useGetStoreSettingsQuery();
  const [opened, setOpened] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const message = composeWaMessage(notice, store?.storeName ?? "Nona Aksesoris", origin);
  const roleText = notice.roles.map((r) => WA_ROLE_LABELS[r] ?? r).join(" & ");

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard tidak tersedia: pesan tetap bisa diseleksi manual dari pratinjau
    }
  };

  const muted = isDarkMode ? "text-gray-400" : "text-gray-500";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-5 shadow-2xl ${
          isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-bold">
            <MessageCircleIcon className="h-5 w-5 text-green-500" /> Kirim Notifikasi via WhatsApp
          </h3>
          <button onClick={onClose} aria-label="Tutup"><XIcon className="h-5 w-5 text-gray-400" /></button>
        </div>
        <p className={`mb-4 text-sm ${muted}`}>
          <b className={isDarkMode ? "text-gray-200" : "text-gray-700"}>{notice.title}.</b> Beri tahu {roleText}:
        </p>

        {isLoading && <p className={`py-3 text-sm ${muted}`}>Memuat kontak...</p>}
        {isError && <p className="py-3 text-sm text-red-500">Gagal memuat kontak WhatsApp</p>}
        {contacts && contacts.length === 0 && (
          <p className="mb-4 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
            Belum ada {roleText} yang mengisi nomor WhatsApp. Nomor diisi di menu <b>Pengaturan</b> (profil masing-masing)
            atau oleh Super Admin di menu <b>Pengguna</b>. Pesan di bawah tetap bisa disalin.
          </p>
        )}
        {contacts && contacts.length > 0 && (
          <ul className="mb-4 space-y-2">
            {contacts.map((c) => {
              const done = opened.includes(c.userId);
              return (
                <li
                  key={c.userId}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                    isDarkMode ? "border-gray-700" : "border-gray-200"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className={`text-xs ${muted}`}>
                      {WA_ROLE_LABELS[c.role] ?? c.role} • {formatWhatsapp(c.whatsapp)}
                    </p>
                  </div>
                  <a
                    href={waLink(c.whatsapp, message)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpened((p) => (p.includes(c.userId) ? p : [...p, c.userId]))}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                      done ? "bg-green-700 hover:bg-green-800" : "bg-green-500 hover:bg-green-600"
                    }`}
                  >
                    {done ? <CheckIcon className="h-3.5 w-3.5" /> : <SendIcon className="h-3.5 w-3.5" />}
                    {done ? "Dibuka" : "Kirim via WA"}
                  </a>
                </li>
              );
            })}
          </ul>
        )}

        <p className={`mb-1 text-xs font-semibold ${muted}`}>Pratinjau pesan</p>
        <pre
          className={`mb-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg p-3 font-sans text-xs ${
            isDarkMode ? "bg-gray-900/60 text-gray-200" : "bg-green-50 text-gray-700"
          }`}
        >
          {message}
        </pre>
        <p className={`mb-4 text-[11px] ${muted}`}>
          WhatsApp terbuka dengan pesan sudah terisi, tinggal tekan Kirim. Notifikasi di aplikasi tetap terkirim otomatis.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={copyMessage}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm ${
              isDarkMode ? "bg-gray-700 text-gray-200 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
            {copied ? "Tersalin" : "Salin pesan"}
          </button>
          <button onClick={onClose} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppNotifyModal;
