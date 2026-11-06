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

### 3. Mode produksi (untuk uji menyeluruh & demo)

`npm run dev` mengompilasi setiap halaman saat pertama kali dibuka dan butuh banyak RAM, sehingga terasa lambat di laptop dengan RAM kecil. Untuk menguji atau mendemokan aplikasi, jalankan versi produksi (semua halaman dikompilasi sekali di awal):

```bash
# terminal 1
cd server
npm start                   # kompilasi TypeScript lalu jalankan API

# terminal 2
cd client
npm run build               # ulangi setiap kali kode client berubah
npm start
```

## Cetak struk (printer thermal 58 mm)

Struk diformat untuk kertas thermal **58 mm** (area cetak ±48 mm). Panjang halaman mengikuti panjang struk, margin 0.

- **Belum ada printer (uji):** tekan **Cetak**, lalu di jendela cetak pilih tujuan **Save as PDF**. Hasilnya PDF satu halaman selebar 58 mm.
- **Dengan printer thermal:** pasang driver printer, atur ukuran kertas 58 mm di driver, lalu di jendela cetak pilih printer tersebut (Margin: *None*, Skala: *Default*).
- **Cetak langsung tanpa jendela pilihan (komputer kasir):** jadikan printer thermal sebagai printer default Windows, lalu buka aplikasi lewat shortcut berikut. Tombol **Cetak** langsung mencetak ke printer default.

  ```
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --user-data-dir="C:\StockMateKasir" --app=http://localhost:3000/transactions
  ```

  `--user-data-dir` membuat profil browser terpisah sehingga mode ini tetap aktif walaupun Edge lain sedang terbuka (login kasir dilakukan sekali di profil tersebut).

## Nota digital lewat email

Setiap transaksi lunas, server mengirim nota ke **Gmail toko** (salinan arsip). Jika pembeli memilih nota digital, kasir mengisi **Email Pembeli** dan nota juga dikirim ke pembeli (alamat toko tidak terlihat oleh pembeli). Pengiriman berjalan di latar belakang: transaksi tidak pernah gagal atau tertunda karena email, dan nota yang gagal terkirim (mis. internet putus) bisa dikirim ulang dari panel **Nota digital** di struk.

Pengaturan (Super Admin → **Pengaturan** → **Email Nota**):

1. Login ke Gmail toko, aktifkan **Verifikasi 2 Langkah** di myaccount.google.com/security.
2. Buat **App Password** di myaccount.google.com/apppasswords (nama aplikasi bebas, mis. "StockMate").
3. Isi Gmail toko + 16 huruf App Password, tekan **Simpan Pengaturan Toko**, lalu **Kirim email uji**.

App Password disimpan terenkripsi (AES-256-GCM, kunci dari `SESSION_SECRET`) dan tidak pernah dikirim kembali ke browser.

## Notifikasi WhatsApp (Purchase Order & Store Replenishment)

Selain notifikasi di aplikasi, setiap tahap PO dan Store Replenishment menampilkan jendela **Kirim via WA** berisi daftar penerima sesuai alur (mis. PO dibuat → Admin Gudang; barang dikirim → Admin Toko & Super Admin) dan pesan yang sudah terisi. Tombol membuka WhatsApp (`wa.me`), pengguna tinggal menekan Kirim; tidak memakai gateway berbayar.

Setiap pengguna mengisi **Nomor WhatsApp** di menu Pengaturan (atau diisi Super Admin di menu Pengguna). Pengguna tanpa nomor tidak muncul sebagai penerima.

## Catatan

- File `.env` / `.env.local` berisi rahasia dan **tidak** disimpan di repository. Gunakan `.env.example` sebagai acuan.
- Jika `npm run dev` di client menampilkan 404 untuk halaman yang ada: hentikan dev server, hapus folder `client/.next`, lalu jalankan ulang.
