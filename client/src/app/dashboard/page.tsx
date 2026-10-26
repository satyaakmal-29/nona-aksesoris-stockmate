"use client";

import Link from "next/link";
import { useAppSelector } from "@/app/redux";
import {
  DashboardData,
  DashboardStockItem,
  useGetDashboardQuery,
  useGetPurchaseOrdersQuery,
  useGetStoreReplenishmentsQuery,
} from "@/state/api";
import { LOW_STOCK_GUDANG, LOW_STOCK_TOKO } from "@/lib/stockThresholds";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BanknoteIcon,
  ClockIcon,
  PackageCheckIcon,
  PackageIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TruckIcon,
  WalletIcon,
  WarehouseIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// ── Helper ────────────────────────────────────────────────────────
const formatRupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

const formatShortRupiah = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000_000) return `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  return formatRupiah(n);
};

const PAYMENT_LABELS: Record<string, string> = { cash: "Tunai", transfer: "Transfer", qris: "QRIS" };

const useCardCss = () => {
  const isDarkMode = useAppSelector((s) => s.global.isDarkMode);
  return {
    isDarkMode,
    card: `rounded-xl border p-5 shadow-sm ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`,
  };
};

// ── Komponen kecil ────────────────────────────────────────────────
// Tombol aksi di pojok kartu (kapsul kecil + panah yang bergeser saat disorot).
// tone="soft": di kotak berwarna (peringatan) mengikuti warna teks kotaknya.
const CardAction = ({ href, label, tone = "brand" }: { href: string; label: string; tone?: "brand" | "soft" }) => (
  <Link
    href={href}
    className={`group inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors focus:outline-none focus-visible:ring-2 ${
      tone === "brand"
        ? "bg-brand-50 text-brand-600 ring-brand-100 hover:bg-brand-100 hover:ring-brand-200 focus-visible:ring-brand-400 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20 dark:hover:bg-brand-500/20"
        : "bg-white/70 text-current ring-current/20 hover:bg-white focus-visible:ring-current dark:bg-white/5 dark:hover:bg-white/10"
    }`}
  >
    {label}
    <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
  </Link>
);

const StatCard = ({
  title, value, sub, icon: Icon, iconColor, trend, href, valueClass,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  trend?: number | null;
  href?: string;
  valueClass?: string;
}) => {
  const { card } = useCardCss();
  const body = (
    <div className={`${card} h-full ${href ? "transition-shadow hover:shadow-md" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</span>
        <div className={`rounded-lg p-2 ${iconColor}`}><Icon className="h-4 w-4 text-white" /></div>
      </div>
      <p className={`text-xl font-bold sm:text-2xl ${valueClass ?? "text-gray-800 dark:text-gray-100"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
      {trend !== undefined && (
        trend === null ? (
          <p className="mt-2 text-xs text-gray-400">Belum ada data bulan lalu</p>
        ) : (
          <div className={`mt-2 flex items-center gap-1 text-xs font-semibold ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
            {trend >= 0 ? <TrendingUpIcon className="h-3.5 w-3.5" /> : <TrendingDownIcon className="h-3.5 w-3.5" />}
            {trend >= 0 ? "+" : ""}{trend.toLocaleString("id-ID")}% dari bulan lalu
          </div>
        )
      )}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
};

const SalesChart = ({ data, color = "#c93e7b" }: { data: DashboardData["sales"]["daily"]; color?: string }) => {
  const { isDarkMode, card } = useCardCss();
  const hasData = data.some((d) => d.total > 0);
  return (
    <div className={card}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Penjualan 7 Hari Terakhir</h3>
        <CardAction href="/reports/sales" label="Laporan lengkap" />
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={data} margin={{ left: -10, right: 0, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#374151" : "#e5e7eb"} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => new Date(`${v}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
              tick={{ fontSize: 10, fill: isDarkMode ? "#9ca3af" : "#6b7280" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: isDarkMode ? "#9ca3af" : "#6b7280" }}
              tickFormatter={(v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : `${Math.round(v / 1000)}rb`)}
            />
            <Tooltip
              cursor={{ fill: isDarkMode ? "rgba(233,115,159,0.12)" : "rgba(201,62,123,0.08)" }}
              labelFormatter={(v) => new Date(`${String(v)}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
              formatter={(v: unknown, _n, item) => [
                `${formatRupiah(Number(v))} (${(item?.payload as { count?: number })?.count ?? 0} transaksi)`,
                "Penjualan",
              ]}
              contentStyle={{ backgroundColor: isDarkMode ? "#1f2937" : "#fff", borderColor: isDarkMode ? "#374151" : "#e5e7eb", fontSize: 12 }}
            />
            <Bar dataKey="total" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-48 items-center justify-center text-sm text-gray-400">Belum ada penjualan dalam 7 hari terakhir</div>
      )}
    </div>
  );
};

const TopProducts = ({ items }: { items: DashboardData["topProducts"] }) => {
  const { card } = useCardCss();
  return (
    <div className={card}>
      <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Produk Terlaris Bulan Ini</h3>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Belum ada penjualan bulan ini</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((p, i) => (
            <div key={p.name} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</p>
                <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                  <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.max(4, (p.qty / (items[0]?.qty || 1)) * 100)}%` }} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{p.qty} terjual</p>
                <p className="text-xs text-gray-400">{formatRupiah(p.revenue)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RecentTransactions = ({ items }: { items: DashboardData["recentTransactions"] }) => {
  const { card, isDarkMode } = useCardCss();
  return (
    <div className={card}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Transaksi Terakhir</h3>
        <CardAction href="/transactions" label="Lihat semua" />
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Belum ada transaksi</p>
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <div key={t.transactionId} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${isDarkMode ? "bg-gray-700/50" : "bg-gray-50"}`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{t.transactionNumber}</p>
                <p className="text-xs text-gray-400">
                  {new Date(t.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {" • "}{t.cashierName} • {PAYMENT_LABELS[t.paymentMethod] ?? t.paymentMethod}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-gray-800 dark:text-gray-100">{formatRupiah(t.totalAmount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const StockAlert = ({
  title, items, total, tone, href, unit,
}: {
  title: string;
  items: DashboardStockItem[];
  total: number;
  tone: "red" | "orange" | "yellow";
  href: string;
  unit: boolean;
}) => {
  if (total === 0) return null;
  const tones = {
    red:    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400",
    orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
  };
  const chip = {
    red:    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="h-4 w-4" />
          <h3 className="text-sm font-bold">{title} ({total})</h3>
        </div>
        <CardAction href={href} label="Lihat stok" tone="soft" />
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((p) => (
          <span key={p.productId} className={`rounded-lg px-2 py-1 text-xs font-semibold ${chip[tone]}`}>
            {p.name}{unit ? ` (${p.stock})` : ""}
          </span>
        ))}
        {total > items.length && <span className="px-2 py-1 text-xs font-semibold">+{total - items.length} lainnya</span>}
      </div>
    </div>
  );
};

const QuickLink = ({ href, icon: Icon, label, color }: { href: string; icon: React.ElementType; label: string; color: string }) => (
  <Link href={href}>
    <div className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${color}`}>
      <Icon className="h-5 w-5" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  </Link>
);

// ── Dashboard Super Admin ─────────────────────────────────────────
const DashboardSuperAdmin = ({ d }: { d: DashboardData }) => {
  const { card } = useCardCss();
  const ex = d.expenses;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Penjualan Hari Ini" value={formatShortRupiah(d.sales.todayAmount)} sub={`${d.sales.todayCount} transaksi`} icon={ReceiptIcon} iconColor="bg-blue-500" href="/transactions" />
        <StatCard title="Penjualan Bulan Ini" value={formatShortRupiah(d.sales.monthAmount)} sub={`${d.sales.monthCount} transaksi`} icon={BanknoteIcon} iconColor="bg-green-500" trend={d.sales.changePercent} href="/reports/sales" />
        {ex && (
          <StatCard
            title="Pengeluaran Bulan Ini"
            value={formatShortRupiah(ex.monthTotal)}
            sub={`Operasional ${formatShortRupiah(ex.monthOperational)} • Pembelian ${formatShortRupiah(ex.monthPurchases)}`}
            icon={WalletIcon}
            iconColor="bg-red-500"
            href="/expenses"
          />
        )}
        {ex && (
          <StatCard
            title="Selisih Kas Bulan Ini"
            value={formatShortRupiah(ex.cashFlowMonth)}
            sub="Penjualan − pengeluaran"
            icon={ex.cashFlowMonth >= 0 ? TrendingUpIcon : TrendingDownIcon}
            iconColor={ex.cashFlowMonth >= 0 ? "bg-emerald-500" : "bg-orange-500"}
            valueClass={ex.cashFlowMonth >= 0 ? "text-emerald-600" : "text-red-600"}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="PO Supplier Menunggu" value={String(d.purchaseOrders.pending)} sub="menunggu penerimaan gudang" icon={ShoppingCartIcon} iconColor="bg-amber-500" href="/purchase-orders" />
        <StatCard title="Permintaan Toko" value={String(d.replenishments.pending + d.replenishments.approved)} sub={`${d.replenishments.pending} menunggu • ${d.replenishments.approved} siap kirim • ${d.replenishments.shipped} dikirim`} icon={TruckIcon} iconColor="bg-purple-500" href="/store-replenishments" />
        <StatCard title="Stok Gudang Menipis" value={String(d.stock.lowGudangCount)} sub={`produk < ${LOW_STOCK_GUDANG} unit`} icon={WarehouseIcon} iconColor="bg-yellow-500" href="/inventory/gudang" />
        <StatCard title="Habis di Toko" value={String(d.stock.outTokoCount)} sub={`${d.stock.lowTokoCount} produk menipis (< ${LOW_STOCK_TOKO})`} icon={AlertTriangleIcon} iconColor="bg-red-500" href="/inventory/toko" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SalesChart data={d.sales.daily} />
        <div className={card}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pengeluaran Bulan Ini</h3>
            <CardAction href="/expenses" label="Kelola" />
          </div>
          {!ex || ex.monthTotal === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Belum ada pengeluaran bulan ini</p>
          ) : (
            <div className="space-y-2">
              {[...ex.byCategory, ...(ex.monthPurchases > 0 ? [{ category: "Pembelian Stok", amount: ex.monthPurchases }] : [])]
                .sort((a, b) => b.amount - a.amount)
                .map((c) => (
                  <div key={c.category}>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{c.category}</span>
                      <span className="font-medium text-gray-800 dark:text-gray-100">{formatRupiah(c.amount)}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                      <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${Math.max(3, (c.amount / ex.monthTotal) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              <div className="flex justify-between border-t pt-2 text-sm font-bold dark:border-gray-700">
                <span>Total</span>
                <span>{formatRupiah(ex.monthTotal)}</span>
              </div>
              {ex.changePercent !== null && (
                <p className={`text-xs ${ex.changePercent > 0 ? "text-red-500" : "text-green-500"}`}>
                  {ex.changePercent > 0 ? "Naik" : "Turun"} {Math.abs(ex.changePercent).toLocaleString("id-ID")}% dari bulan lalu
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TopProducts items={d.topProducts} />
        <RecentTransactions items={d.recentTransactions} />
      </div>

      <StockAlert title="Produk Habis di Toko" items={d.stock.outTokoItems} total={d.stock.outTokoCount} tone="red" href="/inventory/toko" unit={false} />
      <StockAlert title={`Stok Gudang Menipis (< ${LOW_STOCK_GUDANG})`} items={d.stock.lowGudangItems} total={d.stock.lowGudangCount} tone="yellow" href="/inventory/gudang" unit />
    </div>
  );
};

// ── Dashboard Admin Gudang ────────────────────────────────────────
const DashboardAdminGudang = ({ d }: { d: DashboardData }) => {
  const { card, isDarkMode } = useCardCss();
  const { data: pendingSRs } = useGetStoreReplenishmentsQuery("pending");
  const { data: approvedSRs } = useGetStoreReplenishmentsQuery("approved");
  const { data: pendingPOs } = useGetPurchaseOrdersQuery("pending");

  const rowCss = `flex items-center justify-between gap-3 rounded-lg p-3 transition-colors ${isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-50 hover:bg-gray-100"}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <StatCard title="Permintaan Toko Menunggu" value={String(d.replenishments.pending)} sub="perlu disetujui / ditolak" icon={ClockIcon} iconColor="bg-yellow-500" href="/store-replenishments" />
        <StatCard title="Siap Dikirim ke Toko" value={String(d.replenishments.approved)} sub="sudah disetujui, validasi pengiriman" icon={TruckIcon} iconColor="bg-purple-500" href="/store-replenishments" />
        <StatCard title="PO Supplier Menunggu" value={String(d.purchaseOrders.pending)} sub="validasi saat barang tiba" icon={ShoppingCartIcon} iconColor="bg-amber-500" href="/purchase-orders" />
        <StatCard title="Total Unit Gudang" value={d.stock.totalUnitsGudang.toLocaleString("id-ID")} sub={`${d.stock.totalProducts} produk`} icon={PackageIcon} iconColor="bg-blue-500" href="/inventory/gudang" />
        <StatCard title="Nilai Stok Gudang" value={formatShortRupiah(d.stock.valueGudang)} sub="stok × harga jual varian" icon={WarehouseIcon} iconColor="bg-green-500" />
        <StatCard title="Stok Gudang Menipis" value={String(d.stock.lowGudangCount)} sub={`produk < ${LOW_STOCK_GUDANG} unit`} icon={AlertTriangleIcon} iconColor="bg-red-500" href="/inventory/gudang" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className={card}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Permintaan Toko Perlu Diproses</h3>
            <CardAction href="/store-replenishments" label="Lihat semua" />
          </div>
          {[...(pendingSRs ?? []), ...(approvedSRs ?? [])].length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Tidak ada permintaan yang perlu diproses</p>
          ) : (
            <div className="space-y-2">
              {[...(pendingSRs ?? []), ...(approvedSRs ?? [])].slice(0, 5).map((sr) => (
                <Link href="/store-replenishments" key={sr.srId}>
                  <div className={rowCss}>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{sr.srNumber}</p>
                      <p className="text-xs text-gray-400">{sr.Items.length} item • {sr.createdBy?.name}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${sr.status === "pending" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"}`}>
                      {sr.status === "pending" ? "Perlu persetujuan" : "Siap dikirim"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className={card}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">PO Supplier Menunggu Barang</h3>
            <CardAction href="/purchase-orders" label="Lihat semua" />
          </div>
          {(pendingPOs ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Tidak ada PO yang menunggu</p>
          ) : (
            <div className="space-y-2">
              {(pendingPOs ?? []).slice(0, 5).map((po) => (
                <Link href="/purchase-orders" key={po.poId}>
                  <div className={rowCss}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{po.poNumber}</p>
                      <p className="truncate text-xs text-gray-400">{po.supplier} • resi {po.trackingNumber}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">{po.Items.length} item</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <StockAlert title={`Stok Gudang Menipis (< ${LOW_STOCK_GUDANG})`} items={d.stock.lowGudangItems} total={d.stock.lowGudangCount} tone="yellow" href="/inventory/gudang" unit />
      <StockAlert title="Produk Habis di Toko" items={d.stock.outTokoItems} total={d.stock.outTokoCount} tone="red" href="/inventory/toko" unit={false} />
    </div>
  );
};

// ── Dashboard Admin Toko ──────────────────────────────────────────
const DashboardAdminToko = ({ d }: { d: DashboardData }) => {
  const { card } = useCardCss();
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="Penjualan Hari Ini" value={formatShortRupiah(d.sales.todayAmount)} sub={`${d.sales.todayCount} transaksi`} icon={ReceiptIcon} iconColor="bg-blue-500" href="/transactions" />
        <StatCard title="Penjualan Bulan Ini" value={formatShortRupiah(d.sales.monthAmount)} sub={`${d.sales.monthCount} transaksi`} icon={BanknoteIcon} iconColor="bg-green-500" trend={d.sales.changePercent} href="/reports/sales" />
        <StatCard title="Barang Dalam Pengiriman" value={String(d.replenishments.shipped)} sub="konfirmasi saat barang tiba" icon={PackageCheckIcon} iconColor="bg-purple-500" href="/store-replenishments" />
        <StatCard title="Stok Toko Perlu Diisi" value={String(d.stock.outTokoCount + d.stock.lowTokoCount)} sub={`${d.stock.outTokoCount} habis • ${d.stock.lowTokoCount} menipis (< ${LOW_STOCK_TOKO})`} icon={AlertTriangleIcon} iconColor="bg-red-500" href="/inventory/toko" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SalesChart data={d.sales.daily} color="#e9739f" />
        <RecentTransactions items={d.recentTransactions} />
      </div>

      <StockAlert title="Produk Habis di Toko — hubungi Admin Gudang / Super Admin" items={d.stock.outTokoItems} total={d.stock.outTokoCount} tone="red" href="/inventory/toko" unit={false} />
      <StockAlert title={`Stok Toko Menipis (< ${LOW_STOCK_TOKO})`} items={d.stock.lowTokoItems} total={d.stock.lowTokoCount} tone="orange" href="/inventory/toko" unit />

      <div className={card}>
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Aksi Cepat</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickLink href="/transactions" icon={ReceiptIcon} label="Transaksi Baru" color="border-blue-200 bg-blue-50 text-blue-600 hover:border-blue-400 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400" />
          <QuickLink href="/inventory/toko" icon={PackageIcon} label="Cek Stok Toko" color="border-green-200 bg-green-50 text-green-600 hover:border-green-400 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400" />
          <QuickLink href="/store-replenishments" icon={TruckIcon} label="Terima Barang" color="border-purple-200 bg-purple-50 text-purple-600 hover:border-purple-400 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-400" />
        </div>
      </div>
    </div>
  );
};

// ── Halaman ───────────────────────────────────────────────────────
const TITLES: Record<string, string> = {
  super_admin:  "Dashboard",
  admin_gudang: "Dashboard Gudang",
  admin_toko:   "Dashboard Toko",
};

const Dashboard = () => {
  const currentUser = useAppSelector((s) => s.global.currentUser);
  const role = currentUser?.role ?? "";
  const { data, isLoading, isError, refetch } = useGetDashboardQuery(undefined, { pollingInterval: 60_000 });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{TITLES[role] ?? "Dashboard"}</h2>
          <p className="text-xs text-gray-400">
            Halo, {currentUser?.name ?? "—"} • {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        {data && (
          <p className="text-xs text-gray-400">
            Diperbarui {new Date(data.generatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      )}

      {isError && (
        <div className="py-10 text-center text-sm text-red-500">
          Gagal memuat dashboard. <button onClick={() => refetch()} className="font-semibold underline">Coba lagi</button>
        </div>
      )}

      {data && data.pendingQris > 0 && role !== "admin_gudang" && (
        <Link href="/transactions">
          <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 hover:bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
            <ClockIcon className="h-4 w-4 shrink-0" />
            {data.pendingQris} transaksi QRIS menunggu konfirmasi pembayaran — buka Transaksi untuk mengonfirmasi atau membatalkan.
          </div>
        </Link>
      )}

      {data && role === "admin_gudang" && <DashboardAdminGudang d={data} />}
      {data && role === "admin_toko" && <DashboardAdminToko d={data} />}
      {data && role !== "admin_gudang" && role !== "admin_toko" && <DashboardSuperAdmin d={data} />}
    </div>
  );
};

export default Dashboard;
