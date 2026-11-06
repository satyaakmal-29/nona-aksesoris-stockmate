"use client";

import { useState } from "react";
import Header from "@/app/(components)/Header";
import FieldError from "@/app/(components)/FieldError";
import { useAppSelector } from "@/app/redux";
import { getTranslation } from "@/lib/translations";
import {
  MAX_LEN,
  MAX_PASSWORD,
  PASSWORD_HINT,
  confirmPasswordError,
  gmailError,
  passwordError,
  personNameError,
  squeeze,
  usernameError,
  whatsappError,
} from "@/lib/validation";
import { formatWhatsapp } from "@/lib/whatsapp";
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useResetUserPasswordMutation,
  User,
} from "@/state/api";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  KeyRoundIcon,
  PencilIcon,
  PlusCircleIcon,
  Trash2Icon,
  XIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
} from "lucide-react";

type UserFormData = {
  name:     string;
  username: string;
  email:    string;
  whatsapp: string;
  password: string;
  confirm:  string;
  role:     string;
  isActive: boolean;
};

const ROLE_OPTIONS = [
  { value: "super_admin",  label: "Super Admin"  },
  { value: "admin_gudang", label: "Admin Gudang" },
  { value: "admin_toko",   label: "Admin Toko"   },
];

const getRoleBadge = (role: string) => {
  const map: Record<string, { label: string; color: string }> = {
    super_admin:  { label: "Super Admin",  color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    admin_gudang: { label: "Admin Gudang", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    admin_toko:   { label: "Admin Toko",   color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  };
  const r = map[role] ?? { label: role, color: "bg-gray-100 text-gray-700" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${r.color}`}>{r.label}</span>;
};

const getErrorMessage = (err: unknown, fallback: string) => {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
};

// Kolom yang bisa diurutkan (klik judul: naik → turun → urutan asli)
type SortKey = "name" | "username" | "email" | "role" | "isActive";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

const SORT_COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: "name",     label: "Nama",     className: "min-w-[160px]" },
  { key: "username", label: "Username", className: "w-[140px]" },
  { key: "email",    label: "Email",    className: "min-w-[200px]" },
  { key: "role",     label: "Peran",    className: "w-[140px]" },
  { key: "isActive", label: "Status",   className: "w-[110px]" },
];

const sortValue = (u: User, key: SortKey) => {
  if (key === "isActive") return u.isActive ? "1" : "0";
  if (key === "role") return ROLE_OPTIONS.find((r) => r.value === u.role)?.label ?? u.role;
  return u[key];
};

const Users = () => {
  const searchTerm  = useAppSelector((s) => s.global.searchTerm) ?? "";
  const isDarkMode  = useAppSelector((s) => s.global.isDarkMode);
  const currentUser = useAppSelector((s) => s.global.currentUser);
  const t = getTranslation().users;

  const { data: users, isError, isLoading } = useGetUsersQuery();
  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: deleting }] = useDeleteUserMutation();
  const [resetPassword, { isLoading: resetting }] = useResetUserPasswordMutation();

  const [isCreateOpen, setIsCreateOpen]   = useState(false);
  const [editUser, setEditUser]           = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<User | null>(null);
  const [resetTarget, setResetTarget]     = useState<User | null>(null);
  const [newPassword, setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError]         = useState("");
  const [notice, setNotice]               = useState("");
  const [sort, setSort]                   = useState<SortState>(null);
  // Error per kolom tampil setelah tombol simpan ditekan, lalu diperbarui saat mengetik
  const [showErrors, setShowErrors]       = useState(false);

  const defaultForm: UserFormData = {
    name: "", username: "", email: "", whatsapp: "", password: "", confirm: "", role: "admin_toko", isActive: true,
  };
  const [form, setForm] = useState<UserFormData>(defaultForm);

  const isCreate = !editUser;
  const formErrors = {
    name:     personNameError(form.name),
    username: usernameError(form.username),
    email:    gmailError(form.email),
    whatsapp: whatsappError(form.whatsapp),
    password: isCreate ? passwordError(form.password, form.username) : "",
    confirm:  isCreate ? confirmPasswordError(form.password, form.confirm) : "",
  };
  const resetErrors = {
    password: passwordError(newPassword, resetTarget?.username, "Password baru"),
    confirm:  confirmPasswordError(newPassword, confirmPassword),
  };
  const shown = (msg: string) => (showErrors ? msg : "");

  const term = searchTerm.trim().toLowerCase();
  const filteredUsers = (users ?? []).filter((u) =>
    !term || [u.name, u.username, u.email].some((v) => v.toLowerCase().includes(term))
  );
  const sortedUsers = sort
    ? [...filteredUsers].sort((a, b) => {
        const cmp = sortValue(a, sort.key).localeCompare(sortValue(b, sort.key), "id", { sensitivity: "base" });
        return sort.dir === "asc" ? cmp : -cmp;
      })
    : filteredUsers;

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  const isEditingSelf = !!editUser && editUser.userId === currentUser?.userId;

  const closeAll = () => {
    setIsCreateOpen(false);
    setEditUser(null);
    setDeleteTarget(null);
    setResetTarget(null);
    setFormError("");
    setShowErrors(false);
  };

  const handleCreateOpen = () => {
    setForm(defaultForm);
    setFormError("");
    setShowErrors(false);
    setIsCreateOpen(true);
  };

  const handleEditOpen = (user: User) => {
    setEditUser(user);
    setForm({
      name: user.name, username: user.username, email: user.email,
      whatsapp: user.whatsapp ? formatWhatsapp(user.whatsapp) : "",
      password: "", confirm: "", role: user.role, isActive: user.isActive,
    });
    setFormError("");
    setShowErrors(false);
  };

  const handleResetOpen = (user: User) => {
    setResetTarget(user);
    setNewPassword("");
    setConfirmPassword("");
    setFormError("");
    setShowErrors(false);
  };

  const handleCreateSubmit = async () => {
    setFormError("");
    setShowErrors(true);
    if (Object.values(formErrors).some(Boolean)) return;
    try {
      const created = await createUser({
        name: squeeze(form.name), username: form.username.trim(), email: form.email.trim().toLowerCase(),
        whatsapp: form.whatsapp.trim() || undefined,
        password: form.password, role: form.role,
      }).unwrap();
      setNotice(`Pengguna ${created.name} ditambahkan`);
      closeAll();
    } catch (e) {
      setFormError(getErrorMessage(e, "Gagal membuat pengguna"));
    }
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setFormError("");
    setShowErrors(true);
    if (Object.values(formErrors).some(Boolean)) return;
    try {
      await updateUser({
        userId:   editUser.userId,
        name:     squeeze(form.name),
        username: form.username.trim(),
        email:    form.email.trim().toLowerCase(),
        whatsapp: form.whatsapp.trim(), // "" = hapus nomor
        // Peran & status akun sendiri tidak dikirim (dikunci di server juga)
        ...(isEditingSelf ? {} : { role: form.role, isActive: form.isActive }),
      }).unwrap();
      setNotice(`Data ${form.name.trim()} diperbarui`);
      closeAll();
    } catch (e) {
      setFormError(getErrorMessage(e, "Gagal memperbarui pengguna"));
    }
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setFormError("");
    setShowErrors(true);
    if (Object.values(resetErrors).some(Boolean)) return;
    try {
      const res = await resetPassword({ userId: resetTarget.userId, newPassword }).unwrap();
      setNotice(`${res.message}. Sampaikan password baru kepada pengguna.`);
      closeAll();
    } catch (e) {
      setFormError(getErrorMessage(e, "Gagal mereset password"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await deleteUser(deleteTarget.userId).unwrap();
      setNotice(res.message);
      closeAll();
    } catch (e) {
      setFormError(getErrorMessage(e, "Gagal menghapus pengguna"));
    }
  };

  if (isLoading) return <div className="py-4 dark:text-gray-100">Memuat pengguna...</div>;
  if (isError || !users) return <div className="py-4 text-center text-red-500">Gagal memuat data pengguna</div>;

  const modalBg  = "fixed inset-0 z-50 flex items-center justify-center";
  const cardCss  = `relative z-50 w-full max-w-md rounded-2xl p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"}`;
  const inputCss = `mb-3 block w-full rounded-md border-2 p-2 text-sm ${isDarkMode ? "border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400" : "border-gray-300 bg-white text-gray-900"} disabled:opacity-60`;
  const labelCss = `block text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`;
  const btnSecondary = `px-4 py-2 rounded-lg text-sm ${isDarkMode ? "bg-gray-700 text-gray-200 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`;
  const btnPrimary = "px-4 py-2 rounded-lg text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60";

  const errorBox = formError && (
    <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{formError}</div>
  );

  // Input dengan pesan error di bawahnya (input tanpa mb-3; jarak dari pembungkus)
  const textField = (
    label: string, error: string, input: React.ReactNode, hint?: string,
  ) => (
    <div className="mb-3">
      <label className={labelCss}>{label}</label>
      {input}
      {error ? <FieldError message={error} /> : hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
  const fieldCss = (error: string) =>
    `${inputCss.replace("mb-3 ", "")} ${error ? "!border-red-400" : ""}`;

  const renderFormFields = (isEdit: boolean) => (
    <>
      {errorBox}
      {textField("Nama Lengkap", shown(formErrors.name),
        <input type="text" placeholder="Nama lengkap" maxLength={MAX_LEN.personName} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={fieldCss(shown(formErrors.name))} />)}
      {textField("Username", shown(formErrors.username),
        <input type="text" placeholder="username" maxLength={MAX_LEN.username} value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value.replace(/\s/g, "") }))} className={fieldCss(shown(formErrors.username))} />)}
      {textField("Email (Gmail)", shown(formErrors.email),
        <input type="email" inputMode="email" placeholder="nama@gmail.com" maxLength={MAX_LEN.email} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={fieldCss(shown(formErrors.email))} />)}
      {textField("Nomor WhatsApp (opsional)", shown(formErrors.whatsapp),
        <input type="tel" inputMode="tel" placeholder="0812 3456 7890" maxLength={20} value={form.whatsapp} onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))} className={fieldCss(shown(formErrors.whatsapp))} />,
        "Untuk tombol \"Kirim via WA\" notifikasi Purchase Order & Store Replenishment.")}
      {!isEdit && (
        <>
          {textField("Password", shown(formErrors.password),
            <input type="password" autoComplete="new-password" maxLength={MAX_PASSWORD} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className={fieldCss(shown(formErrors.password))} />,
            PASSWORD_HINT)}
          {textField("Ulangi Password", shown(formErrors.confirm),
            <input type="password" autoComplete="new-password" maxLength={MAX_PASSWORD} value={form.confirm} onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))} className={fieldCss(shown(formErrors.confirm))} />)}
        </>
      )}
      <label className={labelCss}>Peran</label>
      <select value={form.role} disabled={isEdit && isEditingSelf} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className={inputCss}>
        {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      {isEdit && (
        <>
          <label className={labelCss}>Status</label>
          <select
            value={form.isActive ? "active" : "inactive"}
            disabled={isEditingSelf}
            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value === "active" }))}
            className={inputCss}
          >
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif (tidak bisa login)</option>
          </select>
          {isEditingSelf && <p className="-mt-2 mb-3 text-xs text-gray-400">Peran & status akun sendiri tidak dapat diubah.</p>}
        </>
      )}
    </>
  );

  return (
    <div className="flex flex-col">
      <div className="mb-5 flex items-center justify-between">
        <Header name={t.title ?? "Pengguna"} />
        <button onClick={handleCreateOpen} className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">
          <PlusCircleIcon className="h-4 w-4" /> Tambah Pengguna
        </button>
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
          <span>{notice}</span>
          <button onClick={() => setNotice("")}><XIcon className="h-4 w-4" /></button>
        </div>
      )}

      <div className={`overflow-x-auto rounded-lg border shadow ${isDarkMode ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-white"}`}>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {SORT_COLUMNS.map((c) => {
                const dir = sort?.key === c.key ? sort.dir : undefined;
                const SortIcon = dir === "desc" ? ArrowDownIcon : ArrowUpIcon;
                return (
                  <th
                    key={c.key}
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                    className={`px-4 py-3 text-left ${c.className}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="group inline-flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-100"
                    >
                      {c.label}
                      <SortIcon className={`h-3.5 w-3.5 transition-opacity ${dir ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`} />
                    </button>
                  </th>
                );
              })}
              <th className="w-[130px] px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-100">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.length === 0 ? (
              <tr>
                <td colSpan={SORT_COLUMNS.length + 1} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                  Tidak ada pengguna
                </td>
              </tr>
            ) : (
              sortedUsers.map((u) => {
                const isSelf = u.userId === currentUser?.userId;
                return (
                  <tr
                    key={u.userId}
                    className="h-14 border-b border-gray-200 text-gray-700 last:border-b-0 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                  >
                    <td className="px-4">{u.name}</td>
                    <td className="px-4">{u.username}</td>
                    <td className="px-4">
                      {u.email}
                      {u.whatsapp && (
                        <span className="block text-xs text-gray-400">WA {formatWhatsapp(u.whatsapp)}</span>
                      )}
                    </td>
                    <td className="px-4">{getRoleBadge(u.role)}</td>
                    <td className="px-4">
                      {u.isActive
                        ? <span className="flex items-center gap-1 text-xs font-semibold text-green-600"><ShieldCheckIcon className="h-3.5 w-3.5" /> Aktif</span>
                        : <span className="flex items-center gap-1 text-xs font-semibold text-red-500"><ShieldAlertIcon className="h-3.5 w-3.5" /> Nonaktif</span>}
                    </td>
                    <td className="px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEditOpen(u)} className="rounded p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30" title="Ubah">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleResetOpen(u)} className="rounded p-1 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30" title="Reset password">
                          <KeyRoundIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { if (!isSelf) { setFormError(""); setDeleteTarget(u); } }}
                          disabled={isSelf}
                          className={`rounded p-1 ${isSelf ? "cursor-not-allowed text-gray-300 dark:text-gray-600" : "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"}`}
                          title={isSelf ? "Tidak bisa menghapus akun sendiri" : "Hapus"}
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL TAMBAH */}
      {isCreateOpen && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={closeAll} />
          <div className={cardCss}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Tambah Pengguna Baru</h3>
              <button onClick={closeAll}><XIcon className="h-5 w-5 text-gray-400" /></button>
            </div>
            {renderFormFields(false)}
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={closeAll} className={btnSecondary}>Batal</button>
              <button onClick={handleCreateSubmit} disabled={creating} className={btnPrimary}>{creating ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL UBAH */}
      {editUser && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={closeAll} />
          <div className={cardCss}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Ubah Pengguna</h3>
              <button onClick={closeAll}><XIcon className="h-5 w-5 text-gray-400" /></button>
            </div>
            {renderFormFields(true)}
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={closeAll} className={btnSecondary}>Batal</button>
              <button onClick={handleEditSave} disabled={updating} className={btnPrimary}>{updating ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESET PASSWORD */}
      {resetTarget && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={closeAll} />
          <div className={cardCss}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Reset Password</h3>
              <button onClick={closeAll}><XIcon className="h-5 w-5 text-gray-400" /></button>
            </div>
            {errorBox}
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              Atur password baru untuk <span className="font-semibold">{resetTarget.name}</span> (@{resetTarget.username}).
            </p>
            {textField("Password Baru", shown(resetErrors.password),
              <input type="password" autoComplete="new-password" maxLength={MAX_PASSWORD} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={fieldCss(shown(resetErrors.password))} />,
              PASSWORD_HINT)}
            {textField("Ulangi Password Baru", shown(resetErrors.confirm),
              <input type="password" autoComplete="new-password" maxLength={MAX_PASSWORD} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={fieldCss(shown(resetErrors.confirm))} />)}
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={closeAll} className={btnSecondary}>Batal</button>
              <button onClick={handleReset} disabled={resetting} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-60">
                {resetting ? "Menyimpan..." : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HAPUS */}
      {deleteTarget && (
        <div className={modalBg}>
          <div className="absolute inset-0 bg-black/50" onClick={closeAll} />
          <div className={`relative z-50 mx-4 w-full max-w-sm rounded-2xl p-6 shadow-2xl ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"}`}>
            <h3 className="mb-2 text-lg font-bold">Hapus Pengguna</h3>
            {errorBox}
            <p className={`mb-2 text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
              Hapus <span className="font-semibold">{deleteTarget.name}</span>?
            </p>
            <p className="mb-6 text-xs text-gray-500 dark:text-gray-400">
              Jika pengguna ini punya riwayat (transaksi, PO, Store Replenishment, mutasi stok, atau pengeluaran),
              akun akan <span className="font-semibold">dinonaktifkan</span>, bukan dihapus permanen, agar laporan tetap utuh.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={closeAll} className={btnSecondary}>Batal</button>
              <button onClick={handleDelete} disabled={deleting} className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-60">
                {deleting ? "Memproses..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
