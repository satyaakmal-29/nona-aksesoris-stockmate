# Audit Uji Web StockMate

Checklist uji manual seluruh aplikasi di browser, setelah langkah 2a & 2b.
Centang `[x]` jika hasil sesuai harapan. Jika gagal, catat di kolom **Catatan** di bagian paling bawah (ID + apa yang terjadi + screenshot).
Nomor `BB#` = nomor skenario Black Box (Tabel 3.2) yang terkait.

---

## 0. Persiapan

- [ ] **P1** Server jalan: `cd server` → `npm run dev` (tidak ada error di terminal).
- [ ] **P2** Klien jalan: `cd client` → `npm run dev`, buka `http://localhost:3000`.
- [ ] **P3** Siapkan 3 akun: **Super Admin (SA)**, **Admin Gudang (AG)**, **Admin Toko (AT)**. Gunakan 2 browser / 1 jendela biasa + 1 jendela Incognito agar bisa bergantian tanpa logout.
- [ ] **P4** Hapus produk uji lama yang tidak punya varian, lalu buat minimal 2 produk baru:
  - Produk A: 2 varian (stok gudang 10 & 5, stok toko 0).
  - Produk B: 1 varian (stok gudang 3, stok toko 2).
- [ ] **P5** Siapkan 3 foto di laptop/HP: foto nota, foto surat jalan, foto barang (boleh foto apa saja, termasuk foto besar > 3 MB dari kamera HP).
- [ ] **P6** Buka DevTools → tab **Network** (untuk beberapa cek di bawah).

---

## 1. Autentikasi & Sesi (BB#1–5)

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| A1 | Login SA dengan username benar + password benar | Masuk ke Dashboard, sidebar sesuai menu SA | [ ] |
| A2 | Login dengan email (bukan username) | Berhasil masuk | [ ] |
| A3 | Login password salah | Pesan error, tetap di halaman login | [ ] |
| A4 | Login dengan kolom kosong | Pesan "Username/email dan password wajib diisi." | [ ] |
| A5 | Buka `http://localhost:3000/products` tanpa login (Incognito baru) | Diarahkan ke `/login` | [ ] |
| A6 | Logout dari Pengaturan → konfirmasi Keluar | Kembali ke `/login` | [ ] |
| A7 | **(Baru 2b)** Login SA → buka Notifikasi & Produk → Logout → login AT di tab yang sama | Navbar & data tampil milik AT, **tidak** ada sisa notifikasi/profil SA sekejap pun | [ ] |
| A8 | Login AT → logout → login AG | Nama & foto di Navbar langsung milik AG | [ ] |
| A9 | Saat login, hapus cookie `stockmate.sid` (DevTools → Application → Cookies) lalu refresh | Diarahkan ke `/login` | [ ] |

## 2. Hak Akses per Peran (Tabel Wewenang)

### 2a. Menu Sidebar

| ID | Peran | Menu yang **harus** tampil (urut) | OK |
|---|---|---|---|
| H1 | SA | Dashboard · Produk · Purchase Order · Store Replenishment · Stok Toko · Stok Gudang · Transaksi · Laporan Penjualan · Laporan Stok · Pengeluaran · Pengguna · Pengaturan | [ ] |
| H2 | AG | Dashboard · Stok Gudang · Stok Toko · Purchase Order · Store Replenishment · Laporan Stok · Pengaturan (**tanpa** Transaksi, Produk, Pengguna) | [ ] |
| H3 | AT | Dashboard · Transaksi · Stok Toko · Store Replenishment · Lap. Penjualan · Pengaturan (**tanpa** Purchase Order, Stok Gudang) | [ ] |
| H4 | Semua | Tidak ada link `/restocks` di mana pun; klik setiap menu tidak 404 | [ ] |

### 2b. Akses langsung lewat URL (ketik di address bar)

| ID | Peran | URL | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| H5 | AT | `/purchase-orders` | Pesan "Anda tidak memiliki akses ke halaman Purchase Order." | [ ] |
| H6 | AT | `/inventory/gudang` | Tidak menampilkan data gudang (server 403) | [ ] |
| H7 | AG / AT | `/users` | Tidak bisa melihat / mengelola pengguna (server 403) | [ ] |
| H8 | AG / AT | `/products` | Tidak ada tombol tambah/ubah/hapus produk | [ ] |
| H9 | AG / SA | `/transactions` | Tidak bisa membuat transaksi (server: hanya AT) | [ ] |
| H10 | — | Tanpa login, buka `http://localhost:<port-server>/dashboard` dan `/expenses` langsung di browser | **(Baru)** Respons 401 "Tidak terautentikasi" (sebelumnya data terbuka) | [ ] |

## 3. Produk & Varian (BB#6–10)

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| PR1 | SA tambah produk + sampul + 2 varian (nama, ukuran opsional, harga, stok gudang & toko, foto varian) | Tersimpan, satu baris per produk, harga "Mulai dari …" | [ ] |
| PR2 | Tambah produk tanpa varian | Ditolak (minimal 1 varian) | [ ] |
| PR3 | Ketik harga `30.000` dan `30000` | Keduanya tersimpan sebagai Rp 30.000 | [ ] |
| PR4 | Buka baris produk | Varian tampil: foto, nama, ukuran (jika ada), harga, stok | [ ] |
| PR5 | Ubah produk & ubah varian | Perubahan tampil; stok tidak berubah lewat form ubah | [ ] |
| PR6 | Hapus produk → konfirmasi | Hilang dari daftar (soft delete); riwayat lama tetap ada | [ ] |
| PR7 | Pencarian produk di Navbar | Daftar terfilter | [ ] |
| PR8 | Stok awal saat tambah produk | Muncul di Riwayat Stok Gudang ("Pembelian dari Supplier") & Toko ("Penyesuaian") | [ ] |

## 4. Purchase Order Supplier (BB#11–15, tulis ulang #11 & #14)

Login **SA** → menu Purchase Order → **Buat PO**.

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| PO1 | Klik Buat PO tanpa mengisi apa pun → Buat PO | Pesan "Nama supplier wajib diisi" | [ ] |
| PO2 | Isi semua kecuali foto nota | Pesan "Foto nota wajib diunggah" | [ ] |
| PO3 | Tanggal nota: coba pilih besok | Tidak bisa dipilih (maks. hari ini) | [ ] |
| PO4 | Total nota Rp 100.000, item 2 × Rp 40.000 | Kotak ringkasan merah "Selisih Rp 20.000", tombol Buat PO nonaktif | [ ] |
| PO5 | Produk A dipilih tanpa memilih varian | Pesan "pilih varian untuk …" | [ ] |
| PO6 | Data lengkap & total cocok (mis. Produk A var-1 4 × Rp 25.000 = Rp 100.000) + foto nota besar dari HP | PO tersimpan, nomor `PO-YYYYMMDD-001`, status **Menunggu Penerimaan** | [ ] |
| PO7 | Buat PO lagi dengan supplier & no. nota **sama** (huruf besar/kecil beda) | Ditolak: "Nota … sudah tercatat di PO-…" | [ ] |
| PO8 | Buka kartu PO | Tampil supplier, nota, resi, tanggal, total, item dan pembuat | [ ] |
| PO9 | Network: lihat respons `GET /purchase-orders` | **Tidak** ada field `invoiceImage` / `receiptImage` | [ ] |
| PO10 | Klik **Lihat Bukti** | Foto nota tampil (diambil dari `GET /purchase-orders/:id`); klik foto → layar penuh, klik lagi → tertutup | [ ] |
| PO11 | AG menerima notifikasi "Purchase Order Baru" (badge **PO Baru**) | Klik → modal detail → tombol "Lihat Purchase Order" membuka `/purchase-orders` | [ ] |
| PO12 | SA tidak melihat tombol Validasi Penerimaan | Benar | [ ] |

Login **AG** → Purchase Order → kartu tadi → **Validasi Penerimaan**.

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| PO13 | Konfirmasi tanpa foto | Pesan "Foto bukti penerimaan wajib diunggah" | [ ] |
| PO14 | Ubah jumlah diterima jadi 3 (dari 4) tanpa alasan | Kolom alasan muncul; konfirmasi → "isi alasan …" | [ ] |
| PO15 | Isi semua jumlah 0 | Pesan "Tidak ada barang yang diterima" | [ ] |
| PO16 | Jumlah diterima 3 + alasan + foto → Konfirmasi | Status **Diterima**; item tampil "Diterima: 3" merah + alasan | [ ] |
| PO17 | Cek Stok Gudang Produk A var-1 | Bertambah **3** (bukan 4); riwayat "Pembelian dari Supplier +3" | [ ] |
| PO18 | SA menerima 2 notifikasi: **PO Diterima** dan **Selisih PO** (detail item dipesan/diterima) | Benar | [ ] |
| PO19 | Lihat Bukti pada PO diterima | Foto nota + foto bukti penerimaan | [ ] |
| PO20 | Filter Semua / Menunggu Penerimaan / Diterima | Daftar sesuai filter | [ ] |
| PO21 | Validasi penerimaan dengan jumlah penuh (tanpa selisih) di PO lain | Hanya notifikasi **PO Diterima** (tanpa Selisih PO) | [ ] |

## 5. Store Replenishment (BB#20–22, tulis ulang #20)

Login **SA** → Store Replenishment → **Buat Permintaan**.

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| SR1 | Pilih Produk A var-1, jumlah melebihi stok gudang | Peringatan oranye "Melebihi stok gudang…", tetap bisa disimpan | [ ] |
| SR2 | Simpan permintaan normal (mis. var-1 × 2, Produk B × 1) | Nomor `SR-YYYYMMDD-001`, status **Menunggu**; harga satuan terisi otomatis dari harga varian | [ ] |
| SR3 | AG dapat notifikasi **Permintaan Baru** → tombol "Lihat Store Replenishment" | Membuka `/store-replenishments` | [ ] |
| SR4 | AT membuka Store Replenishment | Permintaan berstatus Menunggu **tidak** tampil; filter hanya Semua / Dikirim / Selesai | [ ] |

Login **AG**.

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| SR5 | Tolak tanpa alasan | Pesan "Alasan penolakan wajib diisi" | [ ] |
| SR6 | Tolak permintaan lain dengan alasan | Status **Ditolak** + alasan; SA dapat notifikasi **Ditolak** | [ ] |
| SR7 | Setujui dengan jumlah melebihi stok gudang (permintaan dari SR1) | Label "Stok gudang tidak cukup"; server menolak "Stok gudang tidak cukup untuk …" | [ ] |
| SR8 | Setujui dengan semua jumlah 0 | Pesan "Minimal 1 item harus disetujui…" | [ ] |
| SR9 | Setujui SR2 (boleh sebagian, mis. var-1 disetujui 1) | Status **Disetujui**, "Disetujui: 1"; SA dapat notifikasi **Disetujui** | [ ] |
| SR10 | Cek Stok Gudang setelah setuju | **Belum** berkurang | [ ] |
| SR11 | Validasi Pengiriman tanpa no. surat jalan / nama pengantar / foto | Pesan wajib sesuai kolom | [ ] |
| SR12 | Jumlah kirim < disetujui tanpa alasan | Pesan "isi alasan …" | [ ] |
| SR13 | Validasi Pengiriman lengkap | Status **Dikirim**; info surat jalan & pengantar tampil | [ ] |
| SR14 | Cek Stok Gudang | Berkurang sesuai jumlah **dikirim**; riwayat "Dikirim ke Toko −n" | [ ] |
| SR15 | Notifikasi **Dikirim** diterima AT dan SA | Benar | [ ] |

Login **AT**.

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| SR16 | Store Replenishment tampil dengan status Dikirim | Tombol **Konfirmasi Penerimaan** ada | [ ] |
| SR17 | Lihat Bukti | Foto surat jalan tampil | [ ] |
| SR18 | Konfirmasi tanpa foto | Pesan "Foto bukti penerimaan wajib diunggah" | [ ] |
| SR19 | Terima kurang dari dikirim + alasan + foto | Status **Selesai**; item "Diterima: n" merah + alasan | [ ] |
| SR20 | Cek Stok Toko | Bertambah sesuai jumlah **diterima**; riwayat "Masuk dari Gudang +n" | [ ] |
| SR21 | Stok Gudang | **Tidak** bertambah kembali (selisih hanya dicatat) | [ ] |
| SR22 | SA dapat **Diterima Toko** + **Selisih Kirim**; AG dapat **Diterima Toko** | Benar | [ ] |
| SR23 | Lihat Bukti pada status Selesai | Foto surat jalan + foto penerimaan toko | [ ] |

## 6. Transaksi Penjualan (BB#16–19), Admin Toko

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| T1 | Buat transaksi 1 item, bayar tunai | Nomor otomatis `TRX-YYYYMMDD-001`; struk tampil otomatis | [ ] |
| T2 | Transaksi kedua di hari yang sama | Nomor `…-002` | [ ] |
| T3 | Stok toko setelah transaksi | Turun sesuai jumlah; riwayat "Terjual" | [ ] |
| T3b | **(Diperbaiki)** Jual varian A dari produk 2 varian, lalu buka Stok Toko | Stok toko baris produk = jumlah stok toko semua varian | [ ] |
| T4 | Pilih produk bervarian | Pilihan varian **wajib** (tidak ada "Tanpa Varian"); daftar varian menampilkan harga & stok | [ ] |
| T5 | **Harga satuan** | Terisi otomatis dari katalog dan **tidak bisa diketik** | [ ] |
| T6 | **Peringatan stok kurang (BB#18)**: isi jumlah > stok, atau 2 baris varian sama yang totalnya > stok | Kotak merah "Stok tidak cukup: tersedia X, diminta Y"; tombol Proses nonaktif | [ ] |
| T7 | Tunai: isi uang dibayar (input Rupiah titik ribuan) + tombol "Uang pas" / nominal cepat | Kembalian tampil; jika kurang tampil "Kurang Rp …" | [ ] |
| T8 | Bayar kurang (tunai) | Ditolak dengan pesan Rupiah, mis. "Pembayaran kurang Rp 40.000. Total Rp 50.000 …" | [ ] |
| T9 | Transfer | Tidak perlu isi jumlah; tercatat dibayar pas, kembalian Rp 0 | [ ] |
| T10 | **Cetak struk (BB#19)** | Jendela cetak berisi struk yang rapi (nama toko, no., kasir, item, total, bayar, kembali); jika pop-up diblokir muncul pesan | [ ] |
| T11 | Detail transaksi di daftar | Item + harga satuan, dibayar, kembalian, catatan | [ ] |
| T12 | Filter tanggal / metode / cari nomor atau nama pelanggan | Daftar & ringkasan (jumlah, pendapatan, item) mengikuti filter | [ ] |
| T13 | SA / AG membuka Transaksi | Bisa melihat riwayat, **tidak** ada tombol Transaksi Baru | [ ] |
| T14 | Stok toko varian turun dari ≥ 5 ke < 5 (atau habis) | SA & AG menerima notifikasi **Stok Toko** (lihat N7) | [ ] |

## 6b. Pembayaran QRIS (QRIS toko + nominal otomatis)

Persiapan: siapkan foto stiker QRIS toko (QRIS **statis**, tanpa nominal) dan HP dengan aplikasi bank / e-wallet.

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| Q1 | Sebelum QRIS diatur, AT buka Transaksi Baru | Tombol QRIS nonaktif + keterangan "QRIS belum aktif" | [ ] |
| Q2 | SA → Pengaturan → **Toko & QRIS** → Unggah foto QRIS | QR terbaca; muncul "QRIS valid — merchant … kota …" | [ ] |
| Q3 | Unggah foto yang bukan QR / buram | Pesan "QR tidak terdeteksi…" | [ ] |
| Q4 | Tempel teks sembarang / kode QRIS yang dipotong | Ditolak (bukan QRIS / checksum tidak cocok); tombol simpan nonaktif | [ ] |
| Q5 | Unggah QR yang sudah bernominal (mis. screenshot QR pembayaran) | Ditolak: "Gunakan QRIS statis toko…" | [ ] |
| Q6 | Simpan QRIS + ubah nama/alamat toko | Pratinjau QR tampil, status "QRIS aktif", nama merchant benar; nama & alamat baru muncul di struk | [ ] |
| Q7 | AG / AT membuka Pengaturan | Bagian Toko & QRIS **tidak** tampil (server juga menolak perubahan) | [ ] |
| Q8 | AT: transaksi dengan metode QRIS → **Buat QRIS** | Muncul QR besar + total; transaksi berstatus **Menunggu Pembayaran**; stok **belum** berkurang | [ ] |
| Q9 | **Scan QR dengan aplikasi bank / e-wallet di HP** | Nama merchant = nama toko, **nominal sudah terisi** sesuai total (jangan lanjut bayar jika hanya menguji, atau bayar nominal kecil) | [ ] |
| Q10 | Tombol **Pembayaran Diterima** sebelum mencentang "Saya sudah melihat dana masuk" | Tombol nonaktif | [ ] |
| Q11 | Centang → Pembayaran Diterima | Status **Lunas**, stok toko berkurang, struk tampil (metode QRIS) | [ ] |
| Q12 | Tutup modal QRIS tanpa konfirmasi ("bayar nanti") | Transaksi tetap Menunggu; banner kuning di Transaksi & Dashboard; tombol "Tampilkan QRIS & Konfirmasi" memunculkan QR yang sama | [ ] |
| Q13 | **Batalkan** transaksi QRIS (dengan alasan) | Status Dibatalkan + alasan; stok tidak berubah; tidak masuk laporan | [ ] |
| Q14 | Filter status Lunas / Menunggu Pembayaran / Dibatalkan | Daftar sesuai filter; ringkasan pendapatan hanya transaksi lunas | [ ] |
| Q15 | Laporan Penjualan & Dashboard saat ada QRIS menunggu / batal | Hanya transaksi **lunas** yang dihitung | [ ] |
| Q16 | Buat QRIS untuk stok terakhir → jual stok itu secara tunai → konfirmasi QRIS | Konfirmasi ditolak "Stok toko … tidak cukup"; transaksi QRIS tetap Menunggu → batalkan & kembalikan dana pembeli | [ ] |
| Q17 | Klik Pembayaran Diterima dua kali cepat / di dua tab | Hanya satu yang berhasil; stok tidak berkurang dua kali | [ ] |

## 7. Laporan (BB#23–25)

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| L1 | Buka Laporan Penjualan | Tanggal awal default = **tanggal 1 bulan ini** (bukan tanggal terakhir bulan lalu), tanggal akhir = hari ini | [ ] |
| L2 | Filter periode → Tampilkan | Ringkasan & daftar sesuai periode | [ ] |
| L3 | **(Diperbaiki)** Buat transaksi hari ini setelah jam 07.00 WIB, filter tanggal akhir = hari ini | Transaksi tersebut **ikut** muncul | [ ] |
| L4 | Tanggal awal setelah tanggal akhir → Tampilkan | Pesan "Tanggal awal tidak boleh setelah tanggal akhir" | [ ] |
| L5 | Tombol **Export** → menu 3 pilihan: Excel (.xlsx), PDF, CSV | Menu muncul; klik di luar menu → menu tertutup | [ ] |
| L6 | Export **Excel** (Laporan Penjualan) | File `laporan-penjualan-<awal>_sd_<akhir>.xlsx`; sheet **Ringkasan, Transaksi, Produk Terlaris, Detail Item**; kolom Total berformat Rupiah & bisa dijumlah (SUM) | [ ] |
| L7 | Export **PDF** (Laporan Penjualan) | File .pdf terunduh langsung (bukan dialog cetak); berisi judul, periode, ringkasan, tabel transaksi + baris TOTAL, produk terlaris, detail item, nomor halaman | [ ] |
| L8 | Export **CSV** (Laporan Penjualan) | File .csv berisi tabel transaksi; nama pelanggan yang mengandung koma tetap di satu kolom | [ ] |
| L9 | Export saat periode tanpa transaksi | File tetap terbentuk; PDF menulis "Tidak ada data" | [ ] |
| L10 | Laporan Stok: kartu ringkasan | "Stok Gudang Menipis (< 10)", "Stok Toko Menipis (< 5)" **tidak** menghitung produk yang habis di toko; "Habis di Toko" terpisah | [ ] |
| L11 | Laporan Stok: Export Excel / PDF / CSV | Satu baris **per varian** (Produk, Varian, Ukuran, Kategori, Harga, Stok Gudang, Stok Toko, Total, Nilai Stok, Status) + baris TOTAL | [ ] |
| L12 | Setelah PO diterima / SR selesai / transaksi | Angka laporan ikut berubah tanpa refresh manual | [ ] |

## 8. Dashboard per Peran (BB#26–27)

Semua angka dihitung dari data nyata (transaksi, PO, SR, stok, pengeluaran); diperbarui otomatis tiap 60 detik.

| ID | Peran | Hasil yang diharapkan | OK |
|---|---|---|---|
| D1 | SA | Kartu: Penjualan Hari Ini (jumlah trx), Penjualan Bulan Ini (+% vs bulan lalu), Pengeluaran Bulan Ini (operasional + pembelian), Selisih Kas (hijau/merah) | [ ] |
| D2 | SA | Kartu: PO Supplier Menunggu, Permintaan Toko, Stok Gudang Menipis, Habis di Toko — klik membuka halaman terkait | [ ] |
| D3 | SA | Grafik penjualan 7 hari (hari tanpa transaksi = 0), rincian pengeluaran per kategori, produk terlaris (per varian), 5 transaksi terakhir | [ ] |
| D4 | AG | Kartu: Permintaan Toko Menunggu, Siap Dikirim, PO Supplier Menunggu, Total Unit Gudang, Nilai Stok Gudang, Stok Gudang Menipis; daftar SR & PO yang perlu diproses; **tanpa** data pengeluaran | [ ] |
| D5 | AT | Kartu: Penjualan Hari Ini/Bulan Ini, Barang Dalam Pengiriman, Stok Toko Perlu Diisi; grafik 7 hari; transaksi terakhir; aksi cepat; **tanpa** data pengeluaran | [ ] |
| D6 | Semua | Angka berubah setelah aksi (transaksi, terima PO, kirim SR, catat pengeluaran) | [ ] |

## 9. Notifikasi (BB#28–29, tulis ulang keduanya)

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| N1 | Setiap tipe notifikasi punya label & ikon sendiri: PO Baru, PO Diterima, Selisih PO, Permintaan Baru, Disetujui, Ditolak, Dikirim, Diterima Toko, Selisih Kirim | Tidak ada yang tampil sebagai "Info" (kecuali data uji lama) | [ ] |
| N2 | Penerima sesuai aturan: po_created→AG; po_received & po_discrepancy→SA; sr_created→AG; sr_approved/sr_rejected→SA; sr_shipped→AT+SA; sr_received→SA+AG; sr_discrepancy→SA | Benar | [ ] |
| N3 | Klik satu notifikasi | Titik biru hilang, jumlah badge berkurang 1 | [ ] |
| N4 | **(Diperbaiki)** Klik "Tandai semua dibaca" | Semua jadi terbaca, badge hilang (sebelumnya gagal 404) | [ ] |
| N5 | Notifikasi baru muncul tanpa refresh | Maks. ±30 detik (polling) | [ ] |
| N6 | Tombol tautan di modal detail | PURCHASE_ORDER → `/purchase-orders`; STORE_REPLENISHMENT → `/store-replenishments`; STOCK_TOKO → `/inventory/toko`; STOCK_GUDANG → `/inventory/gudang` | [ ] |
| N7 | **(Baru)** Stok toko varian baru turun di bawah 5 atau habis karena transaksi | SA & AG menerima notifikasi **Stok Toko** berisi nama varian; AT tidak menerima | [ ] |
| N8 | **(Baru)** Stok gudang baru turun di bawah 10 atau habis karena pengiriman SR | SA menerima notifikasi **Stok Gudang** | [ ] |
| N9 | Transaksi berikutnya saat stok sudah di bawah ambang | **Tidak** ada notifikasi berulang (hanya saat melewati ambang / baru habis) | [ ] |
| N10 | Jumlah badge saat notifikasi belum dibaca > 50 | Badge tetap akurat (dihitung terpisah dari 50 notifikasi terbaru) | [ ] |

## 9b. Pengeluaran / Expenses (Super Admin)

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| E1 | AG / AT membuka `/expenses` | Pesan "hanya untuk Super Admin"; menu tidak ada di sidebar; server 403 | [ ] |
| E2 | Catat Pengeluaran: tanggal, kategori (Gaji, Sewa, Listrik & Air, Internet & Telepon, Transportasi, Perlengkapan, Perawatan, Lainnya), keterangan, jumlah (Rupiah), metode, foto opsional | Tersimpan dengan nomor `EXP-YYYYMMDD-001`; ringkasan ikut berubah | [ ] |
| E3 | Tanpa keterangan / jumlah 0 / tanggal besok | Ditolak dengan pesan jelas | [ ] |
| E4 | Pengeluaran dengan foto → ikon gambar → Lihat Bukti | Foto tampil (diambil saat dibuka), bisa layar penuh | [ ] |
| E5 | Ubah pengeluaran: ganti data; ganti foto; hapus foto; tanpa menyentuh foto | Data berubah; foto mengikuti pilihan (tetap jika tidak disentuh) | [ ] |
| E6 | Hapus pengeluaran → konfirmasi | Hilang dari daftar & tidak dihitung (data tetap tersimpan sebagai jejak audit) | [ ] |
| E7 | Tabel **Pembelian Stok** | Berisi PO supplier pada periode (berdasarkan tanggal nota) beserta status; total ikut di Total Pengeluaran | [ ] |
| E8 | Filter periode & kategori (termasuk "Pembelian Stok") | Ringkasan, grafik, dan tabel mengikuti filter | [ ] |
| E9 | Grafik per kategori | Persentase tiap kategori + Pembelian Stok, total 100% | [ ] |
| E10 | Export Excel / PDF / CSV | Excel: sheet Ringkasan, Operasional, Pembelian Stok; PDF: ringkasan + 2 tabel + baris TOTAL; CSV: tabel operasional | [ ] |

## 10. Inventori

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| I1 | Stok Gudang: total unit & nilai stok (stok × harga varian) | Sesuai data | [ ] |
| I2 | Riwayat Stok Gudang | Label: Pembelian dari Supplier / Dikirim ke Toko / Penyesuaian (tidak ada teks mentah seperti `sr_transfer`) | [ ] |
| I3 | Riwayat Stok Toko | Label: Terjual / Masuk dari Gudang / Penyesuaian + catatan (mis. "Diterima dari gudang via SR-…") | [ ] |
| I4 | Stok produk = jumlah stok semua varian | Benar di Gudang & Toko (Scarlett: Gudang 40 = 20 + 20) | [x] diperbaiki 15-10 |
| I5 | **Ambang stok** (Produk, Stok Gudang, Stok Toko, Dashboard, Laporan Stok) | Gudang **kuning** jika < 10 (merah jika 0); Toko **oranye** jika 1–4, **merah** jika 0; berlaku untuk produk **dan** varian | [ ] |

## 11. Pengaturan & Pengguna (BB#30)

| ID | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| S1 | Ubah nama & email → Simpan | "Pengaturan berhasil disimpan", Navbar ikut berubah | [ ] |
| S2 | Email kosong / format salah / dipakai akun lain | Pesan error tampil di halaman (bukan pop-up) | [ ] |
| S3 | Ganti foto profil (file bukan gambar / > 5 MB ditolak dengan pesan) | Foto baru tampil di Pengaturan & Navbar | [ ] |
| S4 | **(Baru)** Ganti Password: password lama salah / baru < 6 / konfirmasi beda / sama dengan lama | Masing-masing ditolak dengan pesan jelas | [ ] |
| S5 | **(Baru)** Ganti Password dengan data benar → logout → login password baru | Berhasil; password lama tidak berlaku | [ ] |
| S6 | Mode gelap | Semua halaman (termasuk modal & overlay foto) terbaca | [ ] |
| U-1 | SA: tambah pengguna (username 3–30 huruf/angka/titik/garis bawah, email valid, password ≥ 6) | Tersimpan; username/email duplikat ditolak (tidak peka huruf besar) | [ ] |
| U-2 | SA: ubah peran pengguna yang **sedang login** di browser lain | Peran baru langsung berlaku tanpa login ulang (menu berubah setelah refresh) | [ ] |
| U-3 | SA: nonaktifkan pengguna yang sedang login | Pengguna itu langsung keluar / ditolak pada aksi berikutnya; tidak bisa login | [ ] |
| U-4 | **(Baru)** SA: ikon kunci → Reset Password | Pengguna bisa login dengan password baru | [ ] |
| U-5 | SA: hapus pengguna **tanpa** riwayat | Terhapus permanen | [ ] |
| U-6 | SA: hapus pengguna **dengan** riwayat (pernah transaksi / PO / SR) | Pesan "dinonaktifkan (tidak dihapus permanen)"; riwayatnya tetap muncul di laporan | [ ] |
| U-7 | SA: ubah akun sendiri | Peran & status terkunci; tombol hapus akun sendiri nonaktif | [ ] |
| U-8 | Nonaktifkan / turunkan Super Admin terakhir | Ditolak: "Harus ada minimal 1 Super Admin aktif" | [ ] |
| U-9 | Cari di halaman Pengguna (Navbar) | Mencari nama, username, dan email | [ ] |

## 12. Umum / Non-fungsional

| ID | Cek | OK |
|---|---|---|
| U1 | Semua uang tampil `Rp 1.234.567` (titik ribuan), tidak ada `$`/USD | [ ] |
| U2 | Semua teks berbahasa Indonesia | [ ] |
| U3 | Tampilan di lebar HP (DevTools → toggle device): modal PO/SR bisa di-scroll, tombol terjangkau | [ ] |
| U4 | Unggah foto > 10 MB → pesan "Ukuran foto maksimal 10MB"; unggah file PDF → "File harus berupa gambar" | [ ] |
| U5 | Console browser tanpa error merah saat membuka setiap halaman | [ ] |
| U6 | Terminal server tanpa error 500 selama pengujian | [ ] |

---

## Temuan Diketahui (bukan kegagalan uji)

1. ~~Expenses~~ Selesai: pengeluaran operasional (tambah/ubah/hapus, foto opsional) + pembelian stok dari PO.
2. ~~Laporan Excel~~ Selesai: export CSV / Excel (.xlsx) / PDF di Laporan Penjualan, Laporan Stok, dan Pengeluaran.
3. ~~Pesan bayar kurang~~ Selesai: format Rupiah.
4. ~~Dashboard per peran~~ Selesai: data nyata per peran.
5. **Sisa bahasa**: nilai default "English" di `state/index.ts`, `dashboardWrapper.tsx`, login, dan `/register` di daftar rute. Tidak terlihat oleh pengguna; dibersihkan terpisah.
6. ~~Ambang stok~~ Selesai: gudang < 10, toko < 5 (stok 0 = habis).
7. **Lint**: 2 error lama `react-hooks/set-state-in-effect` di `dashboardWrapper.tsx` (yang di Pengaturan sudah diperbaiki).
8. **Perubahan aturan yang perlu diketahui saat menguji**: harga jual di transaksi kini selalu mengikuti katalog (kasir tidak bisa mengubah harga); Transfer & QRIS selalu dicatat dibayar pas.
9. **QRIS**: konfirmasi lunas dilakukan kasir setelah melihat dana masuk di aplikasi/mesin QRIS toko (tidak otomatis, karena tidak memakai payment gateway). Ini bukan kegagalan.

---

## Catatan Hasil Uji

| ID | Hasil aktual / masalah | Screenshot | Status |
|---|---|---|---|
| | | | |
