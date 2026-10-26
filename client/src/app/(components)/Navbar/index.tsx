"use client";

import { useAppDispatch, useAppSelector } from "@/app/redux";
import { getTranslation } from "@/lib/translations";
import { setIsDarkMode, setIsSidebarCollapsed, setSearchTerm } from "@/state";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Menu,
  Moon,
  PackageCheck,
  PackageMinus,
  Search,
  Settings,
  ShoppingCart,
  Sun,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  useGetProfileQuery,
  useGetNotificationsQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  Notification,
} from "@/state/api";

// ── Tampilan per jenis notifikasi (nilai `type` dari server) ──────
// label = modul asal (judul notifikasi sudah memuat statusnya, jadi label
// tidak mengulang status); warna & ikon = status.
type Tone = {
  iconWrap:  string; // latar ikon & pill label
  iconColor: string; // warna ikon & teks label
  soft:      string; // latar kepala modal detail
};

type NotifMeta = { label: string; icon: React.ElementType; tone: Tone };

const BRAND: Tone = {
  iconWrap:  "bg-brand-100 dark:bg-brand-500/20",
  iconColor: "text-brand-600 dark:text-brand-300",
  soft:      "bg-brand-50 dark:bg-brand-500/10",
};
const GREEN: Tone = {
  iconWrap:  "bg-green-100 dark:bg-green-900/40",
  iconColor: "text-green-600 dark:text-green-400",
  soft:      "bg-green-50 dark:bg-green-900/20",
};
const EMERALD: Tone = {
  iconWrap:  "bg-emerald-100 dark:bg-emerald-900/40",
  iconColor: "text-emerald-600 dark:text-emerald-400",
  soft:      "bg-emerald-50 dark:bg-emerald-900/20",
};
const RED: Tone = {
  iconWrap:  "bg-red-100 dark:bg-red-900/40",
  iconColor: "text-red-600 dark:text-red-400",
  soft:      "bg-red-50 dark:bg-red-900/20",
};
const PURPLE: Tone = {
  iconWrap:  "bg-purple-100 dark:bg-purple-900/40",
  iconColor: "text-purple-600 dark:text-purple-400",
  soft:      "bg-purple-50 dark:bg-purple-900/20",
};
const ORANGE: Tone = {
  iconWrap:  "bg-orange-100 dark:bg-orange-900/40",
  iconColor: "text-orange-600 dark:text-orange-400",
  soft:      "bg-orange-50 dark:bg-orange-900/20",
};
const AMBER: Tone = {
  iconWrap:  "bg-amber-100 dark:bg-amber-900/40",
  iconColor: "text-amber-600 dark:text-amber-400",
  soft:      "bg-amber-50 dark:bg-amber-900/20",
};
const GRAY: Tone = {
  iconWrap:  "bg-gray-100 dark:bg-gray-700",
  iconColor: "text-gray-500 dark:text-gray-400",
  soft:      "bg-gray-50 dark:bg-gray-700/40",
};

const PO = "Purchase Order";
const SR = "Store Replenishment";

const NOTIF_META: Record<string, NotifMeta> = {
  // Purchase Order (supplier)
  po_created:     { label: PO, icon: ShoppingCart,  tone: BRAND   },
  po_received:    { label: PO, icon: PackageCheck,  tone: GREEN   },
  po_discrepancy: { label: PO, icon: AlertTriangle, tone: ORANGE  },
  // Store Replenishment (gudang → toko)
  sr_created:     { label: SR, icon: ClipboardList, tone: BRAND   },
  sr_approved:    { label: SR, icon: CheckCircle2,  tone: GREEN   },
  sr_rejected:    { label: SR, icon: XCircle,       tone: RED     },
  sr_shipped:     { label: SR, icon: Truck,         tone: PURPLE  },
  sr_received:    { label: SR, icon: PackageCheck,  tone: EMERALD },
  sr_discrepancy: { label: SR, icon: AlertTriangle, tone: ORANGE  },
  // Peringatan stok (otomatis saat stok baru melewati ambang menipis / habis)
  stock_low_toko:   { label: "Stok Toko",   icon: PackageMinus, tone: AMBER },
  stock_low_gudang: { label: "Stok Gudang", icon: PackageMinus, tone: AMBER },
};

const DEFAULT_META: NotifMeta = { label: "Info", icon: Bell, tone: GRAY };

const getMeta = (type: string): NotifMeta => NOTIF_META[type] ?? DEFAULT_META;

// ── Tujuan tautan per jenis acuan (nilai `referenceType` dari server) ──
// Data lama "PO"/"RESTOCK" (hanya data uji) sengaja tidak diberi tautan.
const REFERENCE_LINKS: Record<string, { href: string; label: string }> = {
  PURCHASE_ORDER:      { href: "/purchase-orders",      label: "Lihat Purchase Order" },
  STORE_REPLENISHMENT: { href: "/store-replenishments", label: "Lihat Store Replenishment" },
  STOCK_TOKO:          { href: "/inventory/toko",       label: "Lihat Stok Toko" },
  STOCK_GUDANG:        { href: "/inventory/gudang",     label: "Lihat Stok Gudang" },
};

// Jumlah notifikasi terbaru di dropdown lonceng (sisanya lewat "Lihat semua")
const DROPDOWN_LIMIT = 8;

// ── Helper waktu (tanggal LOKAL) ──────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const localDayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clock = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

// "Baru saja", "5 menit lalu", "Hari ini, 14.20", "Kemarin, 09.15", "13 Okt, 10.00"
const relativeTime = (iso: string, now: number): string => {
  const d = new Date(iso);
  const minutes = Math.floor(Math.max(0, now - d.getTime()) / 60000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  if (minutes < 6 * 60) return `${Math.floor(minutes / 60)} jam lalu`;
  const today = new Date(now);
  const yesterday = new Date(now - 86400000);
  if (localDayKey(d) === localDayKey(today)) return `Hari ini, ${clock(d)}`;
  if (localDayKey(d) === localDayKey(yesterday)) return `Kemarin, ${clock(d)}`;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  }) + `, ${clock(d)}`;
};

const fullDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} • ${clock(d)}`;
};

// Label kelompok per hari di modal "Semua Notifikasi"
const dayLabel = (key: string, now: number) => {
  if (key === localDayKey(new Date(now))) return "Hari ini";
  if (key === localDayKey(new Date(now - 86400000))) return "Kemarin";
  return new Date(`${key}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
};

const slimScroll =
  "[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600";

// ── Satu baris notifikasi (dropdown & modal semua) ────────────────
const NotifItem = ({
  notif,
  now,
  lines,
  onOpen,
}: {
  notif: Notification;
  now: number;
  lines: 2 | 3;
  onOpen: (n: Notification) => void;
}) => {
  const { label, icon: Icon, tone } = getMeta(notif.type);
  const unread = !notif.isRead;
  return (
    <button
      type="button"
      onClick={() => onOpen(notif)}
      className={`flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
        unread
          ? "bg-brand-50/80 hover:bg-brand-100/70 dark:bg-brand-500/10 dark:hover:bg-brand-500/15"
          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
      }`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.iconWrap}`}>
        <Icon className={`h-5 w-5 ${tone.iconColor}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className={`truncate text-[11px] font-semibold uppercase tracking-wide ${tone.iconColor}`}>{label}</span>
          <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{relativeTime(notif.createdAt, now)}</span>
        </span>
        <span
          className={`mt-0.5 block text-sm leading-snug ${
            unread ? "font-semibold text-gray-900 dark:text-gray-50" : "font-medium text-gray-700 dark:text-gray-200"
          }`}
        >
          {notif.title}
        </span>
        <span
          className={`mt-0.5 block text-xs leading-relaxed text-gray-500 dark:text-gray-400 ${lines === 2 ? "line-clamp-2" : "line-clamp-3"}`}
        >
          {notif.message}
        </span>
      </span>
      <span className="flex w-2.5 shrink-0 justify-center pt-1.5">
        {unread && (
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-brand-100 dark:ring-brand-500/20" title="Belum dibaca" />
        )}
      </span>
    </button>
  );
};

const EmptyState = ({ allRead }: { allRead?: boolean }) => (
  <div className="flex flex-col items-center px-6 py-10 text-center">
    <span
      className={`mb-3 flex h-14 w-14 items-center justify-center rounded-full ${
        allRead ? "bg-green-50 text-green-500 dark:bg-green-900/30" : "bg-brand-50 text-brand-400 dark:bg-brand-500/10"
      }`}
    >
      {allRead ? <CheckCheck className="h-6 w-6" /> : <BellOff className="h-6 w-6" />}
    </span>
    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
      {allRead ? "Semua notifikasi sudah dibaca" : "Belum ada notifikasi"}
    </p>
    <p className="mt-0.5 text-xs text-gray-400">
      {allRead ? "Tidak ada yang perlu ditindaklanjuti." : "Notifikasi baru akan muncul di sini."}
    </p>
  </div>
);

const Navbar = () => {
  const dispatch = useAppDispatch();
  const pathname = usePathname();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isAllOpen, setIsAllOpen] = useState(false);
  const [allTab, setAllTab] = useState<"all" | "unread">("all");
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
  // Detail dibuka dari modal "Semua Notifikasi" → tombol Kembali ke daftar
  const [detailFromAll, setDetailFromAll] = useState(false);

  // Waktu acuan untuk "x menit lalu", diperbarui tiap menit
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const isSidebarCollapsed = useAppSelector((state) => state.global.isSidebarCollapsed);
  const isDarkMode = useAppSelector((state) => state.global.isDarkMode);
  const searchTerm = useAppSelector((state) => state.global.searchTerm) ?? "";
  const t = getTranslation().navbar;

  const { data: profile } = useGetProfileQuery();

  // ── Notifikasi real dari DB, polling 30 detik ─────────────
  const { data: notifData } = useGetNotificationsQuery(undefined, {
    pollingInterval: 30000,
  });
  const [markNotificationAsRead] = useMarkNotificationAsReadMutation();
  const [markAllNotificationsAsRead] = useMarkAllNotificationsAsReadMutation();

  const notifications = notifData?.notifications ?? [];

  // Jumlah belum dibaca dihitung oleh server
  const unreadCount =
    notifData?.unreadCount ?? notifications.filter((n) => !n.isRead).length;
  const unreadInList = notifications.filter((n) => !n.isRead).length;

  const showSearchBar = ["/users", "/products"].includes(pathname);

  useEffect(() => {
    dispatch(setSearchTerm(""));
  }, [pathname, dispatch]);

  // Esc menutup dropdown / modal yang paling atas
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedNotif) {
        setSelectedNotif(null);
        if (detailFromAll) setIsAllOpen(true);
      } else if (isAllOpen) setIsAllOpen(false);
      else setIsNotifOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNotif, detailFromAll, isAllOpen]);

  const toggleSidebar = () => dispatch(setIsSidebarCollapsed(!isSidebarCollapsed));
  const toggleDarkMode = () => dispatch(setIsDarkMode(!isDarkMode));
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) =>
    dispatch(setSearchTerm(e.target.value));

  const markAllAsRead = () => {
    markAllNotificationsAsRead();
  };

  // Buka detail (dari dropdown atau modal semua); tandai dibaca
  const openDetail = (notif: Notification, fromAll: boolean) => {
    setSelectedNotif(notif);
    setDetailFromAll(fromAll);
    setIsNotifOpen(false);
    setIsAllOpen(false);
    if (!notif.isRead) {
      markNotificationAsRead(notif.notifId);
    }
  };

  const closeDetail = () => {
    setSelectedNotif(null);
    if (detailFromAll) setIsAllOpen(true);
  };

  const openAll = () => {
    setIsNotifOpen(false);
    setAllTab("all");
    setIsAllOpen(true);
  };

  // Daftar modal "Semua": filter tab lalu kelompokkan per hari (urutan server = terbaru dulu)
  const allList = allTab === "unread" ? notifications.filter((n) => !n.isRead) : notifications;
  const groups: { key: string; items: Notification[] }[] = [];
  for (const n of allList) {
    const key = localDayKey(new Date(n.createdAt));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(n);
    else groups.push({ key, items: [n] });
  }

  const selectedMeta = selectedNotif ? getMeta(selectedNotif.type) : DEFAULT_META;
  const SelectedIcon = selectedMeta.icon;
  const selectedLink =
    selectedNotif?.referenceType
      ? REFERENCE_LINKS[selectedNotif.referenceType]
      : undefined;

  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <>
      {/* klik di luar dropdown menutupnya */}
      {isNotifOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
      )}

      {/* MODAL DETAIL NOTIFIKASI */}
      {selectedNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeDetail} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-detail-title"
            className="relative z-50 mx-4 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
          >
            <div className={`relative px-6 pb-5 pt-6 ${selectedMeta.tone.soft}`}>
              <button
                onClick={() => setSelectedNotif(null)}
                aria-label="Tutup"
                className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-white/70 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10">
                <SelectedIcon className={`h-6 w-6 ${selectedMeta.tone.iconColor}`} />
              </span>
              <span
                className={`mt-4 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${selectedMeta.tone.iconWrap} ${selectedMeta.tone.iconColor}`}
              >
                {selectedMeta.label}
              </span>
              <h3 id="notif-detail-title" className="mt-2 pr-6 text-lg font-bold leading-snug text-gray-900 dark:text-gray-50">
                {selectedNotif.title}
              </h3>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                {fullDateTime(selectedNotif.createdAt)}
                <span className="text-gray-400 dark:text-gray-500">· {relativeTime(selectedNotif.createdAt, now)}</span>
              </p>
            </div>

            <div className="px-6 py-5">
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                {selectedNotif.message}
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-700">
              <button
                onClick={closeDetail}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                {detailFromAll ? "Kembali" : t.close}
              </button>
              {selectedLink && (
                <Link
                  href={selectedLink.href}
                  onClick={() => setSelectedNotif(null)}
                  className="group inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                >
                  {selectedLink.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-7 flex w-full items-center justify-between">
        {/* LEFT SIDE */}
        <div className="flex items-center justify-between gap-5">
          <button
            className="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-3 hover:bg-blue-100 dark:hover:bg-blue-600"
            onClick={toggleSidebar}
          >
            <Menu className="h-4 w-4" />
          </button>

          {showSearchBar && (
            <div className="relative">
              <input
                type="search"
                placeholder={pathname === "/users" ? t.searchUsers : t.searchProducts}
                className="w-50 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 py-2 pl-10 pr-4 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none md:w-72"
                value={searchTerm}
                onChange={handleSearch}
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="text-gray-500 dark:text-gray-400" size={20} />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-5">
          <div className="hidden items-center gap-4 md:flex">
            <button
              onClick={toggleDarkMode}
              aria-label={isDarkMode ? "Mode terang" : "Mode gelap"}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-brand-50 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-brand-300"
            >
              {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
            </button>

            {/* BELL + DROPDOWN (dinaikkan di atas latar hanya saat dropdown terbuka,
                agar tidak menembus latar gelap modal) */}
            <div className={`relative ${isNotifOpen ? "z-50" : ""}`}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : "Notifikasi"}
                aria-expanded={isNotifOpen}
                className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                  isNotifOpen
                    ? "bg-brand-50 text-brand-600 dark:bg-gray-700 dark:text-brand-300"
                    : "text-gray-500 hover:bg-brand-50 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-brand-300"
                }`}
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-gray-900">
                    {badgeText}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 top-12 z-50 w-[24rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
                    <div>
                      <h4 className="text-base font-bold text-gray-900 dark:text-gray-50">{t.notifications}</h4>
                      <p className="text-xs text-gray-400">
                        {unreadCount > 0 ? `${unreadCount} belum dibaca` : "Semua sudah dibaca"}
                      </p>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        {t.markAllRead}
                      </button>
                    )}
                  </div>

                  <div className={`max-h-[22rem] space-y-1 overflow-y-auto border-t border-gray-100 px-2 py-2 dark:border-gray-700 ${slimScroll}`}>
                    {notifications.length === 0 ? (
                      <EmptyState />
                    ) : (
                      notifications.slice(0, DROPDOWN_LIMIT).map((notif) => (
                        <NotifItem key={notif.notifId} notif={notif} now={now} lines={2} onOpen={(n) => openDetail(n, false)} />
                      ))
                    )}
                  </div>

                  <div className="border-t border-gray-100 p-3 dark:border-gray-700">
                    <button
                      onClick={openAll}
                      className="group flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-50 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-100 transition-colors hover:bg-brand-100 hover:ring-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20 dark:hover:bg-brand-500/20"
                    >
                      {t.viewAll}
                      {notifications.length > 0 && (
                        <span className="font-normal text-brand-500 dark:text-brand-400">({notifications.length})</span>
                      )}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <hr className="mx-2 h-7 w-0 border border-l border-solid border-gray-300 dark:border-gray-600" />

            <div className="flex cursor-pointer items-center gap-3">
              <Image
                src={
                  profile?.profileImage && profile.profileImage.startsWith("data:")
                    ? profile.profileImage
                    : profile?.profileImage || "/assets/profile.jpg"
                }
                alt="Profile"
                width={50}
                height={50}
                unoptimized={profile?.profileImage?.startsWith("data:") ?? false}
                className="h-10 w-10 rounded-full object-cover"
              />
              <span className="font-semibold dark:text-gray-100">
                {profile?.name || "User"}
              </span>
            </div>
          </div>

          <Link href="/settings">
            <Settings
              className="cursor-pointer text-gray-500 dark:text-gray-400"
              size={24}
            />
          </Link>
        </div>
      </div>

      {/* MODAL SEMUA NOTIFIKASI */}
      {isAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsAllOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-all-title"
            className="relative z-50 mx-4 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
          >
            <div className="flex items-start justify-between gap-3 px-6 pb-3 pt-5">
              <div>
                <h3 id="notif-all-title" className="text-lg font-bold text-gray-900 dark:text-gray-50">Semua Notifikasi</h3>
                <p className="text-xs text-gray-400">
                  {unreadCount > 0 ? `${unreadCount} belum dibaca` : "Semua sudah dibaca"} · {notifications.length} notifikasi terbaru
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    {t.markAllRead}
                  </button>
                )}
                <button
                  onClick={() => setIsAllOpen(false)}
                  aria-label="Tutup"
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tab Semua / Belum dibaca */}
            <div className="px-6 pb-3">
              <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-700/60">
                {([
                  ["all", "Semua", notifications.length],
                  ["unread", "Belum dibaca", unreadInList],
                ] as const).map(([key, label, count]) => (
                  <button
                    key={key}
                    onClick={() => setAllTab(key)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      allTab === key
                        ? "bg-white text-brand-600 shadow-sm dark:bg-gray-800 dark:text-brand-300"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                  >
                    {label}
                    <span
                      className={`rounded-full px-1.5 py-px text-[10px] ${
                        allTab === key ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" : "bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className={`min-h-0 flex-1 overflow-y-auto border-t border-gray-100 px-3 pb-3 dark:border-gray-700 ${slimScroll}`}>
              {allList.length === 0 ? (
                <EmptyState allRead={allTab === "unread" && notifications.length > 0} />
              ) : (
                groups.map((g) => (
                  <section key={g.key}>
                    <h4 className="sticky top-0 z-10 bg-white/95 px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 backdrop-blur dark:bg-gray-800/95 dark:text-gray-500">
                      {dayLabel(g.key, now)}
                    </h4>
                    <div className="space-y-1">
                      {g.items.map((notif) => (
                        <NotifItem key={notif.notifId} notif={notif} now={now} lines={3} onOpen={(n) => openDetail(n, true)} />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>

            <div className="flex justify-end border-t border-gray-100 px-6 py-3 dark:border-gray-700">
              <button
                onClick={() => setIsAllOpen(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
