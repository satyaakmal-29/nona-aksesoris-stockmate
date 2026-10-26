// User Activity Diagram StockMate — generator SVG/PNG tanpa dependensi.
// Isi diturunkan dari kode: server/src/routes/*, server/src/controllers/*,
// server/src/middleware/auth.ts, client/src/app/**/page.tsx, Sidebar.
//
// Jalankan (dari folder client):
//   node docs/diagrams/user-activity-diagram.mjs          -> .svg
//   node docs/diagrams/user-activity-diagram.mjs --png    -> .svg + .png (Microsoft Edge headless, skala 3x)
// Opsi: --scale=2 (bila PNG 3x terlalu besar), --edge="C:\path\msedge.exe"

import { writeFileSync, mkdirSync, existsSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const BASENAME = "user-activity-diagram";

// ── Geometri ─────────────────────────────────────────────────────
const OY = 60;                   // ruang judul di atas
const ROW = 86;                  // jarak antar baris di area peran
const Y0 = 1215;                 // baris r0 (setelah fork)
const R = (r) => Y0 + r * ROW;

const LANES = [
  { id: "SA", name: "Super Admin",  x0: 40,   x1: 660,  head: "#D6E6FA", body: "#F2F7FE", stroke: "#2F6FB5" },
  { id: "AG", name: "Admin Gudang", x0: 660,  x1: 1280, head: "#D5F0DE", body: "#F2FAF4", stroke: "#2E8B57" },
  { id: "AT", name: "Admin Toko",   x0: 1280, x1: 1900, head: "#FBE3CC", body: "#FEF6EE", stroke: "#C2681B" },
  { id: "SY", name: "Sistem",       x0: 1900, x1: 2650, head: "#E3E5EA", body: "#F6F7F9", stroke: "#555F6D" },
];
const BAND = { head: "#E7DFFA", body: "#F7F4FD", stroke: "#6B4FBB" };
const NOTIF = "#7C3AED";
const LINE = "#1F2937";

const X = {
  SAm: 270, SAs: 540, AGm: 890, AGs: 1160, ATm: 1510, ATs: 1780,
  SYm: 2110, SYs: 2460, GUT: 2302, BUS: 2615,
};
const W = { main: 300, side: 220, sym: 320, sys: 250, band: 300, group: 360 };

const HEAD_Y0 = 40, HEAD_Y1 = 100;          // header jalur
const BAND_TOP = [HEAD_Y1, 1172];            // pita "Semua Peran" atas
const BAND_BOT = [R(36) + 34, R(38) + 46];   // pita "Semua Peran" bawah
const LANE_BOTTOM = BAND_BOT[1] + 10;
const WIDTH = 2690;

// ── Node ─────────────────────────────────────────────────────────
const nodes = {};
const strokeOf = { SA: LANES[0].stroke, AG: LANES[1].stroke, AT: LANES[2].stroke, SY: LANES[3].stroke, BAND: BAND.stroke };

function act(id, lane, x, y, label, w) {
  const lines = label.split("\n");
  const h = lines.length === 1 ? 44 : lines.length === 2 ? 58 : 76;
  nodes[id] = { id, kind: "action", lane, x, y, w, h, lines };
}
function dec(id, lane, x, y, q, qpos = "l") {
  nodes[id] = { id, kind: "decision", lane, x, y, w: 40, h: 40, q, qpos };
}
function merge(id, lane, x, y) { nodes[id] = { id, kind: "decision", lane, x, y, w: 40, h: 40 }; }
function start(id, x, y) { nodes[id] = { id, kind: "start", x, y, w: 26, h: 26 }; }
function end(id, x, y) { nodes[id] = { id, kind: "end", x, y, w: 30, h: 30 }; }
function bar(id, x1, x2, y) { nodes[id] = { id, kind: "bar", x: (x1 + x2) / 2, y, w: x2 - x1, h: 9 }; }

// Awal & login (pita Semua Peran + Sistem)
start("START", X.ATm, 150);
act("A1", "BAND", X.ATm, 215, "Buka aplikasi", W.band);
act("Y1", "SY", X.SYm, 215, "Cek setup awal sistem", W.sym);
dec("D1", "SY", X.SYm, 290, "sudah ada pengguna?", "r");
act("SETUP", "BAND", X.AGm, 290, "Setup akun Super Admin pertama", W.band);
merge("M1", "BAND", X.ATm, 370);
act("L", "BAND", X.ATm, 445, "Login: username/email\n& password", W.band);
act("V", "SY", X.SYm, 445, "Verifikasi kredensial\n& status akun aktif", W.sym);
dec("D2", "SY", X.SYm, 525, "kredensial valid\n& akun aktif?", "l");
act("E", "SY", X.SYs, 525, "Tampilkan pesan error", W.sys);
act("S1", "SY", X.SYm, 610, "Buat sesi, reset cache,\nmuat menu sesuai peran", W.sym);

// Aktivitas bersama
const GY = [690, 768, 846, 924, 1002, 1080];
act("G1", "BAND", X.AGm, GY[0], "Lihat Dashboard (isi sesuai peran)", W.group);
act("G2", "BAND", X.AGm, GY[1], "Lihat notifikasi, tandai dibaca\n(satu / semua)", W.group);
act("G3", "BAND", X.AGm, GY[2], "Lihat Stok Toko & riwayat mutasi", W.group);
act("G4", "BAND", X.AGm, GY[3], "Lihat Laporan Penjualan, ekspor\n(menu: Super Admin & Admin Toko)", W.group);
act("G5", "BAND", X.AGm, GY[4], "Lihat Laporan Stok, ekspor\n(menu: Super Admin & Admin Gudang)", W.group);
act("G6", "BAND", X.AGm, GY[5], "Ubah profil & ganti password", W.group);
bar("F1", X.SAm - 20, X.ATm + 20, 1140);

// Super Admin
merge("M_SA0", "SA", X.SAm, R(0));
act("SA1", "SA", X.SAm, R(1), "Tambah / ubah produk & varian", W.main);
dec("SA_D1", "SA", X.SAm, R(2), "data valid?");
act("SA_E1", "SA", X.SAs, R(2), "Perbaiki isian\nsesuai pesan", W.side);
dec("SA_D2", "SA", X.SAm, R(3), "hapus produk?");
act("SA_X", "SA", X.SAs, R(3), "Konfirmasi hapus\n(soft delete)", W.side);
merge("M_SA1", "SA", X.SAm, R(4));
act("SA4", "SA", X.SAm, R(5), "Lihat Stok Gudang & riwayat mutasi", W.main);
merge("M_SA2", "SA", X.SAm, R(6));
act("SA5", "SA", X.SAm, R(7), "Buat Purchase Order\n(nota, resi, foto nota)", W.main);
dec("SA_D3", "SA", X.SAm, R(8), "total nota cocok\n& nota belum ada?");
act("SA_E3", "SA", X.SAs, R(8), "Perbaiki data nota\n/ item", W.side);
act("SA6", "SA", X.SAm, R(11), "Buat Store Replenishment\n(produk, varian, jumlah)", W.main);
act("SA7", "SA", X.SAm, R(18), "Kelola Pengeluaran\n(tambah, ubah, hapus)", W.main);
act("SA8", "SA", X.SAm, R(19), "Kelola Pengguna (tambah, ubah,\nreset password, hapus)", W.main);
act("SA9", "SA", X.SAm, R(20), "Atur Toko & QRIS (Pengaturan)", W.main);
act("SA10", "SA", X.SAm, R(21), "Lihat Transaksi,\nbatalkan QRIS menunggu", W.main);
act("SA_N", "SA", X.SAm, R(35), "Terima notifikasi\nPO, SR & stok menipis", W.main);

// Admin Gudang
act("AG1", "AG", X.AGm, R(0), "Lihat Stok Gudang & riwayat mutasi", W.main);
act("AG2", "AG", X.AGm, R(12), "Validasi penerimaan PO\n(jumlah diterima, foto bukti)", W.main);
act("AG3", "AG", X.AGm, R(19), "Tinjau Store Replenishment\n(cek stok gudang)", W.main);
dec("AG_D", "AG", X.AGm, R(20), "setujui?");
act("AG_R", "AG", X.AGs, R(20), "Tolak & isi alasan\n(wajib)", W.side);
act("AG4", "AG", X.AGm, R(21), "Setujui jumlah per item", W.main);
act("AG5", "AG", X.AGm, R(22), "Kirim barang (surat jalan,\npengantar, foto)", W.main);
merge("M_AG2", "AG", X.AGm, R(26));
act("AG_N", "AG", X.AGm, R(34), "Terima notifikasi\nSR diterima & stok menipis", W.main);

// Admin Toko
merge("M_AT0", "AT", X.ATm, R(0));
act("AT1", "AT", X.ATm, R(1), "Input transaksi: item\n& metode bayar", W.main);
act("AT_Q1", "AT", X.ATm, R(3), "Pembeli memindai QRIS", W.main);
dec("AT_DQ", "AT", X.ATm, R(4), "dana masuk?");
act("AT_C", "AT", X.ATs, R(4), "Konfirmasi pembayaran", W.side);
act("AT_X", "AT", X.ATm, R(5), "Batalkan transaksi\n(stok tidak berubah)", W.main);
act("AT_P", "AT", X.ATs, R(7), "Cetak struk", W.side);
merge("M_AT2", "AT", X.ATm, R(8));
act("AT_D", "AT", X.ATm, R(9), "Lihat detail transaksi", W.main);
act("AT_SR", "AT", X.ATm, R(24), "Konfirmasi penerimaan SR\n(jumlah diterima, foto)", W.main);
act("AT_403", "AT", X.ATm, R(31), "Buka Stok Gudang /\nPurchase Order", W.main);

// Sistem (area peran)
dec("D_T1", "SY", X.SYm, R(1), "stok toko cukup?", "tl");
act("ST_TW", "SY", X.SYs, R(1), "Tampilkan peringatan\nstok kurang", W.sys);
dec("D_T2", "SY", X.SYm, R(2), "metode bayar?");
act("ST_T2", "SY", X.SYs, R(2), "Simpan TRX (nomor otomatis),\nkurangi stok toko", W.sys);
act("ST_Q1", "SY", X.SYm, R(3), "Buat QRIS bernominal\n(menunggu pembayaran)", W.sym);
act("ST_Q2", "SY", X.SYm, R(4), "Tandai lunas,\nkurangi stok toko", W.sym);
merge("M_T", "SY", X.SYm, R(5));
dec("D_T3", "SY", X.SYm, R(6), "stok melewati ambang?");
act("ST_T3", "SY", X.SYs, R(6), "Notifikasi stok toko\nmenipis → SA & AG", W.sys);
merge("M_T2", "SY", X.SYm, R(7));
act("ST_PO1", "SY", X.SYm, R(10), "Simpan PO (pending),\nnotifikasi Admin Gudang", W.sym);
act("ST_PO2", "SY", X.SYm, R(13), "Stok gudang naik, PO diterima;\nnotifikasi po_received → SA", W.sym);
dec("D_PO", "SY", X.SYm, R(14), "ada selisih jumlah?");
act("ST_PO3", "SY", X.SYs, R(14), "Notifikasi selisih\n(po_discrepancy) → SA", W.sys);
merge("M_PO", "SY", X.SYm, R(15));
act("ST_SR1", "SY", X.SYm, R(17), "Simpan SR (pending),\nnotifikasi Admin Gudang", W.sym);
act("ST_RJ", "SY", X.SYs, R(20), "Status ditolak; notifikasi\nsr_rejected → SA", W.sys);
act("ST_AP", "SY", X.SYm, R(21), "Status disetujui; notifikasi\nsr_approved → SA", W.sym);
act("ST_SH", "SY", X.SYm, R(23), "Stok gudang turun,\nstatus dikirim", W.sym);
act("ST_SN", "SY", X.SYm, R(24), "Notifikasi sr_shipped → AT & SA\n(stok gudang menipis → SA)", W.sym);
act("ST_RC", "SY", X.SYm, R(27), "Stok toko naik,\nstatus selesai", W.sym);
dec("D_RC", "SY", X.SYm, R(28), "ada selisih jumlah?");
act("ST_RD", "SY", X.SYs, R(28), "Notifikasi selisih\n(sr_discrepancy) → SA", W.sys);
merge("M_RC", "SY", X.SYm, R(29));
act("ST_RN", "SY", X.SYm, R(30), "Notifikasi sr_received\n→ SA & AG", W.sym);
act("ST_403", "SY", X.SYm, R(32), "Tolak akses (403)", W.sym);

// Akhir
bar("J1", X.SAm - 20, X.ATm + 20, R(36));
act("LOGOUT", "BAND", X.AGm, R(37), "Logout", W.band);
act("ST_LO", "SY", X.SYm, R(37), "Hapus sesi & reset cache", W.sym);
end("END", X.SYm, R(38));

// ── Edge ─────────────────────────────────────────────────────────
// e(from, fromSide, to, toSide, opts) ; side: t b l r ; opts: via, guard, dashed, label, arrow, fx, tx
const edges = [];
function e(from, fs, to, ts, o = {}) { edges.push({ from, fs, to, ts, arrow: true, ...o }); }
const pt = (x, y) => ({ pt: [x, y] });

// Awal & login
e("START", "b", "A1", "t");
e("A1", "r", "Y1", "l");
e("Y1", "b", "D1", "t");
e("D1", "l", "SETUP", "r", { guard: "[belum]" });
e("D1", "b", "M1", "t", { guard: "[sudah]", via: [[X.SYm, 330], [X.ATm, 330]] });
e("SETUP", "b", "M1", "l");
e("M1", "b", "L", "t");
e("L", "r", "V", "l");
e("V", "b", "D2", "t");
e("D2", "r", "E", "l", { guard: "[tidak]" });
e("E", "t", "M1", "r", { via: [[X.SYs, 370]] });
e("D2", "b", "S1", "t", { guard: "[ya]" });
e("S1", "l", "G1", "t");
e("G1", "b", "G2", "t"); e("G2", "b", "G3", "t"); e("G3", "b", "G4", "t");
e("G4", "b", "G5", "t"); e("G5", "b", "G6", "t");
e("G6", "b", "F1", "t", { tx: X.AGm });
e("F1", "b", "M_SA0", "t", { fx: X.SAm });
e("F1", "b", "AG1", "t", { fx: X.AGm });
e("F1", "b", "M_AT0", "t", { fx: X.ATm });

// Super Admin
e("M_SA0", "b", "SA1", "t");
e("SA1", "b", "SA_D1", "t");
e("SA_D1", "r", "SA_E1", "l", { guard: "[tidak]" });
e("SA_E1", "t", "M_SA0", "r", { via: [[X.SAs, R(0)]] });
e("SA_D1", "b", "SA_D2", "t", { guard: "[ya]" });
e("SA_D2", "r", "SA_X", "l", { guard: "[ya]" });
e("SA_X", "b", "M_SA1", "r");
e("SA_D2", "b", "M_SA1", "t", { guard: "[tidak]" });
e("M_SA1", "b", "SA4", "t");
e("SA4", "b", "M_SA2", "t");
e("M_SA2", "b", "SA5", "t");
e("SA5", "b", "SA_D3", "t");
e("SA_D3", "r", "SA_E3", "l", { guard: "[tidak]" });
e("SA_E3", "t", "M_SA2", "r", { via: [[X.SAs, R(6)]] });
e("SA_D3", "b", "ST_PO1", "l", { guard: "[ya]", via: [[X.SAm, R(10)]] });
e("ST_PO1", "b", "SA6", "r");
e("ST_PO1", "r", "AG2", "r", { dashed: true, label: "po_created", via: [[X.GUT, R(10)], [X.GUT, R(12)]] });
e("SA6", "b", "ST_SR1", "l");
e("ST_SR1", "b", "SA7", "r");
e("ST_SR1", "r", "AG3", "r", { dashed: true, label: "sr_created", via: [[X.GUT, R(17)], [X.GUT, R(19)]] });
e("SA7", "b", "SA8", "t"); e("SA8", "b", "SA9", "t"); e("SA9", "b", "SA10", "t");
e("SA10", "b", "SA_N", "t");
e("SA_N", "b", "J1", "t", { tx: X.SAm });

// Admin Gudang
e("AG1", "b", "AG2", "t");
e("AG2", "b", "ST_PO2", "l");
e("ST_PO2", "b", "D_PO", "t");
e("D_PO", "r", "ST_PO3", "l", { guard: "[ya]" });
e("ST_PO3", "b", "M_PO", "r");
e("D_PO", "b", "M_PO", "t", { guard: "[tidak]" });
e("M_PO", "l", "AG3", "t");
e("AG3", "b", "AG_D", "t");
e("AG_D", "r", "AG_R", "l", { guard: "[tolak]" });
e("AG_R", "r", "ST_RJ", "l");
e("ST_RJ", "b", "M_AG2", "r");
e("AG_D", "b", "AG4", "t", { guard: "[ya, stok cukup]" });
e("AG4", "r", "ST_AP", "l");
e("ST_AP", "b", "AG5", "r");
e("AG5", "b", "ST_SH", "l");
e("ST_SH", "b", "ST_SN", "t");
e("ST_SN", "l", "AT_SR", "r", { dashed: true, label: "sr_shipped" });
e("ST_SN", "b", "M_AG2", "t", { via: [[X.SYm, R(25)], [X.AGm, R(25)]] });
e("M_AG2", "b", "AG_N", "t");
e("AG_N", "b", "J1", "t", { tx: X.AGm });

// Admin Toko
e("M_AT0", "b", "AT1", "t");
e("AT1", "r", "D_T1", "l");
e("D_T1", "r", "ST_TW", "l", { guard: "[tidak]" });
e("ST_TW", "t", "M_AT0", "r", { via: [[X.SYs, R(0)]] });
e("D_T1", "b", "D_T2", "t", { guard: "[ya]" });
e("D_T2", "r", "ST_T2", "l", { guard: "[Tunai / Transfer]" });
e("ST_T2", "b", "M_T", "r");
e("D_T2", "b", "ST_Q1", "t", { guard: "[QRIS]" });
e("ST_Q1", "l", "AT_Q1", "r");
e("AT_Q1", "b", "AT_DQ", "t");
e("AT_DQ", "r", "AT_C", "l", { guard: "[ya]" });
e("AT_C", "r", "ST_Q2", "l");
e("AT_DQ", "b", "AT_X", "t", { guard: "[tidak]" });
e("ST_Q2", "b", "M_T", "t");
e("M_T", "b", "D_T3", "t");
e("D_T3", "r", "ST_T3", "l", { guard: "[ya]" });
e("ST_T3", "b", "M_T2", "r");
e("D_T3", "b", "M_T2", "t", { guard: "[tidak]" });
e("M_T2", "l", "AT_P", "r");
e("AT_P", "b", "M_AT2", "r");
e("AT_X", "b", "M_AT2", "t");
e("M_AT2", "b", "AT_D", "t");
e("AT_D", "b", "AT_SR", "t");
e("AT_SR", "b", "ST_RC", "l");
e("ST_RC", "b", "D_RC", "t");
e("D_RC", "r", "ST_RD", "l", { guard: "[ya]" });
e("ST_RD", "b", "M_RC", "r");
e("D_RC", "b", "M_RC", "t", { guard: "[tidak]" });
e("M_RC", "b", "ST_RN", "t");
e("ST_RN", "b", "AT_403", "r");
e("AT_403", "b", "ST_403", "l");
e("ST_403", "b", "J1", "t", { tx: X.ATm, via: [[X.SYm, R(33)], [X.ATm, R(33)]] });

// Akhir
e("J1", "b", "LOGOUT", "t", { fx: X.AGm });
e("LOGOUT", "r", "ST_LO", "l");
e("ST_LO", "b", "END", "t");

// Bus notifikasi (kanan jalur Sistem) -> Super Admin & Admin Gudang
const BUS_IN = ["ST_T3", "ST_PO2", "ST_PO3", "ST_RJ", "ST_AP", "ST_SN", "ST_RD", "ST_RN"];
for (const id of BUS_IN) e(id, "r", pt(X.BUS, nodes[id].y), null, { dashed: true, arrow: false, bus: true });
e(pt(X.BUS, nodes.ST_T3.y), null, pt(X.BUS, R(35)), null, { dashed: true, arrow: false, bus: true });
e(pt(X.BUS, R(34)), null, "AG_N", "r", { dashed: true, label: "notifikasi untuk Admin Gudang" });
e(pt(X.BUS, R(35)), null, "SA_N", "r", { dashed: true, label: "notifikasi untuk Super Admin", labelDx: 300 });

// ── Routing ──────────────────────────────────────────────────────
function port(ref, side, px) {
  if (ref && ref.pt) return ref.pt;
  const n = nodes[ref];
  if (!n) throw new Error(`Node tidak dikenal: ${ref}`);
  if (n.kind === "bar") {
    const x = px ?? n.x;
    return side === "t" ? [x, n.y - n.h / 2] : [x, n.y + n.h / 2];
  }
  const hw = n.w / 2, hh = n.h / 2;
  return { t: [n.x, n.y - hh], b: [n.x, n.y + hh], l: [n.x - hw, n.y], r: [n.x + hw, n.y] }[side];
}
const isV = (s) => s === "t" || s === "b";

function route(ed) {
  const s = port(ed.from, ed.fs, ed.fx);
  const t = port(ed.to, ed.ts, ed.tx);
  let mid = ed.via ? ed.via.map((p) => [...p]) : [];
  if (!ed.via && s[0] !== t[0] && s[1] !== t[1]) {
    if (isV(ed.fs) && ed.ts && !isV(ed.ts)) mid = [[s[0], t[1]]];
    else if (ed.fs && !isV(ed.fs) && isV(ed.ts)) mid = [[t[0], s[1]]];
    else if (isV(ed.fs)) { const my = (s[1] + t[1]) / 2; mid = [[s[0], my], [t[0], my]]; }
    else { const mx = (s[0] + t[0]) / 2; mid = [[mx, s[1]], [mx, t[1]]]; }
  }
  return [s, ...mid, t];
}
for (const ed of edges) ed.pts = route(ed);

// ── Pemeriksaan tata letak ───────────────────────────────────────
const warnings = [];
const bbox = (n, m = 0) => [n.x - n.w / 2 - m, n.y - n.h / 2 - m, n.x + n.w / 2 + m, n.y + n.h / 2 + m];
const nodeList = Object.values(nodes);
for (let i = 0; i < nodeList.length; i++)
  for (let j = i + 1; j < nodeList.length; j++) {
    const a = bbox(nodeList[i], 4), b = bbox(nodeList[j], 4);
    if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) warnings.push(`node bertumpuk: ${nodeList[i].id} & ${nodeList[j].id}`);
  }
const segs = [];
edges.forEach((ed, k) => {
  for (let i = 0; i < ed.pts.length - 1; i++) {
    const [a, b] = [ed.pts[i], ed.pts[i + 1]];
    if (a[0] !== b[0] && a[1] !== b[1]) warnings.push(`segmen miring pada edge ${k} (${ed.from}->${typeof ed.to === "string" ? ed.to : "pt"})`);
    segs.push({ k, a, b, h: a[1] === b[1] });
  }
});
for (const s of segs) {
  const ed = edges[s.k];
  for (const n of nodeList) {
    if (n.id === ed.from || n.id === ed.to) continue;
    const [x0, y0, x1, y1] = bbox(n, -2);
    const sx0 = Math.min(s.a[0], s.b[0]), sx1 = Math.max(s.a[0], s.b[0]);
    const sy0 = Math.min(s.a[1], s.b[1]), sy1 = Math.max(s.a[1], s.b[1]);
    if (sx0 < x1 && sx1 > x0 && sy0 < y1 && sy1 > y0) warnings.push(`garis edge ${s.k} (${ed.from}->${typeof ed.to === "string" ? ed.to : "bus"}) menembus node ${n.id}`);
  }
}
for (let i = 0; i < segs.length; i++)
  for (let j = i + 1; j < segs.length; j++) {
    const p = segs[i], q = segs[j];
    if (p.k === q.k || p.h !== q.h) continue;
    if (edges[p.k].bus && edges[q.k].bus) continue;
    const c = p.h ? 1 : 0, o = p.h ? 0 : 1;
    if (p.a[c] !== q.a[c]) continue;
    const lo = Math.max(Math.min(p.a[o], p.b[o]), Math.min(q.a[o], q.b[o]));
    const hi = Math.min(Math.max(p.a[o], p.b[o]), Math.max(q.a[o], q.b[o]));
    if (hi - lo > 1) warnings.push(`garis berimpit: edge ${p.k} & ${q.k}`);
  }
const textW = (s, size) => [...s].length * size * 0.54;
for (const n of nodeList)
  if (n.kind === "action")
    for (const l of n.lines) if (textW(l, 15) > n.w - 14) warnings.push(`label terlalu panjang: ${n.id} "${l}"`);

// ── Lompatan garis (hop) pada persilangan ────────────────────────
const HOP = 6;
function hopsFor(s) {
  const xs = [];
  const y = s.a[1], xa = Math.min(s.a[0], s.b[0]), xb = Math.max(s.a[0], s.b[0]);
  for (const v of segs) {
    if (v.h || v.k === s.k) continue;
    const x = v.a[0], ya = Math.min(v.a[1], v.b[1]), yb = Math.max(v.a[1], v.b[1]);
    if (x > xa + HOP + 2 && x < xb - HOP - 2 && y > ya + 2 && y < yb - 2) xs.push(x);
  }
  return [...new Set(xs)];
}

// ── Render SVG ───────────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FONT = `font-family="Segoe UI, Arial, Helvetica, sans-serif"`;
let hopCount = 0;

function pathD(ed, k) {
  let d = `M ${ed.pts[0][0]} ${ed.pts[0][1]}`;
  for (let i = 0; i < ed.pts.length - 1; i++) {
    const [a, b] = [ed.pts[i], ed.pts[i + 1]];
    if (a[1] === b[1] && a[0] !== b[0]) {
      const dir = Math.sign(b[0] - a[0]);
      const xs = hopsFor({ k, a, b, h: true }).sort((p, q) => dir * (p - q));
      for (const x of xs) {
        hopCount++;
        d += ` L ${x - dir * HOP} ${a[1]} A ${HOP} ${HOP} 0 0 ${dir > 0 ? 1 : 0} ${x + dir * HOP} ${a[1]}`;
      }
    }
    d += ` L ${b[0]} ${b[1]}`;
  }
  return d;
}
function arrowHead(a, b, color) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 12, sp = Math.PI / 7;
  const p1 = [b[0] - L * Math.cos(ang - sp), b[1] - L * Math.sin(ang - sp)];
  const p2 = [b[0] - L * Math.cos(ang + sp), b[1] - L * Math.sin(ang + sp)];
  return `<path d="M ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L ${b[0]} ${b[1]} L ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
}
const halo = `paint-order="stroke" stroke="#FFFFFF" stroke-width="5" stroke-linejoin="round"`;

function renderEdge(ed, k) {
  const color = ed.dashed ? NOTIF : LINE;
  const dash = ed.dashed ? ` stroke-dasharray="9 6"` : "";
  let out = `<path d="${pathD(ed, k)}" fill="none" stroke="${color}" stroke-width="${ed.dashed ? 1.8 : 1.8}"${dash}/>`;
  const n = ed.pts.length;
  if (ed.arrow) out += arrowHead(ed.pts[n - 2], ed.pts[n - 1], color);
  if (ed.guard) {
    const [a, b] = ed.pts;
    if (a[1] === b[1]) {
      const dir = Math.sign(b[0] - a[0]);
      out += `<text x="${a[0] + dir * 8}" y="${a[1] - 8}" ${FONT} font-size="14" font-style="italic" fill="#111827" text-anchor="${dir > 0 ? "start" : "end"}" ${halo}>${esc(ed.guard)}</text>`;
    } else {
      out += `<text x="${a[0] + 8}" y="${a[1] + 17}" ${FONT} font-size="14" font-style="italic" fill="#111827" ${halo}>${esc(ed.guard)}</text>`;
    }
  }
  if (ed.label) {
    let best = null;
    for (let i = 0; i < n - 1; i++) {
      const [a, b] = [ed.pts[i], ed.pts[i + 1]];
      if (a[1] === b[1] && (!best || Math.abs(b[0] - a[0]) > Math.abs(best[1][0] - best[0][0]))) best = [a, b];
    }
    const [a, b] = best;
    const mx = (a[0] + b[0]) / 2 + (ed.labelDx ?? 0);
    out += `<text x="${mx}" y="${a[1] - 9}" ${FONT} font-size="14" font-weight="600" fill="${NOTIF}" text-anchor="middle" ${halo}>${esc(ed.label)}</text>`;
  }
  return out;
}

function renderNode(n) {
  const stroke = strokeOf[n.lane] ?? LINE;
  if (n.kind === "start") return `<circle cx="${n.x}" cy="${n.y}" r="13" fill="${LINE}"/>`;
  if (n.kind === "end") return `<circle cx="${n.x}" cy="${n.y}" r="15" fill="#FFFFFF" stroke="${LINE}" stroke-width="2.5"/><circle cx="${n.x}" cy="${n.y}" r="9" fill="${LINE}"/>`;
  if (n.kind === "bar") return `<rect x="${n.x - n.w / 2}" y="${n.y - n.h / 2}" width="${n.w}" height="${n.h}" rx="2" fill="${LINE}"/>`;
  if (n.kind === "decision") {
    const h = 20;
    let out = `<path d="M ${n.x} ${n.y - h} L ${n.x + h} ${n.y} L ${n.x} ${n.y + h} L ${n.x - h} ${n.y} Z" fill="#FFFFFF" stroke="${stroke}" stroke-width="2"/>`;
    if (n.q) {
      const lines = n.q.split("\n");
      const pos = {
        l: [n.x - 28, n.y + 5 - (lines.length - 1) * 9, "end"],
        r: [n.x + 28, n.y + 5 - (lines.length - 1) * 9, "start"],
        tl: [n.x - 26, n.y - 14 - (lines.length - 1) * 18, "end"],
        tr: [n.x + 26, n.y - 14 - (lines.length - 1) * 18, "start"],
      }[n.qpos];
      out += `<text x="${pos[0]}" y="${pos[1]}" ${FONT} font-size="14" fill="#374151" text-anchor="${pos[2]}" ${halo}>`;
      lines.forEach((l, i) => { out += `<tspan x="${pos[0]}" dy="${i ? 18 : 0}">${esc(l)}</tspan>`; });
      out += `</text>`;
    }
    return out;
  }
  // action
  let out = `<rect x="${n.x - n.w / 2}" y="${n.y - n.h / 2}" width="${n.w}" height="${n.h}" rx="14" fill="#FFFFFF" stroke="${stroke}" stroke-width="2"/>`;
  const lh = 18, y0 = n.y - ((n.lines.length - 1) * lh) / 2 + 5;
  out += `<text ${FONT} font-size="15" fill="#111827" text-anchor="middle">`;
  n.lines.forEach((l, i) => { out += `<tspan x="${n.x}" y="${y0 + i * lh}">${esc(l)}</tspan>`; });
  return out + `</text>`;
}

function renderLanes() {
  let out = "";
  for (const L of LANES) {
    out += `<rect x="${L.x0}" y="${HEAD_Y1}" width="${L.x1 - L.x0}" height="${LANE_BOTTOM - HEAD_Y1}" fill="${L.body}"/>`;
    out += `<rect x="${L.x0}" y="${HEAD_Y0}" width="${L.x1 - L.x0}" height="${HEAD_Y1 - HEAD_Y0}" fill="${L.head}"/>`;
    out += `<text x="${(L.x0 + L.x1) / 2}" y="${(HEAD_Y0 + HEAD_Y1) / 2 + 8}" ${FONT} font-size="22" font-weight="700" fill="${L.stroke}" text-anchor="middle">${L.name}</text>`;
  }
  // Pita "Semua Peran" (membentang 3 jalur peran)
  for (const [y0, y1] of [BAND_TOP, BAND_BOT]) {
    out += `<rect x="${LANES[0].x0}" y="${y0}" width="${LANES[2].x1 - LANES[0].x0}" height="${y1 - y0}" fill="${BAND.body}"/>`;
    out += `<line x1="${LANES[0].x0}" y1="${y1}" x2="${LANES[2].x1}" y2="${y1}" stroke="${BAND.stroke}" stroke-width="1.5" stroke-dasharray="6 4"/>`;
    if (y0 !== HEAD_Y1) out += `<line x1="${LANES[0].x0}" y1="${y0}" x2="${LANES[2].x1}" y2="${y0}" stroke="${BAND.stroke}" stroke-width="1.5" stroke-dasharray="6 4"/>`;
    out += `<text x="${LANES[0].x0 + 16}" y="${y0 + 28}" ${FONT} font-size="16" font-weight="700" fill="${BAND.stroke}" letter-spacing="1">SEMUA PERAN</text>`;
    out += `<text x="${LANES[0].x0 + 16}" y="${y0 + 48}" ${FONT} font-size="13" fill="${BAND.stroke}">Super Admin · Admin Gudang · Admin Toko</text>`;
  }
  // Garis pemisah jalur (tidak digambar di dalam pita)
  const seps = [LANES[1].x0, LANES[2].x0];
  for (const x of seps) {
    out += `<line x1="${x}" y1="${HEAD_Y0}" x2="${x}" y2="${HEAD_Y1}" stroke="#9CA3AF" stroke-width="1.5"/>`;
    out += `<line x1="${x}" y1="${BAND_TOP[1]}" x2="${x}" y2="${BAND_BOT[0]}" stroke="#9CA3AF" stroke-width="1.5"/>`;
  }
  out += `<line x1="${LANES[3].x0}" y1="${HEAD_Y0}" x2="${LANES[3].x0}" y2="${LANE_BOTTOM}" stroke="#9CA3AF" stroke-width="1.5"/>`;
  out += `<rect x="${LANES[0].x0}" y="${HEAD_Y0}" width="${LANES[3].x1 - LANES[0].x0}" height="${LANE_BOTTOM - HEAD_Y0}" fill="none" stroke="#6B7280" stroke-width="2"/>`;
  out += `<line x1="${LANES[0].x0}" y1="${HEAD_Y1}" x2="${LANES[3].x1}" y2="${HEAD_Y1}" stroke="#6B7280" stroke-width="1.5"/>`;
  return out;
}

function renderGroup() {
  const x0 = X.AGm - W.group / 2 - 26, x1 = X.AGm + W.group / 2 + 26;
  const y0 = GY[0] - 58, y1 = GY[5] + 40;
  let out = `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="16" fill="#FFFFFF" fill-opacity="0.55" stroke="${BAND.stroke}" stroke-width="1.8" stroke-dasharray="10 5"/>`;
  out += `<text x="${x0 + 16}" y="${y0 + 22}" ${FONT} font-size="14" font-weight="700" fill="${BAND.stroke}">Aktivitas bersama</text>`;
  return out;
}

function note(x, y, w, lines) {
  const h = lines.length * 18 + 16, f = 12;
  let out = `<path d="M ${x} ${y} L ${x + w - f} ${y} L ${x + w} ${y + f} L ${x + w} ${y + h} L ${x} ${y + h} Z" fill="#FFFBEA" stroke="#A16207" stroke-width="1.3"/>`;
  out += `<path d="M ${x + w - f} ${y} L ${x + w - f} ${y + f} L ${x + w} ${y + f}" fill="none" stroke="#A16207" stroke-width="1.3"/>`;
  out += `<text ${FONT} font-size="13" fill="#3F3F46">`;
  lines.forEach((l, i) => { out += `<tspan x="${x + 10}" y="${y + 21 + i * 18}">${esc(l)}</tspan>`; });
  return out + `</text>`;
}

function renderNotes() {
  let out = note(1560, 1104, 330, ["Fork: tiap peran bekerja di sesinya", "sendiri secara bersamaan"]);
  out += note(X.BUS - 205, R(35) + 40, 230, ["Bus notifikasi: penerima", "sesuai label di node Sistem"]);
  out += note(X.SAs - 100, R(19) - 26, 210, ["Hapus pengguna ber-riwayat", "= dinonaktifkan"]);
  out += `<line x1="${X.SAs - 100}" y1="${R(19)}" x2="${X.SAm + W.main / 2}" y2="${R(19)}" stroke="#A16207" stroke-width="1.3" stroke-dasharray="4 3"/>`;
  return out;
}

function renderLegend(y) {
  const items = [];
  let x = 60;
  const lx = (w) => { const v = x; x += w; return v; };
  let out = `<rect x="40" y="${y}" width="${WIDTH - 80}" height="150" rx="10" fill="#FFFFFF" stroke="#9CA3AF" stroke-width="1.5"/>`;
  out += `<text x="60" y="${y + 30}" ${FONT} font-size="17" font-weight="700" fill="#111827">Legenda</text>`;
  const cy = y + 72;
  const label = (tx, s) => `<text x="${tx}" y="${cy + 5}" ${FONT} font-size="14" fill="#111827">${esc(s)}</text>`;
  let a = lx(210); out += `<circle cx="${a + 14}" cy="${cy}" r="12" fill="${LINE}"/>` + label(a + 36, "Node awal");
  a = lx(210); out += `<circle cx="${a + 14}" cy="${cy}" r="14" fill="#fff" stroke="${LINE}" stroke-width="2.5"/><circle cx="${a + 14}" cy="${cy}" r="8" fill="${LINE}"/>` + label(a + 38, "Node akhir");
  a = lx(190); out += `<rect x="${a}" y="${cy - 16}" width="70" height="32" rx="12" fill="#fff" stroke="${LINE}" stroke-width="2"/>` + label(a + 80, "Aksi");
  a = lx(300); out += `<path d="M ${a + 18} ${cy - 18} L ${a + 36} ${cy} L ${a + 18} ${cy + 18} L ${a} ${cy} Z" fill="#fff" stroke="${LINE}" stroke-width="2"/>` + label(a + 46, "Keputusan / merge [guard]");
  a = lx(220); out += `<rect x="${a}" y="${cy - 4}" width="70" height="9" rx="2" fill="${LINE}"/>` + label(a + 80, "Fork / join");
  a = lx(220); out += `<path d="M ${a} ${cy} L ${a + 60} ${cy}" stroke="${LINE}" stroke-width="1.8"/>` + arrowHead([a, cy], [a + 60, cy], LINE) + label(a + 72, "Alur kontrol");
  a = lx(330); out += `<path d="M ${a} ${cy} L ${a + 60} ${cy}" stroke="${NOTIF}" stroke-width="1.8" stroke-dasharray="9 6"/>` + arrowHead([a, cy], [a + 60, cy], NOTIF) + label(a + 72, "Notifikasi / serah-terima peran");
  a = lx(300); out += `<path d="M ${a} ${cy} L ${a + 24} ${cy} A 6 6 0 0 1 ${a + 36} ${cy} L ${a + 60} ${cy}" fill="none" stroke="${LINE}" stroke-width="1.8"/><path d="M ${a + 30} ${cy - 18} L ${a + 30} ${cy + 18}" stroke="${LINE}" stroke-width="1.8"/>` + label(a + 72, "Persilangan (tidak terhubung)");
  a = lx(260); out += `<rect x="${a}" y="${cy - 16}" width="70" height="32" rx="10" fill="#fff" stroke="${BAND.stroke}" stroke-width="1.8" stroke-dasharray="10 5"/>` + label(a + 80, "Kelompok aktivitas");
  out += `<text x="60" y="${y + 126}" ${FONT} font-size="14" fill="#374151">Singkatan: SA = Super Admin, AG = Admin Gudang, AT = Admin Toko, PO = Purchase Order, SR = Store Replenishment, TRX = nomor transaksi. Kode notifikasi (po_created, sr_shipped, …) = tipe notifikasi di server.</text>`;
  return out;
}

const LEGEND_Y = LANE_BOTTOM + 30;
const HEIGHT = OY + LEGEND_Y + 150 + 30;
let body = renderLanes() + renderGroup();
edges.forEach((ed, k) => { body += renderEdge(ed, k); });
for (const id of BUS_IN) body += `<circle cx="${X.BUS}" cy="${nodes[id].y}" r="4" fill="${NOTIF}"/>`;
for (const n of nodeList) body += renderNode(n);
body += renderNotes() + renderLegend(LEGEND_Y);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<rect width="100%" height="100%" fill="#FFFFFF"/>
<text x="40" y="44" ${FONT} font-size="28" font-weight="700" fill="#111827">User Activity Diagram — StockMate</text>
<text x="${WIDTH - 40}" y="44" ${FONT} font-size="15" fill="#6B7280" text-anchor="end">UML Activity Diagram dengan swimlane · diturunkan dari kode aplikasi</text>
<g transform="translate(0 ${OY})">${body}</g>
</svg>
`;

const svgPath = join(OUT_DIR, `${BASENAME}.svg`);
writeFileSync(svgPath, svg, "utf8");
console.log(`SVG: ${svgPath} (${WIDTH}x${HEIGHT}), node ${nodeList.length}, edge ${edges.length}, lompatan ${hopCount}`);
if (warnings.length) { console.log(`PERINGATAN (${warnings.length}):`); for (const w of warnings) console.log("  - " + w); }
else console.log("Pemeriksaan tata letak: bersih");

// ── PNG via Microsoft Edge headless ──────────────────────────────
const args = process.argv.slice(2);
if (args.includes("--png")) {
  const scale = Number((args.find((a) => a.startsWith("--scale=")) ?? "--scale=3").split("=")[1]);
  const edge = (args.find((a) => a.startsWith("--edge=")) ?? "").split("=")[1]
    || ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
  if (!edge) throw new Error("msedge.exe tidak ditemukan; berikan --edge=PATH");
  const work = join(process.env.STOCKMATE_DIAGRAM_TMP || tmpdir(), "stockmate-diagram");
  mkdirSync(work, { recursive: true });
  const html = join(work, "wrap.html");
  writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff;overflow:hidden}</style></head><body>${svg}</body></html>`, "utf8");
  const pngPath = join(OUT_DIR, `${BASENAME}.png`);
  if (existsSync(pngPath)) rmSync(pngPath);
  execFileSync(edge, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    // pastikan seluruh tile sudah dilukis sebelum screenshot (gambar besar)
    "--run-all-compositor-stages-before-draw", "--virtual-time-budget=15000",
    `--user-data-dir=${join(work, "edge-profile")}`,
    `--force-device-scale-factor=${scale}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${pngPath}`,
    pathToFileURL(html).href,
  ], { stdio: "inherit" });
  // msedge.exe bisa kembali sebelum file selesai ditulis: tunggu sampai ukurannya stabil
  const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  let last = -1;
  for (let i = 0; i < 240; i++) {
    sleep(500);
    if (!existsSync(pngPath)) continue;
    const size = statSync(pngPath).size;
    if (size > 0 && size === last) break;
    last = size;
  }
  if (!existsSync(pngPath)) throw new Error("PNG tidak terbentuk (Edge gagal)");
  console.log(`PNG: ${pngPath} (skala ${scale}x, target ${WIDTH * scale}x${HEIGHT * scale})`);
}
