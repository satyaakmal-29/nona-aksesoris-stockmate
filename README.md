# Nona Aksesoris · StockMate

Aplikasi manajemen stok untuk toko **Nona Aksesoris**: stok gudang dan toko per varian produk, pembelian ke supplier (Purchase Order), pengisian stok toko dari gudang (Store Replenishment), transaksi penjualan dengan tunai, transfer, atau QRIS dinamis, pengeluaran, laporan (CSV/Excel/PDF), dan notifikasi stok menipis.

## Struktur

```
nona-aksesoris-stockmate/
├── client/   # Next.js 16 (App Router) + React 19 + TypeScript + Tailwind + RTK Query
└── server/   # Express 5 + Prisma 7 + PostgreSQL
```

## Peran pengguna

| Peran | Akses utama |
| --- | --- |
| Super Admin | Semua modul: produk, Purchase Order, Store Replenishment, pengeluaran, pengguna, pengaturan toko & QRIS |
| Admin Gudang | Stok gudang, validasi penerimaan PO, setujui/kirim Store Replenishment, laporan stok |
| Admin Toko | Transaksi penjualan & struk, konfirmasi penerimaan barang di toko, laporan penjualan |

## Menjalankan secara lokal

Prasyarat: Node.js 20+, PostgreSQL 14+.

### 1. Server (port 8000)

```bash
cd server
npm install
cp .env.example .env        # lalu isi DATABASE_URL & SESSION_SECRET
npx prisma db push          # membuat tabel di database
npx prisma generate
npm run dev
```

Cek: buka `http://localhost:8000/auth/check-setup`. Respons `{"isSetup":false}` berarti belum ada akun.

### 2. Client (port 3000)

```bash
cd client
npm install
cp .env.example .env.local  # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev
```

Buka `http://localhost:3000`. Pada pemakaian pertama, buat akun Super Admin lewat halaman **Setup**.

## Catatan

- File `.env` / `.env.local` berisi rahasia dan **tidak** disimpan di repository. Gunakan `.env.example` sebagai acuan.
- Jika `npm run dev` di client menampilkan 404 untuk halaman yang ada: hentikan dev server, hapus folder `client/.next`, lalu jalankan ulang.
