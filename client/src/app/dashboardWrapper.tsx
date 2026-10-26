"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Navbar from "@/app/(components)/Navbar";
import Sidebar from "@/app/(components)/Sidebar";
import StoreProvider, { useAppDispatch, useAppSelector } from "./redux";
import { setCurrentUser, clearCurrentUser } from "@/state";
import { api } from "@/state/api";

// Halaman yang tidak butuh auth
const AUTH_ROUTES = ["/login", "/register", "/setup"];

const isAuthRoute = (path: string) =>
  AUTH_ROUTES.some((r) => path.startsWith(r));

// Auth Guard + Layout
const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useAppDispatch();
  const pathname = usePathname() ?? "";

  const isSidebarCollapsed = useAppSelector((s) => s.global.isSidebarCollapsed);
  const isDarkMode         = useAppSelector((s) => s.global.isDarkMode);
  const isAuthenticated    = useAppSelector((s) => s.global.isAuthenticated);

  const [mounted, setMounted]   = useState(false);
  const [checking, setChecking] = useState(true);

  // Step 1: tandai sudah di client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Step 2: cek session hanya setelah mount (tetap sekali saja)
  useEffect(() => {
    if (!mounted) return;

    const currentPath = window.location.pathname;
    if (isAuthRoute(currentPath)) {
      setChecking(false);
      return;
    }

    const checkSession = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/me`,
          { credentials: "include" }
        );

        if (!res.ok) {
          // Sesi habis: buang juga cache RTK Query milik akun sebelumnya
          dispatch(clearCurrentUser());
          dispatch(api.util.resetApiState());
          window.location.href = "/login";
          return;
        }

        const me = await res.json();
        dispatch(setCurrentUser({
          userId:       me.userId,
          name:         me.name,
          username:     me.username,
          email:        me.email,
          role:         me.role,
          profileImage: me.profileImage ?? null,
          language:     me.language ?? "English",
          notification: me.notification ?? true,
          isActive:     me.isActive,
        }));
      } catch {
        dispatch(clearCurrentUser());
        window.location.href = "/login";
      } finally {
        setChecking(false);
      }
    };

    checkSession();
  }, [mounted, dispatch]);

  // Dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Sebelum mount: render children langsung
  if (!mounted) {
    return <div className={isDarkMode ? "dark" : ""}>{children}</div>;
  }

  // Halaman auth: render tanpa layout dashboard
  if (isAuthRoute(pathname)) {
    return <div className={isDarkMode ? "dark" : ""}>{children}</div>;
  }

  // Sedang cek session
  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Image src="/assets/logo-nona.jpg" alt="Nona Aksesoris" width={64} height={64} className="rounded-2xl shadow-md" priority />
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Memuat...</p>
        </div>
      </div>
    );
  }

  // Belum terauth
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex w-full min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Sidebar />
      <main
        className={`flex flex-col w-full h-full py-7 px-9 transition-colors duration-200 ${
          isSidebarCollapsed ? "md:pl-24" : "md:pl-72"
        }`}
      >
        <Navbar />
        {children}
      </main>
    </div>
  );
};

// Root Wrapper
const DashboardWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <StoreProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </StoreProvider>
  );
};

export default DashboardWrapper;