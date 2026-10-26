"use client";

import { useState } from "react";
import Header from "@/app/(components)/Header";
import { useAppSelector } from "@/app/redux";
import { getTranslation } from "@/lib/translations";
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useResetUserPasswordMutation,
  User,
} from "@/state/api";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import {
  KeyRoundIcon,
  PencilIcon,
  PlusCircleIcon,
  Trash2Icon,
  XIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
} from "lucide-react";

const MIN_PASSWORD = 6;

type UserFormData = {
  name:     string;
  username: string;
  email:    string;
  password: string;
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

  const defaultForm: UserFormData = {
    name: "", username: "", email: "", password: "", role: "admin_toko", isActive: true,
  };
  const [form, setForm] = useState<UserFormData>(defaultForm);

  const term = searchTerm.trim().toLowerCase();
  const filteredUsers = (users ?? []).filter((u) =>
    !term || [u.name, u.username, u.email].some((v) => v.toLowerCase().includes(term))
  );

  const isEditingSelf = !!editUser && editUser.userId === currentUser?.userId;

  const closeAll = () => {
    setIsCreateOpen(false);
    setEditUser(null);
    setDeleteTarget(null);
    setResetTarget(null);
    setFormError("");
  };

  const handleCreateOpen = () => {
    setForm(defaultForm);
    setFormError("");
    setIsCreateOpen(true);
  };

  const handleEditOpen = (user: User) => {
    setEditUser(user);
    setForm({ name: user.name, username: user.username, email: user.email, password: "", role: user.role, isActive: user.isActive });
    setFormError("");
  };

  const handleResetOpen = (user: User) => {
    setResetTarget(user);
    setNewPassword("");
    setConfirmPassword("");
    setFormError("");
  };

  const validateBasic = () => {
    if (!form.name.trim() || !form.username.trim() || !form.email.trim()) return "Nama, username, dan email wajib diisi";
    if (!/^[a-zA-Z0-9._]{3,30}$/.test(form.username.trim())) return "Username 3-30 karakter, hanya huruf, angka, titik, atau garis bawah";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Format email tidak valid";
    return "";
  };

  const handleCreateSubmit = async () => {
    const err = validateBasic();
    if (err) return setFormError(err);
    if (form.password.length < MIN_PASSWORD) return setFormError(`Password minimal ${MIN_PASSWORD} karakter`);
    try {
      const created = await createUser({
        name: form.name.trim(), username: form.username.trim(), email: form.email.trim(),
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
    const err = validateBasic();
    if (err) return setFormError(err);
    try {
      await updateUser({
        userId:   editUser.userId,
        name:     form.name.trim(),
        username: form.username.trim(),
        email:    form.email.trim(),
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
    if (newPassword.length < MIN_PASSWORD) return setFormError(`Password minimal ${MIN_PASSWORD} karakter`);
    if (newPassword !== confirmPassword) return setFormError("Konfirmasi password tidak sama");
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

  const columns: GridColDef[] = [
    { field: "name",     headerName: "Nama",     flex: 1, minWidth: 160 },
    { field: "username", headerName: "Username", width: 140 },
    { field: "email",    headerName: "Email",    flex: 1, minWidth: 200 },
    { field: "role",     headerName: "Peran",    width: 140, renderCell: (p) => getRoleBadge(p.value) },
    {
      field: "isActive",
      headerName: "Status",
      width: 110,
      renderCell: (p) => p.value
        ? <span className="flex h-full items-center gap-1 text-xs font-semibold text-green-600"><ShieldCheckIcon className="h-3.5 w-3.5" /> Aktif</span>
        : <span className="flex h-full items-center gap-1 text-xs font-semibold text-red-500"><ShieldAlertIcon className="h-3.5 w-3.5" /> Nonaktif</span>,
    },
    {
      field: "actions",
      headerName: "Aksi",
      width: 130,
      sortable: false,
      renderCell: (params) => {
        const isSelf = params.row.userId === currentUser?.userId;
        return (
          <div className="flex h-full items-center gap-1">
            <button onClick={() => handleEditOpen(params.row)} className="rounded p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30" title="Ubah">
              <PencilIcon className="h-4 w-4" />
            </button>
            <button onClick={() => handleResetOpen(params.row)} className="rounded p-1 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30" title="Reset password">
              <KeyRoundIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => { if (!isSelf) { setFormError(""); setDeleteTarget(params.row); } }}
              disabled={isSelf}
              className={`rounded p-1 ${isSelf ? "cursor-not-allowed text-gray-300 dark:text-gray-600" : "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"}`}
              title={isSelf ? "Tidak bisa menghapus akun sendiri" : "Hapus"}
            >
              <Trash2Icon className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  if (isLoading) return <div className="py-4 dark:text-gray-100">Memuat pengguna...</div>;
  if (isError || !users) return <div className="py-4 text-center text-red-500">Gagal memuat data pengguna</div>;

  const modalBg  = "fixed inset-0 z-50 flex items-center justify-center";
  const cardCss  = `relative z-50 w-full max-w-md rounded-2xl p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"}`;
  const inputCss = `mb-3 block w-full rounded-md border-2 p-2 text-sm ${isDarkMode ? "border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400" : "border-gray-300 bg-white text-gray-900"} disabled:opacity-60`;
  const labelCss = `block text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`;
  const btnSecondary = `px-4 py-2 rounded-lg text-sm ${isDarkMode ? "bg-gray-700 text-gray-200 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`;
  const btnPrimary = "px-4 py-2 rounded-lg text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60";

  const dataGridSx = {
    border: "none",
    "& .MuiDataGrid-withBorderColor":  { borderColor: isDarkMode ? "#374151" : "#e5e7eb" },
    "& .MuiDataGrid-cell":             { color: isDarkMode ? "#f3f4f6" : "#374151", borderColor: isDarkMode ? "#374151" : "#e5e7eb" },
    "& .MuiDataGrid-columnHeaders":    { backgroundColor: isDarkMode ? "#1f2937" : "#f9fafb", borderColor: isDarkMode ? "#374151" : "#e5e7eb" },
    "& .MuiDataGrid-columnHeader":     { backgroundColor: isDarkMode ? "#1f2937" : "#f9fafb" },
    "& .MuiDataGrid-columnHeaderTitle":{ color: isDarkMode ? "#f3f4f6" : "#374151", fontWeight: 600 },
    "& .MuiDataGrid-footerContainer":  { backgroundColor: isDarkMode ? "#1f2937" : "#f9fafb", color: isDarkMode ? "#f3f4f6" : "#374151", borderColor: isDarkMode ? "#374151" : "#e5e7eb" },
    "& .MuiTablePagination-root":      { color: isDarkMode ? "#f3f4f6" : "#374151" },
    "& .MuiIconButton-root":           { color: isDarkMode ? "#f3f4f6" : "#374151" },
    "& .MuiDataGrid-virtualScroller":  { backgroundColor: isDarkMode ? "#111827" : "#ffffff" },
    "& .MuiDataGrid-row":              { backgroundColor: isDarkMode ? "#111827" : "#ffffff" },
    "& .MuiDataGrid-row:hover":        { backgroundColor: isDarkMode ? "#1f2937" : "#f3f4f6" },
    "& .MuiDataGrid-overlay":          { backgroundColor: isDarkMode ? "#111827" : "#ffffff", color: isDarkMode ? "#9ca3af" : "#6b7280" },
  };

  const errorBox = formError && (
    <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{formError}</div>
  );

  const renderFormFields = (isEdit: boolean) => (
    <>
      {errorBox}
      <label className={labelCss}>Nama Lengkap</label>
      <input type="text" placeholder="Nama lengkap" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputCss} />
      <label className={labelCss}>Username</label>
      <input type="text" placeholder="username" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} className={inputCss} />
      <label className={labelCss}>Email</label>
      <input type="email" placeholder="email@contoh.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputCss} />
      {!isEdit && (
        <>
          <label className={labelCss}>Password</label>
          <input type="password" placeholder={`Minimal ${MIN_PASSWORD} karakter`} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className={inputCss} />
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

      <DataGrid
        rows={filteredUsers}
        columns={columns}
        disableColumnMenu
        rowHeight={56}
        getRowId={(row: User) => row.userId}
        disableRowSelectionOnClick
        localeText={{ noRowsLabel: "Tidak ada pengguna" }}
        className={`rounded-lg border shadow ${isDarkMode ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-white"}`}
        sx={dataGridSx}
      />

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
            <label className={labelCss}>Password Baru</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={`Minimal ${MIN_PASSWORD} karakter`} className={inputCss} />
            <label className={labelCss}>Ulangi Password Baru</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCss} />
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
