"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/app/redux";
import { setCurrentUser } from "@/state";
import { api } from "@/state/api";
import { Eye, EyeOff, Lock, User, ExternalLink } from "lucide-react";
import Image from "next/image";
import LoginBackground from "./LoginBackground";

// Komponen SetupLink — hanya tampil jika belum ada user di DB
const SetupLink = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/check-setup`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.isSetup === false) setShow(true);
      } catch {
        // Gagal fetch → jangan tampilkan link
      }
    };
    check();
  }, []);

  if (!show) return null;

  return (
    <div className="mt-4 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Belum ada akun?{" "}
        <button
          type="button"
          onClick={() => { window.location.href = "/setup"; }}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline underline-offset-2"
        >
          Setup Super Admin
          <ExternalLink className="h-3 w-3" />
        </button>
      </p>
    </div>
  );
};

const LoginPage = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim() || !password.trim()) {
      setError("Username/email dan password wajib diisi.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: identifier, password }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Login gagal. Coba lagi.");
        return;
      }

      // Buang seluruh cache RTK Query milik akun sebelumnya
      // (profil, produk, notifikasi, dll.) agar tidak bocor ke akun baru.
      dispatch(api.util.resetApiState());

      dispatch(
        setCurrentUser({
          userId:       data.user.userId,
          name:         data.user.name,
          username:     data.user.username,
          email:        data.user.email,
          role:         data.user.role,
          profileImage: data.user.profileImage ?? null,
          language:     data.user.language ?? "English",
          notification: data.user.notification ?? true,
          isActive:     data.user.isActive,
        })
      );

      router.replace("/dashboard");
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi Anda.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // isolate: latar dekoratif (-z-10) tetap di atas gradasi halaman, di bawah form.
    // Form tetap di tengah; tulisan timbul "NONA" berada di belakangnya (lihat LoginBackground).
    // Ruang bawah disisakan untuk tulisan "AKSESORIS".
    <div className="relative isolate min-h-screen overflow-hidden flex items-center justify-center px-4 pt-10 pb-[38vw] md:pb-32">
      <LoginBackground />
      <div className="relative w-full max-w-md">
        {/* Logo / Judul */}
        <div className="text-center mb-7">
          <Image
            src="/assets/logo-nona.jpg"
            alt="Logo Nona Aksesoris"
            width={112}
            height={112}
            priority
            className="mx-auto rounded-3xl shadow-lg shadow-brand-200/60 ring-4 ring-white dark:ring-gray-800"
          />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-brand-700 dark:text-brand-300">
            Nona Aksesoris
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sistem Manajemen Stok · Masuk ke akun Anda
          </p>
        </div>

        {/* Card */}
        <div
          data-login-card
          className="nona-floating-card rounded-2xl border border-white/80 bg-white/95 p-8 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
        >
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 px-4 py-3">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Username / Email */}
            <div>
              <label
                htmlFor="identifier"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Username atau Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="username atau email@contoh.com"
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2.5 pl-10 pr-11 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Memproses...
                </span>
              ) : (
                "Masuk"
              )}
            </button>
          </form>

          {/* Setup Link */}
          <SetupLink />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;