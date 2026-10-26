"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Header from "@/app/(components)/Header";
import { useAppDispatch, useAppSelector } from "@/app/redux";
import { setIsDarkMode, setCurrentUser, clearCurrentUser } from "@/state";
import {
  api,
  useGetProfileQuery,
  useUpdateUserProfileMutation,
  useLogoutMutation,
  useChangeOwnPasswordMutation,
} from "@/state/api";
import { CameraIcon, KeyRoundIcon, LogOutIcon, ShieldIcon } from "lucide-react";
import { getTranslation } from "@/lib/translations";
import { compressImage } from "@/lib/imageCompress";
import StoreSettingsSection from "./StoreSettingsSection";

const MIN_PASSWORD = 6;

const getErrorMessage = (err: unknown, fallback: string) => {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
};

// Bahasa tunggal: Indonesia. Nilai ini tetap dikirim ke server agar
// kolom language di database/API tetap konsisten.
const APP_LANGUAGE = "Indonesia";

const ROLE_LABELS: Record<string, string> = {
  super_admin:  "Super Admin",
  admin_gudang: "Admin Gudang",
  admin_toko:   "Admin Toko",
};

const Settings = () => {
  const dispatch    = useAppDispatch();
  const router      = useRouter();
  const isDarkMode  = useAppSelector((s) => s.global.isDarkMode);
  const currentUser = useAppSelector((s) => s.global.currentUser);
  const t = getTranslation().settings;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useGetProfileQuery();
  const [updateProfile]                        = useUpdateUserProfileMutation();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const [form, setForm] = useState({
    name:         "",
    email:        "",
    profileImage: "",
  });
  const [saveStatus,        setSaveStatus]        = useState<"idle" | "success" | "error">("idle");
  const [saveError,         setSaveError]         = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Ganti password
  const [changePassword, { isLoading: changingPassword }] = useChangeOwnPasswordMutation();
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleChangePassword = async () => {
    setPwMessage(null);
    if (!pwForm.current) return setPwMessage({ type: "error", text: "Password lama wajib diisi" });
    if (pwForm.next.length < MIN_PASSWORD) {
      return setPwMessage({ type: "error", text: `Password baru minimal ${MIN_PASSWORD} karakter` });
    }
    if (pwForm.next !== pwForm.confirm) return setPwMessage({ type: "error", text: "Konfirmasi password baru tidak sama" });
    if (pwForm.next === pwForm.current) {
      return setPwMessage({ type: "error", text: "Password baru harus berbeda dari password lama" });
    }
    try {
      const res = await changePassword({ currentPassword: pwForm.current, newPassword: pwForm.next }).unwrap();
      setPwForm({ current: "", next: "", confirm: "" });
      setPwMessage({ type: "success", text: res.message });
    } catch (err) {
      setPwMessage({ type: "error", text: getErrorMessage(err, "Gagal mengganti password") });
    }
  };

  // Isi ulang form setiap data profil dari server berubah
  // (pola "sesuaikan state saat data berubah", tanpa useEffect)
  const [syncedProfile, setSyncedProfile] = useState<typeof profile>(undefined);
  if (profile && profile !== syncedProfile) {
    setSyncedProfile(profile);
    setForm({
      name:         profile.name         ?? "",
      email:        profile.email        ?? "",
      profileImage: profile.profileImage ?? "",
    });
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setSaveError("");
    if (!file.type.startsWith("image/")) { setSaveError("File harus berupa gambar"); return; }
    if (file.size > 5 * 1024 * 1024) { setSaveError("Ukuran foto maksimal 5MB"); return; }
    try {
      // Foto profil kecil: 200px, kualitas 0,7
      const dataUrl = await compressImage(file, 200, 0.7);
      setForm((p) => ({ ...p, profileImage: dataUrl }));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Gagal memproses foto");
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaveStatus("idle");
    setSaveError("");
    if (!form.name.trim()) { setSaveError("Nama tidak boleh kosong"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setSaveError("Format email tidak valid"); return; }
    try {
      const updated = await updateProfile({
        userId:       profile.userId,
        name:         form.name.trim(),
        email:        form.email.trim(),
        profileImage: form.profileImage,
        language:     APP_LANGUAGE,
      }).unwrap();

      // Sync ke Redux
      if (currentUser) {
        dispatch(setCurrentUser({
          ...currentUser,
          name:         updated.name,
          email:        updated.email,
          profileImage: updated.profileImage ?? null,
          language:     updated.language ?? APP_LANGUAGE,
        }));
      }

      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      setSaveStatus("error");
      setSaveError(getErrorMessage(err, t.savedError ?? "Gagal menyimpan"));
    }
  };

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } finally {
      dispatch(clearCurrentUser());
      // Buang seluruh cache RTK Query agar data akun ini tidak terlihat
      // oleh akun berikutnya yang login di browser yang sama.
      dispatch(api.util.resetApiState());
      router.push("/login");
      router.refresh();
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>
  );

  const inputCss = "w-full max-w-md rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 focus:border-blue-500 focus:outline-none";

  return (
    <div className="w-full">
      <Header name={t.title ?? "Pengaturan"} />

      {/* PROFILE CARD */}
      <div className="mt-6 flex items-center justify-between gap-5 rounded-xl bg-white dark:bg-gray-800 p-5 shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            <Image
              src={form.profileImage || "/assets/profile.jpg"}
              alt="Profile"
              width={72}
              height={72}
              unoptimized={form.profileImage?.startsWith("data:")}
              className="h-18 w-18 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 rounded-full bg-blue-500 p-1.5 text-white hover:bg-blue-600 shadow"
            >
              <CameraIcon className="h-3 w-3" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>

          {/* Info */}
          <div>
            <p className="font-bold text-gray-800 dark:text-gray-100 text-base">{form.name || "—"}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{form.email || "—"}</p>
            {/* Role badge */}
            <div className="mt-1 flex items-center gap-1">
              <ShieldIcon className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                {ROLE_LABELS[currentUser?.role ?? ""] ?? currentUser?.role ?? "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="flex items-center gap-2 rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
        >
          <LogOutIcon className="h-4 w-4" />
          {t.logout ?? "Keluar"}
        </button>
      </div>

      {/* SETTINGS TABLE */}
      <div className="mt-5 overflow-hidden rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full bg-white dark:bg-gray-800">
          <thead className="bg-brand-100 text-brand-800 dark:bg-gray-700 dark:text-white">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider w-40">
                {t.setting ?? "Pengaturan"}
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                {t.value ?? "Nilai"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            <tr className="hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors">
              <td className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300 font-medium">
                {t.username ?? "Nama"}
              </td>
              <td className="px-5 py-3">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className={inputCss}
                />
              </td>
            </tr>
            <tr className="hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors">
              <td className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300 font-medium">
                {t.email ?? "Email"}
              </td>
              <td className="px-5 py-3">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className={inputCss}
                />
              </td>
            </tr>
            <tr className="hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors">
              <td className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300 font-medium">
                {t.darkMode ?? "Dark Mode"}
              </td>
              <td className="px-5 py-3">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={isDarkMode}
                    onChange={() => dispatch(setIsDarkMode(!isDarkMode))}
                  />
                  <div className="peer h-6 w-11 rounded-full bg-gray-200 dark:bg-gray-700 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SAVE BUTTON */}
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          className="rounded-lg bg-blue-500 px-6 py-2.5 font-semibold text-white hover:bg-blue-600 transition-colors"
        >
          {t.saveSettings ?? "Simpan"}
        </button>
        {saveStatus === "success" && (
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
            ✓ {t.savedSuccess ?? "Tersimpan!"}
          </span>
        )}
        {(saveError || saveStatus === "error") && (
          <span className="text-sm text-red-500 font-medium">
            ✗ {saveError || t.savedError || "Gagal menyimpan"}
          </span>
        )}
      </div>

      {/* GANTI PASSWORD */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center gap-2">
          <KeyRoundIcon className="h-5 w-5 text-brand-500" />
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Ganti Password</h3>
        </div>
        <div className="grid max-w-md gap-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">Password lama</label>
            <input
              type="password"
              autoComplete="current-password"
              value={pwForm.current}
              onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
              className={inputCss}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">Password baru</label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder={`Minimal ${MIN_PASSWORD} karakter`}
              value={pwForm.next}
              onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
              className={inputCss}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">Ulangi password baru</label>
            <input
              type="password"
              autoComplete="new-password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
              className={inputCss}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleChangePassword}
            disabled={changingPassword}
            className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            {changingPassword ? "Menyimpan..." : "Ganti Password"}
          </button>
          {pwMessage && (
            <span className={`text-sm font-medium ${pwMessage.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
              {pwMessage.type === "success" ? "✓" : "✗"} {pwMessage.text}
            </span>
          )}
        </div>
      </div>

      {/* TOKO & QRIS (Super Admin) */}
      {currentUser?.role === "super_admin" && <StoreSettingsSection isDarkMode={isDarkMode} />}

      {/* MODAL LOGOUT */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowLogoutConfirm(false)} />
          <div className={`relative z-50 w-full max-w-sm rounded-2xl p-6 shadow-2xl mx-4 ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/40">
                <LogOutIcon className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold">{t.logout ?? "Keluar"}</h3>
            </div>
            <p className={`text-sm mb-6 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
              {t.logoutConfirm ?? "Yakin ingin keluar dari sistem?"}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className={`px-4 py-2 rounded-lg text-sm ${isDarkMode ? "bg-gray-700 text-gray-200 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                Batal
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 disabled:opacity-60"
              >
                {isLoggingOut ? "..." : (t.logout ?? "Keluar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;