"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import FieldError from "@/app/(components)/FieldError";
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
} from "@/lib/validation";

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  // Error per kolom tampil setelah tombol ditekan, lalu diperbarui saat mengetik
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Cek apakah sudah pernah setup
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/check-setup`
        );
        const data = await res.json();
        if (data.isSetup) {
          // Sudah ada user → redirect ke login
          router.replace("/login");
        }
      } catch {
        // server tidak bisa direach, biarkan halaman tampil
      } finally {
        setChecking(false);
      }
    };
    checkSetup();
  }, [router]);

  const errors = {
    name:     personNameError(form.name),
    username: usernameError(form.username),
    email:    gmailError(form.email),
    password: passwordError(form.password, form.username),
    confirm:  confirmPasswordError(form.password, form.confirm),
  };
  const fieldError = (key: keyof typeof errors) => (showErrors ? errors[key] : "");

  const inputCss = (key: keyof typeof errors) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
      fieldError(key) ? "border-red-400" : "border-gray-300"
    }`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/init`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:     squeeze(form.name),
            username: form.username.trim(),
            email:    form.email.trim().toLowerCase(),
            password: form.password,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Gagal terhubung ke server. Pastikan server berjalan.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-brand-100 bg-white/90 p-8 shadow-xl shadow-brand-100/60 backdrop-blur">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <Image
              src="/assets/logo-nona.jpg"
              alt="Logo Nona Aksesoris"
              width={88}
              height={88}
              priority
              className="rounded-2xl shadow-md ring-4 ring-brand-50"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Setup Awal Nona Aksesoris</h1>
          <p className="text-sm text-gray-500 mt-1">
            Buat akun Super Admin untuk pertama kali
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 text-xs font-medium px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            Halaman ini hanya tersedia sekali
          </div>
        </div>

        {/* Success State */}
        {success ? (
          <div className="text-center py-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-800">
              Akun Super Admin Berhasil Dibuat!
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Mengalihkan ke halaman login...
            </p>
          </div>
        ) : (
          <>
            {/* Error dari server */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="setup-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  id="setup-name"
                  type="text"
                  maxLength={MAX_LEN.personName}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCss("name")}
                  placeholder="Nama lengkap admin"
                />
                <FieldError message={fieldError("name")} />
              </div>

              <div>
                <label htmlFor="setup-username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  id="setup-username"
                  type="text"
                  maxLength={MAX_LEN.username}
                  value={form.username}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      username: e.target.value.toLowerCase().replace(/\s/g, ""),
                    })
                  }
                  className={inputCss("username")}
                  placeholder="superadmin"
                />
                <FieldError message={fieldError("username")} />
              </div>

              <div>
                <label htmlFor="setup-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email (Gmail)
                </label>
                <input
                  id="setup-email"
                  type="email"
                  inputMode="email"
                  maxLength={MAX_LEN.email}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputCss("email")}
                  placeholder="nama@gmail.com"
                />
                <FieldError message={fieldError("email")} />
              </div>

              <div>
                <label htmlFor="setup-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="setup-password"
                    type={showPassword ? "text" : "password"}
                    maxLength={MAX_PASSWORD}
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    className={`${inputCss("password")} pr-10`}
                    placeholder="Contoh: nona2026"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {fieldError("password") ? (
                  <FieldError message={fieldError("password")} />
                ) : (
                  <p className="text-xs text-gray-400 mt-1">{PASSWORD_HINT}</p>
                )}
              </div>

              <div>
                <label htmlFor="setup-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                  Ulangi Password
                </label>
                <input
                  id="setup-confirm"
                  type={showPassword ? "text" : "password"}
                  maxLength={MAX_PASSWORD}
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  className={inputCss("confirm")}
                />
                <FieldError message={fieldError("confirm")} />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50 transition-colors mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Membuat akun...
                  </span>
                ) : (
                  "Buat Akun Super Admin"
                )}
              </button>
            </form>
          </>
        )}

        <p className="text-xs text-center text-gray-400 mt-6">
          Setelah setup, tambah admin_gudang & admin_toko lewat menu{" "}
          <span className="font-semibold">Users</span>
        </p>
      </div>
    </div>
  );
}
