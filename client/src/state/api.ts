import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════

export interface AuthUser {
  userId:       string;
  name:         string;
  username:     string;
  email:        string;
  role:         string; // "super_admin" | "admin_toko" | "admin_gudang"
  profileImage?: string | null;
  language?:    string;
  notification?: boolean;
  isActive:     boolean;
}

export interface LoginRequest {
  identifier: string;
  password:   string;
}

export interface RegisterRequest {
  name:     string;
  username: string;
  email:    string;
  password: string;
  role:     string;
}

// ═══════════════════════════════════════
// USERS
// ═══════════════════════════════════════

export interface User {
  userId:      string;
  name:        string;
  username:    string;
  email:       string;
  role:        string;
  isActive:    boolean;
  profileImage?: string | null;
  createdAt:   string;
}

export interface NewUser {
  name:     string;
  username: string;
  email:    string;
  password: string;
  role:     string;
}

export interface UpdateUser {
  userId:    string;
  name?:     string;
  username?: string;
  email?:    string;
  role?:     string;
  isActive?: boolean;
}

export interface UserProfile {
  userId:        string;
  name:          string;
  username:      string;
  email:         string;
  role:          string;
  profileImage?: string | null;
  language?:     string | null;
  notification?: boolean | null;
  isActive:      boolean;
}

export interface UpdateUserProfile {
  userId:        string;
  name?:         string;
  email?:        string;
  profileImage?: string;
  notification?: boolean;
  language?:     string;
}

// ═══════════════════════════════════════
// PRODUCTS & VARIANTS
// ═══════════════════════════════════════

export interface ProductVariant {
  variantId:   string;
  productId:   string;
  name:        string;            // nama varian (contoh: Safa Ather)
  type:        string;            // bawaan: "Ukuran"
  value:       string;            // ukuran (contoh: 30ml), bawaan: "-"
  imageUrl?:   string | null;     // UBAH: foto per varian
  stockGudang: number;
  stockToko:   number;
  price?:      number | null;
  isActive:    boolean;
}

export interface Product {
  productId:   string;
  name:        string;
  description?: string | null;
  category?:   string | null;
  price:       number;            // harga terendah dari varian
  rating?:     number | null;
  ratingCount: number;
  imageUrl?:   string | null;     // foto sampul produk
  isActive:    boolean;
  stockGudang: number;
  stockToko:   number;
  createdAt:   string;
  Variants:    ProductVariant[];
}

// UBAH: varian saat membuat produk (harga wajib, stok & foto opsional)
export interface NewProductVariant {
  name:         string;
  type?:        string;
  value?:       string;
  imageUrl?:    string | null;
  price:        number;
  stockGudang?: number;
  stockToko?:   number;
}

// UBAH: produk wajib punya minimal 1 varian; harga & stok diatur per varian
export interface NewProduct {
  name:         string;
  description?: string;
  category?:    string;
  imageUrl?:    string | null;
  variants:     NewProductVariant[];
}

export interface UpdateProduct {
  productId:    string;
  name?:        string;
  description?: string;
  category?:    string;
  price?:       number; // hanya berlaku untuk produk lama tanpa varian
  imageUrl?:    string | null;
  isActive?:    boolean;
}

// UBAH: tambah varian pada produk yang sudah ada
export interface NewVariant {
  productId:    string;
  name:         string;
  type?:        string;
  value?:       string;
  imageUrl?:    string | null;
  price:        number;
  stockGudang?: number;
  stockToko?:   number;
}

// UBAH: ubah varian (stok tidak diubah di sini, lewat mutasi stok)
export interface UpdateVariant {
  productId: string;
  variantId: string;
  name?:     string;
  type?:     string;
  value?:    string;
  imageUrl?: string | null;
  price?:    number;
}

export interface AddRating {
  productId: string;
  rating:    number;
}

// ═══════════════════════════════════════
// INFO ITEM (dipakai PO & Store Replenishment)
// ═══════════════════════════════════════

export interface ItemProductInfo {
  name:      string;
  imageUrl?: string | null;
}

export interface ItemVariantInfo {
  name:        string;
  value:       string;
  imageUrl?:   string | null;
  price?:      number | null;
  stockGudang: number;
  stockToko?:  number;
}

export interface DocUserInfo {
  name: string;
  role: string;
}

// ═══════════════════════════════════════
// PURCHASE ORDER (pembelian ke SUPPLIER)
// pending → received
// ═══════════════════════════════════════

export interface PurchaseOrderItem {
  poItemId:     string;
  poId:         string;
  productId:    string;
  variantId?:   string | null;
  qtyOrdered:   number;
  qtyReceived?: number | null;
  unitCost:     number;
  subtotal:     number;
  receiveNote?: string | null;
  product?:     ItemProductInfo;
  variant?:     ItemVariantInfo | null;
}

export interface PurchaseOrder {
  poId:                string;
  poNumber:            string;
  status:              "pending" | "received";
  supplier:            string;
  invoiceNumber:       string;
  trackingNumber:      string;
  invoiceDate:         string;
  invoiceTotal:        number;
  invoiceImage?:       string;        // hanya di endpoint detail
  deliveryNoteNumber?: string | null;
  receiptImage?:       string | null; // hanya di endpoint detail
  receiveNotes?:       string | null;
  notes?:              string | null;
  createdById:         string;
  validatedById?:      string | null;
  createdAt:           string;
  receivedAt?:         string | null;
  createdBy?:          DocUserInfo;
  validatedBy?:        DocUserInfo | null;
  Items:               PurchaseOrderItem[];
}

export interface NewPurchaseOrder {
  supplier:       string;
  invoiceNumber:  string;
  trackingNumber: string;
  invoiceDate:    string; // YYYY-MM-DD
  invoiceTotal:   number;
  invoiceImage:   string; // data URL
  notes?:         string;
  items: Array<{
    productId:  string;
    variantId?: string;
    qtyOrdered: number;
    unitCost:   number;
  }>;
}

export interface ReceivePurchaseOrder {
  poId:                string;
  receiptImage:        string; // data URL
  deliveryNoteNumber?: string;
  receiveNotes?:       string;
  receivedItems: Array<{
    poItemId:     string;
    qtyReceived:  number;
    receiveNote?: string;
  }>;
}

// ═══════════════════════════════════════
// STORE REPLENISHMENT (pengisian TOKO dari gudang)
// pending → approved → shipped → completed  |  pending → rejected
// ═══════════════════════════════════════

export type StoreReplenishmentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "shipped"
  | "completed";

export interface StoreReplenishmentItem {
  srItemId:     string;
  srId:         string;
  productId:    string;
  variantId?:   string | null;
  qtyRequested: number;
  qtyApproved?: number | null;
  qtyShipped?:  number | null;
  qtyReceived?: number | null;
  unitCost:     number;
  subtotal:     number;
  shipNote?:    string | null;
  receiveNote?: string | null;
  product?:     ItemProductInfo;
  variant?:     ItemVariantInfo | null;
}

export interface StoreReplenishment {
  srId:                string;
  srNumber:            string;
  status:              StoreReplenishmentStatus;
  notes?:              string | null;
  rejectedReason?:     string | null;
  deliveryNoteNumber?: string | null;
  courierName?:        string | null;
  deliveryNoteImage?:  string | null; // hanya di endpoint detail
  shipNotes?:          string | null;
  receiveImage?:       string | null; // hanya di endpoint detail
  receiveNotes?:       string | null;
  createdById:         string;
  approvedById?:       string | null;
  shippedById?:        string | null;
  receivedById?:       string | null;
  createdAt:           string;
  approvedAt?:         string | null;
  shippedAt?:          string | null;
  receivedAt?:         string | null;
  createdBy?:          DocUserInfo;
  approvedBy?:         DocUserInfo | null;
  shippedBy?:          DocUserInfo | null;
  receivedBy?:         DocUserInfo | null;
  Items:               StoreReplenishmentItem[];
}

export interface NewStoreReplenishment {
  notes?: string;
  items: Array<{
    productId:    string;
    variantId?:   string;
    qtyRequested: number;
    unitCost?:    number; // kosong = harga varian / produk
  }>;
}

export interface ApproveStoreReplenishment {
  srId: string;
  approvedItems: Array<{
    srItemId:    string;
    qtyApproved: number;
  }>;
}

export interface RejectStoreReplenishment {
  srId:   string;
  reason: string;
}

export interface ShipStoreReplenishment {
  srId:               string;
  deliveryNoteNumber: string;
  courierName:        string;
  deliveryNoteImage:  string; // data URL
  shipNotes?:         string;
  shippedItems: Array<{
    srItemId:   string;
    qtyShipped: number;
    shipNote?:  string;
  }>;
}

export interface ReceiveStoreReplenishment {
  srId:          string;
  receiveImage:  string; // data URL
  receiveNotes?: string;
  receivedItems: Array<{
    srItemId:     string;
    qtyReceived:  number;
    receiveNote?: string;
  }>;
}

// ═══════════════════════════════════════
// TRANSACTION
// ═══════════════════════════════════════

export interface TransactionItem {
  itemId:        string;
  transactionId: string;
  productId:     string;
  variantId?:    string | null;
  productName:   string;
  variantName?:  string | null;
  qty:           number;
  unitPrice:     number;
  subtotal:      number;
  product?:      { name: string; imageUrl?: string | null };
  variant?:      { name: string; value: string } | null;
}

export interface Transaction {
  transactionId:     string;
  transactionNumber: string;
  cashierId:         string;
  customerName?:     string | null;
  paymentMethod:     "cash" | "transfer" | "qris";
  paymentAmount:     number;
  totalAmount:       number;
  changeAmount:      number;
  notes?:            string | null;
  createdAt:         string;
  // Status pembayaran: QRIS dibuat "pending_payment" sampai kasir mengonfirmasi
  status:            "paid" | "pending_payment" | "cancelled";
  qrisPayload?:      string | null; // QRIS dinamis (nominal terisi)
  paidAt?:           string | null;
  cancelledAt?:      string | null;
  cancelReason?:     string | null;
  cashier?:          { name: string; username: string };
  confirmedBy?:      { name: string } | null;
  cancelledBy?:      { name: string } | null;
  Items:             TransactionItem[];
}

// Harga satuan ditentukan server dari katalog (harga varian / produk).
// paymentAmount wajib untuk tunai; transfer / QRIS selalu dibayar pas.
export interface NewTransaction {
  customerName?:  string;
  paymentMethod:  "cash" | "transfer" | "qris";
  paymentAmount?: number;
  notes?:         string;
  items: Array<{
    productId:  string;
    variantId?: string;
    qty:        number;
  }>;
}

export interface TransactionFilter {
  startDate?:     string;
  endDate?:       string;
  paymentMethod?: string;
  search?:        string;
  status?:        Transaction["status"];
}

// ═══════════════════════════════════════
// PENGATURAN TOKO (QRIS & identitas struk)
// ═══════════════════════════════════════

export interface StoreSettings {
  storeName:      string;
  storeAddress:   string;
  qrisConfigured: boolean;
  qrisMerchant?:  string | null;
  qrisCity?:      string | null;
  qrisPayload?:   string | null; // hanya dikirim ke Super Admin
  updatedAt:      string;
}

export interface UpdateStoreSettings {
  storeName?:    string;
  storeAddress?: string;
  qrisPayload?:  string | null; // null = hapus QRIS
}

// ═══════════════════════════════════════
// STOCK MOVEMENT
// ═══════════════════════════════════════

export interface StockMovement {
  id:            string;
  productId:     string;
  variantId?:    string | null;
  userId?:       string | null;
  location:      "gudang" | "toko";
  type:          string;
  quantity:      number;
  stockBefore:   number;
  stockAfter:    number;
  referenceId?:  string | null;
  referenceType?: string | null;
  notes?:        string | null;
  createdAt:     string;
  product?:      { name: string; category?: string | null };
  user?:         { name: string; role: string } | null;
}

// ═══════════════════════════════════════
// NOTIFICATION
// ═══════════════════════════════════════

export interface Notification {
  notifId:       string;
  userId:        string;
  title:         string;
  message:       string;
  type:          string;
  isRead:        boolean;
  referenceId?:  string | null;
  referenceType?: string | null;
  createdAt:     string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount:   number;
}

// ═══════════════════════════════════════
// REPORT
// ═══════════════════════════════════════

export interface SalesReport {
  summary: {
    totalRevenue:      number;
    totalTransaksi:    number;
    totalItemTerjual:  number;
    paymentBreakdown:  Record<string, number>;
  };
  topProducts: Array<{
    name:    string;
    qty:     number;
    revenue: number;
  }>;
  transactions: Transaction[];
}

export interface StockReport {
  products: Product[];
  summary: {
    totalProduk:    number;
    lowStockGudang: number;
    lowStockToko:   number;
    outOfStockToko: number;
  };
  alerts: {
    lowStockGudang: Product[];
    lowStockToko:   Product[];
    outOfStockToko: Product[];
  };
}

// ═══════════════════════════════════════
// EXPENSES (pengeluaran, Super Admin)
// ═══════════════════════════════════════

export const EXPENSE_CATEGORIES = [
  "Gaji",
  "Sewa",
  "Listrik & Air",
  "Internet & Telepon",
  "Transportasi",
  "Perlengkapan",
  "Perawatan",
  "Lainnya",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface OperationalExpense {
  expenseId:     string;
  expenseNumber: string;
  category:      ExpenseCategory;
  description:   string;
  amount:        number;
  expenseDate:   string;
  paymentMethod: "cash" | "transfer" | "qris";
  notes?:        string | null;
  hasReceipt?:   boolean;        // di daftar
  receiptImage?: string | null;  // hanya di endpoint detail
  createdAt:     string;
  updatedAt:     string;
  createdBy?:    { name: string };
  updatedBy?:    { name: string } | null;
}

export interface PurchaseExpense {
  poId:          string;
  poNumber:      string;
  supplier:      string;
  invoiceNumber: string;
  invoiceDate:   string;
  invoiceTotal:  number;
  status:        "pending" | "received";
}

export interface ExpensesResponse {
  expenses:  OperationalExpense[];
  purchases: PurchaseExpense[];
  summary: {
    totalOperational: number;
    totalPurchases:   number;
    total:            number;
    countOperational: number;
    countPurchases:   number;
    byCategory:       Record<string, number>;
  };
}

export interface ExpenseFilter {
  startDate?: string;
  endDate?:   string;
  category?:  string;
}

export interface ExpenseInput {
  category:      ExpenseCategory;
  description:   string;
  amount:        number;
  expenseDate:   string; // YYYY-MM-DD
  paymentMethod: "cash" | "transfer" | "qris";
  notes?:        string;
  receiptImage?: string | null; // tidak dikirim = foto tetap (saat ubah)
}

// ═══════════════════════════════════════
// DASHBOARD (data nyata, per peran)
// ═══════════════════════════════════════

export interface DashboardStockItem {
  productId: string;
  name:      string;
  stock:     number;
}

export interface DashboardData {
  role:        string;
  generatedAt: string;
  sales: {
    todayAmount:     number;
    todayCount:      number;
    monthAmount:     number;
    monthCount:      number;
    lastMonthAmount: number;
    changePercent:   number | null;
    daily:           Array<{ date: string; total: number; count: number }>;
  };
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
  pendingQris: number; // transaksi QRIS menunggu konfirmasi kasir
  recentTransactions: Array<{
    transactionId:     string;
    transactionNumber: string;
    createdAt:         string;
    totalAmount:       number;
    paymentMethod:     string;
    cashierName:       string;
  }>;
  stock: {
    totalProducts:    number;
    totalUnitsGudang: number;
    totalUnitsToko:   number;
    valueGudang:      number;
    lowGudangCount:   number;
    lowTokoCount:     number;
    outTokoCount:     number;
    lowGudangItems:   DashboardStockItem[];
    lowTokoItems:     DashboardStockItem[];
    outTokoItems:     DashboardStockItem[];
  };
  purchaseOrders: { pending: number; monthTotal: number | null };
  replenishments: { pending: number; approved: number; shipped: number; completedMonth: number };
  expenses: {
    monthOperational: number;
    monthPurchases:   number;
    monthTotal:       number;
    lastMonthTotal:   number;
    changePercent:    number | null;
    byCategory:       Array<{ category: string; amount: number }>;
    cashFlowMonth:    number;
  } | null;
}

// ═══════════════════════════════════════
// API
// ═══════════════════════════════════════

export const api = createApi({
  baseQuery: fetchBaseQuery({
    baseUrl:     process.env.NEXT_PUBLIC_API_BASE_URL,
    credentials: "include",
  }),
  reducerPath: "api",
  tagTypes: [
    "Auth",
    "Profile",
    "Users",
    "Products",
    "PurchaseOrders",
    "StoreReplenishments",
    "Transactions",
    "StockMovements",
    "Notifications",
    "Reports",
    "DashboardMetrics",
    "Expenses",
    "StoreSettings",
  ],
  endpoints: (build) => ({

    // ── AUTH ────────────────────────────────────────────────────
    getMe: build.query<AuthUser, void>({
      query:       () => "/auth/me",
      providesTags: ["Auth"],
    }),
    login: build.mutation<AuthUser, LoginRequest>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      invalidatesTags: ["Auth", "Profile"],
    }),
    logout: build.mutation<{ message: string }, void>({
      query: () => ({ url: "/auth/logout", method: "POST" }),
      invalidatesTags: ["Auth", "Profile"],
    }),

    // ── USERS ───────────────────────────────────────────────────
    getUsers: build.query<User[], void>({
      query:       () => "/users",
      providesTags: ["Users"],
    }),
    createUser: build.mutation<User, NewUser>({
      query: (body) => ({ url: "/users", method: "POST", body }),
      invalidatesTags: ["Users"],
    }),
    updateUser: build.mutation<User, UpdateUser>({
      query: ({ userId, ...body }) => ({
        url: `/users/${userId}`, method: "PUT", body,
      }),
      invalidatesTags: ["Users"],
    }),
    deleteUser: build.mutation<{ message: string; deactivated: boolean }, string>({
      query: (userId) => ({ url: `/users/${userId}`, method: "DELETE" }),
      invalidatesTags: ["Users"],
    }),
    resetUserPassword: build.mutation<{ message: string }, { userId: string; newPassword: string }>({
      query: ({ userId, newPassword }) => ({
        url: `/users/${userId}/password`, method: "PATCH", body: { newPassword },
      }),
    }),
    getProfile: build.query<UserProfile, void>({
      query:       () => "/users/profile",
      providesTags: ["Profile"],
    }),
    updateUserProfile: build.mutation<UserProfile, UpdateUserProfile>({
      query: ({ userId, ...body }) => ({
        url: `/users/profile/${userId}`, method: "PUT", body,
      }),
      invalidatesTags: ["Profile", "Users"],
    }),
    changeOwnPassword: build.mutation<{ message: string }, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: "/users/profile/password", method: "PATCH", body }),
    }),

    // ── PRODUCTS ────────────────────────────────────────────────
    getProducts: build.query<Product[], string | void>({
      query: (search) => ({
        url:    "/products",
        params: search ? { search } : {},
      }),
      providesTags: ["Products"],
    }),
    createProduct: build.mutation<Product, NewProduct>({
      query: (body) => ({ url: "/products", method: "POST", body }),
      invalidatesTags: ["Products", "StockMovements", "DashboardMetrics"],
    }),
    updateProduct: build.mutation<Product, UpdateProduct>({
      query: ({ productId, ...body }) => ({
        url: `/products/${productId}`, method: "PUT", body,
      }),
      invalidatesTags: ["Products", "DashboardMetrics"],
    }),
    deleteProduct: build.mutation<void, string>({
      query: (productId) => ({
        url: `/products/${productId}`, method: "DELETE",
      }),
      invalidatesTags: ["Products", "DashboardMetrics"],
    }),
    addVariant: build.mutation<ProductVariant, NewVariant>({
      query: ({ productId, ...body }) => ({
        url: `/products/${productId}/variants`, method: "POST", body,
      }),
      invalidatesTags: ["Products", "StockMovements", "DashboardMetrics"],
    }),
    updateVariant: build.mutation<ProductVariant, UpdateVariant>({
      query: ({ productId, variantId, ...body }) => ({
        url: `/products/${productId}/variants/${variantId}`, method: "PUT", body,
      }),
      invalidatesTags: ["Products", "DashboardMetrics"],
    }),
    deleteVariant: build.mutation<{ message: string }, { productId: string; variantId: string }>({
      query: ({ productId, variantId }) => ({
        url: `/products/${productId}/variants/${variantId}`, method: "DELETE",
      }),
      invalidatesTags: ["Products", "StockMovements", "DashboardMetrics"],
    }),
    addRating: build.mutation<Product, AddRating>({
      query: ({ productId, rating }) => ({
        url: `/products/${productId}/rating`, method: "PATCH", body: { rating },
      }),
      invalidatesTags: ["Products"],
    }),

    // ── PURCHASE ORDERS (supplier) ──────────────────────────────
    getPurchaseOrders: build.query<PurchaseOrder[], string | void>({
      query: (status) => ({
        url:    "/purchase-orders",
        params: status ? { status } : {},
      }),
      providesTags: ["PurchaseOrders"],
    }),
    getPurchaseOrderById: build.query<PurchaseOrder, string>({
      query: (poId) => `/purchase-orders/${poId}`,
      providesTags: ["PurchaseOrders"],
    }),
    createPurchaseOrder: build.mutation<PurchaseOrder, NewPurchaseOrder>({
      query: (body) => ({ url: "/purchase-orders", method: "POST", body }),
      invalidatesTags: ["PurchaseOrders", "Notifications", "DashboardMetrics", "Expenses"],
    }),
    receivePurchaseOrder: build.mutation<PurchaseOrder, ReceivePurchaseOrder>({
      query: ({ poId, ...body }) => ({
        url: `/purchase-orders/${poId}/receive`, method: "PATCH", body,
      }),
      invalidatesTags: [
        "PurchaseOrders", "Products", "StockMovements",
        "Notifications", "Reports", "DashboardMetrics", "Expenses",
      ],
    }),

    // ── STORE REPLENISHMENTS (gudang → toko) ────────────────────
    getStoreReplenishments: build.query<StoreReplenishment[], string | void>({
      query: (status) => ({
        url:    "/store-replenishments",
        params: status ? { status } : {},
      }),
      providesTags: ["StoreReplenishments"],
    }),
    getStoreReplenishmentById: build.query<StoreReplenishment, string>({
      query: (srId) => `/store-replenishments/${srId}`,
      providesTags: ["StoreReplenishments"],
    }),
    createStoreReplenishment: build.mutation<StoreReplenishment, NewStoreReplenishment>({
      query: (body) => ({ url: "/store-replenishments", method: "POST", body }),
      invalidatesTags: ["StoreReplenishments", "Notifications", "DashboardMetrics"],
    }),
    approveStoreReplenishment: build.mutation<StoreReplenishment, ApproveStoreReplenishment>({
      query: ({ srId, ...body }) => ({
        url: `/store-replenishments/${srId}/approve`, method: "PATCH", body,
      }),
      invalidatesTags: ["StoreReplenishments", "Notifications", "DashboardMetrics"],
    }),
    rejectStoreReplenishment: build.mutation<StoreReplenishment, RejectStoreReplenishment>({
      query: ({ srId, ...body }) => ({
        url: `/store-replenishments/${srId}/reject`, method: "PATCH", body,
      }),
      invalidatesTags: ["StoreReplenishments", "Notifications", "DashboardMetrics"],
    }),
    shipStoreReplenishment: build.mutation<StoreReplenishment, ShipStoreReplenishment>({
      query: ({ srId, ...body }) => ({
        url: `/store-replenishments/${srId}/ship`, method: "PATCH", body,
      }),
      invalidatesTags: [
        "StoreReplenishments", "Products", "StockMovements",
        "Notifications", "Reports", "DashboardMetrics",
      ],
    }),
    receiveStoreReplenishment: build.mutation<StoreReplenishment, ReceiveStoreReplenishment>({
      query: ({ srId, ...body }) => ({
        url: `/store-replenishments/${srId}/receive`, method: "PATCH", body,
      }),
      invalidatesTags: [
        "StoreReplenishments", "Products", "StockMovements",
        "Notifications", "Reports", "DashboardMetrics",
      ],
    }),

    // ── TRANSACTIONS ────────────────────────────────────────────
    getTransactions: build.query<Transaction[], TransactionFilter | void>({
      query: (params) => ({
        url:    "/transactions",
        params: params ?? {},
      }),
      providesTags: ["Transactions"],
    }),
    getTransactionById: build.query<Transaction, string>({
      query: (transactionId) => `/transactions/${transactionId}`,
      providesTags: ["Transactions"],
    }),
    confirmTransactionPayment: build.mutation<Transaction, string>({
      query: (transactionId) => ({ url: `/transactions/${transactionId}/confirm-payment`, method: "POST" }),
      invalidatesTags: [
        "Transactions", "Products", "StockMovements",
        "DashboardMetrics", "Reports", "Notifications",
      ],
    }),
    cancelTransaction: build.mutation<Transaction, { transactionId: string; reason?: string }>({
      query: ({ transactionId, reason }) => ({
        url: `/transactions/${transactionId}/cancel`, method: "POST", body: { reason },
      }),
      invalidatesTags: ["Transactions", "DashboardMetrics"],
    }),
    createTransaction: build.mutation<Transaction, NewTransaction>({
      query: (body) => ({ url: "/transactions", method: "POST", body }),
      invalidatesTags: [
        "Transactions", "Products", "StockMovements",
        "DashboardMetrics", "Reports", "Notifications",
      ],
    }),

    // ── INVENTORY ───────────────────────────────────────────────
    getStockGudang: build.query<Product[], string | void>({
      query: (search) => ({
        url:    "/inventory/gudang",
        params: search ? { search } : {},
      }),
      providesTags: ["Products", "StockMovements"],
    }),
    getStockToko: build.query<Product[], string | void>({
      query: (search) => ({
        url:    "/inventory/toko",
        params: search ? { search } : {},
      }),
      providesTags: ["Products", "StockMovements"],
    }),
    getStockMovements: build.query<StockMovement[], {
      location?:  string;
      productId?: string;
      limit?:     number;
    } | void>({
      query: (params) => ({
        url:    "/inventory/movements",
        params: params ?? {},
      }),
      providesTags: ["StockMovements"],
    }),

    // ── NOTIFICATIONS ───────────────────────────────────────────
    getNotifications: build.query<NotificationsResponse, void>({
      query:       () => "/notifications",
      providesTags: ["Notifications"],
    }),
    markNotificationAsRead: build.mutation<Notification, string>({
      query: (notifId) => ({
        url: `/notifications/${notifId}`, method: "PATCH",
      }),
      invalidatesTags: ["Notifications"],
    }),
    markAllNotificationsAsRead: build.mutation<{ message: string }, void>({
      query: () => ({ url: "/notifications/read-all", method: "PATCH" }),
      invalidatesTags: ["Notifications"],
    }),

    // ── REPORTS ─────────────────────────────────────────────────
    getSalesReport: build.query<SalesReport, {
      startDate?: string;
      endDate?:   string;
    } | void>({
      query: (params) => ({
        url:    "/reports/sales",
        params: params ?? {},
      }),
      providesTags: ["Reports"],
    }),
    getStockReport: build.query<StockReport, void>({
      query:       () => "/reports/stock",
      providesTags: ["Reports"],
    }),

    // ── DASHBOARD ───────────────────────────────────────────────
    getDashboard: build.query<DashboardData, void>({
      query:       () => "/dashboard",
      providesTags: ["DashboardMetrics"],
    }),

    // ── PENGATURAN TOKO ─────────────────────────────────────────
    getStoreSettings: build.query<StoreSettings, void>({
      query:       () => "/settings/store",
      providesTags: ["StoreSettings"],
    }),
    updateStoreSettings: build.mutation<StoreSettings, UpdateStoreSettings>({
      query: (body) => ({ url: "/settings/store", method: "PUT", body }),
      invalidatesTags: ["StoreSettings"],
    }),

    // ── EXPENSES (Super Admin) ──────────────────────────────────
    getExpenses: build.query<ExpensesResponse, ExpenseFilter | void>({
      query: (params) => ({ url: "/expenses", params: params ?? {} }),
      providesTags: ["Expenses"],
    }),
    getExpenseById: build.query<OperationalExpense, string>({
      query:       (expenseId) => `/expenses/${expenseId}`,
      providesTags: ["Expenses"],
    }),
    createExpense: build.mutation<OperationalExpense, ExpenseInput>({
      query: (body) => ({ url: "/expenses", method: "POST", body }),
      invalidatesTags: ["Expenses", "DashboardMetrics"],
    }),
    updateExpense: build.mutation<OperationalExpense, ExpenseInput & { expenseId: string }>({
      query: ({ expenseId, ...body }) => ({ url: `/expenses/${expenseId}`, method: "PUT", body }),
      invalidatesTags: ["Expenses", "DashboardMetrics"],
    }),
    deleteExpense: build.mutation<{ message: string }, string>({
      query: (expenseId) => ({ url: `/expenses/${expenseId}`, method: "DELETE" }),
      invalidatesTags: ["Expenses", "DashboardMetrics"],
    }),
  }),
});

export const {
  // Auth
  useGetMeQuery,
  useLoginMutation,
  useLogoutMutation,
  // Users
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useResetUserPasswordMutation,
  useGetProfileQuery,
  useUpdateUserProfileMutation,
  useChangeOwnPasswordMutation,
  // Products
  useGetProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useAddVariantMutation,
  useUpdateVariantMutation,
  useDeleteVariantMutation,
  useAddRatingMutation,
  // Purchase Orders (supplier)
  useGetPurchaseOrdersQuery,
  useGetPurchaseOrderByIdQuery,
  useCreatePurchaseOrderMutation,
  useReceivePurchaseOrderMutation,
  // Store Replenishments
  useGetStoreReplenishmentsQuery,
  useGetStoreReplenishmentByIdQuery,
  useCreateStoreReplenishmentMutation,
  useApproveStoreReplenishmentMutation,
  useRejectStoreReplenishmentMutation,
  useShipStoreReplenishmentMutation,
  useReceiveStoreReplenishmentMutation,
  // Transactions
  useGetTransactionsQuery,
  useGetTransactionByIdQuery,
  useCreateTransactionMutation,
  useConfirmTransactionPaymentMutation,
  useCancelTransactionMutation,
  // Inventory
  useGetStockGudangQuery,
  useGetStockTokoQuery,
  useGetStockMovementsQuery,
  // Notifications
  useGetNotificationsQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  // Reports
  useGetSalesReportQuery,
  useGetStockReportQuery,
  // Dashboard
  useGetDashboardQuery,
  // Pengaturan toko
  useGetStoreSettingsQuery,
  useUpdateStoreSettingsMutation,
  // Expenses
  useGetExpensesQuery,
  useGetExpenseByIdQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
} = api;