"use client";

import { useAppDispatch, useAppSelector } from "@/app/redux";
import { getTranslation } from "@/lib/translations";
import { setIsSidebarCollapsed } from "@/state";
import {
  BarChart3,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Layout,
  LucideIcon,
  Menu,
  Package,
  PackageSearch,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

// ── Tipe ─────────────────────────────────────────────────────────
interface SidebarLinkProps {
  href:        string;
  icon:        LucideIcon;
  label:       string;
  isCollapsed: boolean;
  badge?:      number; // untuk notifikasi count
}

interface SidebarSection {
  title:  string;
  links:  Omit<SidebarLinkProps, "isCollapsed">[];
}

// ── SidebarLink ───────────────────────────────────────────────────
const SidebarLink = ({ href, icon: Icon, label, isCollapsed, badge }: SidebarLinkProps) => {
  const pathname = usePathname();
  const isActive = pathname === href || (pathname === "/" && href === "/dashboard");

  return (
    <Link href={href}>
      <div
        className={`relative cursor-pointer flex items-center gap-3 transition-colors
          ${isCollapsed ? "justify-center py-4 px-2" : "justify-start px-6 py-3"}
          hover:text-blue-500 dark:hover:text-blue-400
          hover:bg-blue-50 dark:hover:bg-blue-900/40
          ${isActive
            ? "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 border-r-4 border-blue-500"
            : "text-gray-600 dark:text-gray-300"
          }`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />

        {!isCollapsed && (
          <span className="font-medium text-sm">{label}</span>
        )}

        {/* Badge notifikasi */}
        {badge !== undefined && badge > 0 && (
          <span className={`
            absolute flex items-center justify-center
            rounded-full bg-red-500 text-white text-xs font-bold
            ${isCollapsed ? "top-1 right-1 w-4 h-4" : "ml-auto w-5 h-5"}
          `}>
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </div>
    </Link>
  );
};

// ── SidebarSectionHeader ──────────────────────────────────────────
const SectionHeader = ({ title, isCollapsed }: { title: string; isCollapsed: boolean }) => {
  if (isCollapsed) return <div className="my-2 border-t border-gray-200 dark:border-gray-700" />;
  return (
    <p className="px-6 pt-5 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
      {title}
    </p>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────
const Sidebar = () => {
  const dispatch        = useAppDispatch();
  const isSidebarCollapsed = useAppSelector((s) => s.global.isSidebarCollapsed);
  const currentLanguage    = useAppSelector((s) => s.global.language);
  const currentUser        = useAppSelector((s) => s.global.currentUser);
  const t = getTranslation(currentLanguage).sidebar;

  const role = currentUser?.role ?? "";

  const toggleSidebar = () => {
    dispatch(setIsSidebarCollapsed(!isSidebarCollapsed));
  };

  // ── Menu per role ───────────────────────────────────────────────
  const getSections = (): SidebarSection[] => {
    // Menu yang sama untuk semua role
    const commonSection: SidebarSection = {
      title: t.general ?? "Umum",
      links: [
        { href: "/dashboard", icon: Layout,      label: t.dashboard ?? "Dashboard" },
      ],
    };

    if (role === "super_admin") {
      return [
        commonSection,
        {
          title: t.management ?? "Manajemen",
          links: [
            { href: "/products",        icon: Package,       label: t.products       ?? "Produk"           },
            { href: "/purchase-orders", icon: ShoppingCart,  label: t.purchaseOrders ?? "Purchase Order"   },
            { href: "/store-replenishments", icon: Truck,    label: t.storeReplenishments ?? "Store Replenishment" },
            { href: "/inventory/toko",  icon: PackageSearch, label: t.stockToko      ?? "Stok Toko"        },
            { href: "/inventory/gudang",icon: Warehouse,     label: t.stockGudang    ?? "Stok Gudang"      },
            { href: "/transactions",    icon: Receipt,       label: t.transactions   ?? "Transaksi"        },
          ],
        },
        {
          title: t.reports ?? "Laporan",
          links: [
            { href: "/reports/sales",   icon: BarChart3,     label: t.salesReport    ?? "Laporan Penjualan" },
            { href: "/reports/stock",   icon: ClipboardList, label: t.stockReport    ?? "Laporan Stok"      },
            { href: "/expenses",        icon: CircleDollarSign, label: t.expenses    ?? "Pengeluaran"       },
          ],
        },
        {
          title: t.system ?? "Sistem",
          links: [
            { href: "/users",    icon: Users,    label: t.users    ?? "Pengguna"    },
            { href: "/settings", icon: Settings, label: t.settings ?? "Pengaturan" },
          ],
        },
      ];
    }

    if (role === "admin_gudang") {
      return [
        commonSection,
        {
          title: t.warehouse ?? "Gudang",
          links: [
            { href: "/inventory/gudang",  icon: Warehouse,     label: t.stockGudang    ?? "Stok Gudang"    },
            { href: "/inventory/toko",    icon: PackageSearch, label: t.stockToko      ?? "Stok Toko"      },
            { href: "/purchase-orders",      icon: ShoppingCart, label: t.purchaseOrders      ?? "Purchase Order"      },
            { href: "/store-replenishments", icon: Truck,        label: t.storeReplenishments ?? "Store Replenishment" },
          ],
        },
        {
          title: t.reports ?? "Laporan",
          links: [
            { href: "/reports/stock", icon: ClipboardList, label: t.stockReport ?? "Laporan Stok" },
          ],
        },
        {
          title: t.system ?? "Sistem",
          links: [
            { href: "/settings", icon: Settings, label: t.settings ?? "Pengaturan" },
          ],
        },
      ];
    }

    if (role === "admin_toko") {
      return [
        commonSection,
        {
          title: t.sales ?? "Penjualan",
          links: [
            { href: "/transactions",    icon: Receipt,       label: t.transactions ?? "Transaksi"   },
            { href: "/inventory/toko",  icon: PackageSearch, label: t.stockToko    ?? "Stok Toko"   },
            { href: "/store-replenishments", icon: Truck,    label: t.storeReplenishments ?? "Store Replenishment" },
            { href: "/reports/sales",   icon: BarChart3,     label: t.salesReport  ?? "Lap. Penjualan" },
          ],
        },
        {
          title: t.system ?? "Sistem",
          links: [
            { href: "/settings", icon: Settings, label: t.settings ?? "Pengaturan" },
          ],
        },
      ];
    }

    // Fallback
    return [commonSection];
  };

  const sections = getSections();

  const sidebarClass = `fixed flex flex-col ${
    isSidebarCollapsed ? "w-0 md:w-16" : "w-72 md:w-64"
  } bg-white/95 backdrop-blur dark:bg-gray-800/95 transition-all duration-300 overflow-hidden h-full shadow-[4px_0_24px_-12px_rgba(201,62,123,0.25)] z-40 border-r border-brand-100 dark:border-gray-700`;

  return (
    <div className={sidebarClass}>

      {/* ── LOGO ──────────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 pt-5 pb-4 border-b border-brand-100 bg-gradient-to-b from-brand-50 to-white dark:border-gray-700 dark:from-gray-800 dark:to-gray-800 ${
        isSidebarCollapsed ? "justify-center px-2" : "justify-between px-5"
      }`}>
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/assets/logo-nona.jpg"
            alt="Logo Nona Aksesoris"
            width={isSidebarCollapsed ? 36 : 44}
            height={isSidebarCollapsed ? 36 : 44}
            className="flex-shrink-0 rounded-xl shadow-sm ring-1 ring-brand-200"
            priority
          />
          {!isSidebarCollapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold leading-tight text-brand-700 dark:text-brand-300">
                Nona Aksesoris
              </h1>
              <p className="truncate text-[11px] font-medium text-gray-400 dark:text-gray-500">
                StockMate · Sistem Stok
              </p>
            </div>
          )}
        </div>

        {!isSidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── USER INFO ─────────────────────────────────────────── */}
      {!isSidebarCollapsed && currentUser && (
        <div className="px-6 py-3 border-b border-brand-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
            {currentUser.name}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
            {role === "super_admin"   ? "Super Admin"   :
             role === "admin_gudang" ? "Admin Gudang"  :
             role === "admin_toko"   ? "Admin Toko"    : role}
          </p>
        </div>
      )}

      {/* ── NAVIGATION ────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => (
          <div key={section.title}>
            <SectionHeader title={section.title} isCollapsed={isSidebarCollapsed} />
            {section.links.map((link) => (
              <SidebarLink
                key={link.href}
                href={link.href}
                icon={link.icon}
                label={link.label}
                isCollapsed={isSidebarCollapsed}
                badge={link.badge}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      {!isSidebarCollapsed && (
        <div className="px-6 py-4 border-t border-brand-100 dark:border-gray-700">
          <p className="text-xs text-center text-gray-400 dark:text-gray-500">
            &copy; 2026 Nona Aksesoris · StockMate
          </p>
        </div>
      )}
    </div>
  );
};

export default Sidebar;