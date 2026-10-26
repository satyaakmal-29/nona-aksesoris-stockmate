// Diagram proposal StockMate (ukuran cetak A4) — generator SVG/PNG/PDF tanpa dependensi.
//   Gambar A: User Activity Diagram ringkas  -> AD-user-activity-A4.{svg,png}
//   Gambar B: Arsitektur & stack teknologi  -> ARSITEKTUR-A4.{svg,png}
//   Pratinjau halaman proposal              -> PREVIEW-A4.pdf
// Isi diturunkan dari kode: server/src/index.ts, routes/*, controllers/*, middleware/auth.ts,
// prisma/schema.prisma, client/package.json + import di client/src, Sidebar.
//
// Jalankan dari folder client:  node docs/diagrams/proposal/build-proposal-diagrams.mjs
// Opsi: --svg-only (tanpa Edge), --edge="C:\path\msedge.exe", --preview-png=DIR (screenshot halaman pratinjau)

import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import zlib from "node:zlib";

const OUT = dirname(fileURLToPath(import.meta.url));
const ARGS = process.argv.slice(2);

// ── Ukuran fisik (ubah di sini) ──────────────────────────────────
const PAGE_CM   = { w: 21, h: 29.7 };                          // A4 potret
const MARGIN_CM = { left: 4, top: 3, right: 3, bottom: 3 };    // margin proposal
const AREA_CM   = { w: PAGE_CM.w - MARGIN_CM.left - MARGIN_CM.right, h: PAGE_CM.h - MARGIN_CM.top - MARGIN_CM.bottom }; // 14 x 23,7
const MAX_IMG_CM = { w: 14, h: 21 };                           // sisakan ruang caption di bawah gambar
const DPI = 300;
const MIN_FONT_PT = 8;
const cmToPx = (cm) => Math.round((cm / 2.54) * DPI);
const W = cmToPx(MAX_IMG_CM.w);                                // 1654
const H_MAX = cmToPx(MAX_IMG_CM.h);                            // 2480
const MIN_FONT_PX = Math.ceil((MIN_FONT_PT * DPI) / 72);       // 34 (8 pt = 33,3 px)

// ── Gaya visual bersama ──────────────────────────────────────────
const FONT = "Segoe UI, Arial, Helvetica, sans-serif";
const FS = 34;            // teks terkecil = teks isi
const FS_HEAD = 38;       // judul jalur / lapisan
const LH = 40;            // tinggi baris
const INK = "#111827";    // garis & teks
const SW = 3;             // tebal garis
const RAD = 16;           // sudut kotak
const HOP = 9;            // jari-jari lompatan persilangan

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fa = `font-family="${FONT}"`;

// Teks multi-baris; box = kotak wadah (untuk pemeriksaan "teks muat di kotak")
function text(x, y, lines, o = {}) {
  const arr = Array.isArray(lines) ? lines : String(lines).split("\n");
  const size = o.size ?? FS, lh = o.lh ?? LH;
  const anchor = o.anchor ?? "middle";
  const y0 = o.vcenter ? y - ((arr.length - 1) * lh) / 2 + size * 0.35 : y;
  const attrs = [
    fa, `font-size="${size}"`, `fill="${o.fill ?? INK}"`, `text-anchor="${anchor}"`,
    o.weight ? `font-weight="${o.weight}"` : "", o.italic ? `font-style="italic"` : "",
    o.spacing ? `letter-spacing="${o.spacing}"` : "",
    o.box ? `data-box="${o.box.map((v) => Math.round(v)).join(",")}"` : "",
    o.halo ? `paint-order="stroke" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"` : "",
  ].filter(Boolean).join(" ");
  return `<text ${attrs}>${arr.map((l, i) => `<tspan x="${x}" y="${(y0 + i * lh).toFixed(1)}">${esc(l)}</tspan>`).join("")}</text>`;
}
function arrowHead(a, b, color = INK) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 20, sp = 0.45;
  const p = (s) => [(b[0] - L * Math.cos(ang + s)).toFixed(1), (b[1] - L * Math.sin(ang + s)).toFixed(1)];
  const [p1, p2] = [p(-sp), p(sp)];
  return `<path d="M ${p1[0]} ${p1[1]} L ${b[0]} ${b[1]} L ${p2[0]} ${p2[1]}" fill="none" stroke="${color}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"/>`;
}
const svgDoc = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n<rect width="100%" height="100%" fill="#FFFFFF"/>\n${body}\n</svg>\n`;

// ═════════════════════════════════════════════════════════════════
// GAMBAR A — User Activity Diagram (ringkas)
// ═════════════════════════════════════════════════════════════════
function buildActivity() {
  const LX = [2, 414, 826, 1238, W - 2];                  // batas jalur
  const C = { SA: 208, AG: 620, AT: 1032, SY: 1445 };     // pusat jalur
  const LANES = [
    { name: "Super Admin",  fill: "#F3F7FD", head: "#DCE8F8" },
    { name: "Admin Gudang", fill: "#F2F9F4", head: "#DAF0E1" },
    { name: "Admin Toko",   fill: "#FEF7F0", head: "#FBE6D3" },
    { name: "Sistem",       fill: "#F5F6F8", head: "#E2E5EA" },
  ];
  const BAND_FILL = "#F6F3FC";
  const HEAD = 76;
  const R0 = 1110, P = 132;
  const R = (r) => R0 + r * P;
  const NW = 330, NWS = 360;                              // lebar aksi: jalur peran / Sistem

  const nodes = {};
  const act = (id, x, y, label, w = NW) => {
    const lines = label.split("\n");
    nodes[id] = { id, kind: "action", x, y, w, h: lines.length === 1 ? 64 : 100, lines };
  };
  const dia = (id, x, y) => (nodes[id] = { id, kind: "diamond", x, y, w: 52, h: 52 });
  const start = (id, x, y) => (nodes[id] = { id, kind: "start", x, y, w: 36, h: 36 });
  const end = (id, x, y) => (nodes[id] = { id, kind: "end", x, y, w: 44, h: 44 });

  // Awal, login, aktivitas bersama (pita "Semua Peran")
  start("START", C.AT, 118);
  dia("M1", C.AT, 190);
  act("LOGIN", C.AT, 275, "Login");
  act("VER", C.SY, 275, "Verifikasi kredensial", NWS);
  dia("DV", C.SY, 372);
  const GX = C.AG, GW = 500, GY = [560, 650, 740, 830];
  act("G1", GX, GY[0], "Lihat Dashboard & notifikasi", GW);
  act("G2", GX, GY[1], "Lihat Stok Toko", GW);
  act("G3", GX, GY[2], "Lihat laporan & ekspor", GW);
  act("G4", GX, GY[3], "Ubah profil & password", GW);
  dia("DR", C.AG, 950);

  // Super Admin
  act("SA1", C.SA, R(0), "Kelola produk\n& varian");
  act("SA2", C.SA, R(1), "Lihat Stok Gudang");
  act("SA3", C.SA, R(2), "Kelola pengeluaran");
  act("SA4", C.SA, R(3), "Buat Purchase Order\n(bukti nota)");
  act("SA5", C.SA, R(4), "Buat Store\nReplenishment");
  act("SA6", C.SA, R(5), "Kelola pengguna");
  // Admin Gudang
  act("AG1", C.AG, R(0), "Lihat Stok Gudang");
  act("AG_PO", C.AG, R(3), "Validasi penerimaan\nbarang supplier");
  act("AG_SR", C.AG, R(4), "Setujui / tolak\npermintaan");
  dia("AG_D", C.AG, R(5));
  act("AG_SH", C.AG, R(6), "Validasi pengiriman");
  dia("M_AG", C.AG, R(7));
  // Admin Toko
  dia("M_AT", C.AT, R(0));
  act("AT_IN", C.AT, R(1), "Input transaksi\n& pembayaran");
  act("AT_PR", C.AT, R(2), "Cetak struk");
  act("AT_RC", C.AT, R(7) + 30, "Konfirmasi\npenerimaan toko");
  // Sistem
  dia("D_ST", C.SY, R(1));
  act("SY_T", C.SY, R(2), "Simpan transaksi,\nkurangi stok toko", NWS);
  act("SY1", C.SY, R(3), "Tambah stok gudang\n& kirim notifikasi", NWS);
  act("SY2", C.SY, R(6), "Kurangi stok gudang\n& kirim notifikasi", NWS);
  act("SY3", C.SY, R(8), "Tambah stok toko\n& kirim notifikasi", NWS);
  // Akhir
  const MRY = R(8) + 96;
  dia("MR", C.AG, MRY);
  act("LOGOUT", C.AG, MRY + 84, "Logout");
  end("END", C.AG, MRY + 166);
  const H = MRY + 166 + 22 + 26;
  const BAND_TOP = [HEAD, 1048];
  const BAND_BOT = [R(8) + 54, H - 2];

  // ── Panah ──
  const edges = [];
  const e = (from, fs, to, ts, o = {}) => edges.push({ from, fs, to, ts, ...o });
  e("START", "b", "M1", "t");
  e("M1", "b", "LOGIN", "t");
  e("LOGIN", "r", "VER", "l");
  e("VER", "b", "DV", "t");
  e("DV", "l", "M1", "l", { via: [[840, 372], [840, 190]], guard: "[tidak valid]", gpos: [1030, 356, "middle"] });
  e("DV", "b", "G1", "r", { via: [[C.SY, GY[0]]], guard: "[valid]" });
  e("G1", "b", "G2", "t"); e("G2", "b", "G3", "t"); e("G3", "b", "G4", "t");
  e("G4", "b", "DR", "t");
  e("DR", "l", "SA1", "t", { guard: "[Super Admin]" });
  e("DR", "b", "AG1", "t", { guard: "[Admin Gudang]" });
  e("DR", "r", "M_AT", "t", { guard: "[Admin Toko]" });
  e("SA1", "b", "SA2", "t"); e("SA2", "b", "SA3", "t"); e("SA3", "b", "SA4", "t");
  e("SA4", "b", "SA5", "t"); e("SA5", "b", "SA6", "t");
  e("SA6", "b", "MR", "l");
  e("SA4", "r", "AG_PO", "l", { dashed: true });
  e("SA5", "r", "AG_SR", "l", { dashed: true });
  e("AG1", "b", "AG_PO", "t");
  e("AG_PO", "r", "SY1", "l");
  e("SY1", "b", "AG_SR", "r");
  e("AG_SR", "b", "AG_D", "t");
  e("AG_D", "b", "AG_SH", "t", { guard: "[disetujui]" });
  e("AG_D", "l", "M_AG", "l", { via: [[434, R(5)], [434, R(7)]], guard: "[ditolak]" });
  e("AG_SH", "r", "SY2", "l");
  e("SY2", "b", "M_AG", "t", { via: [[C.SY, R(6) + P / 2], [C.AG, R(6) + P / 2]] });
  e("M_AG", "b", "MR", "t");
  e("M_AT", "b", "AT_IN", "t");
  e("AT_IN", "r", "D_ST", "l");
  e("D_ST", "r", "M_AT", "r", { via: [[1630, R(1)], [1630, R(0)]], guard: "[stok kurang]", gpos: [1618, R(0) + 78, "end"] });
  e("D_ST", "b", "SY_T", "t", { guard: "[stok cukup]", gpos: [C.SY - 14, R(1) + 60, "end"] });
  e("SY_T", "l", "AT_PR", "r");
  e("AT_PR", "b", "AT_RC", "t");
  e("SY2", "r", "AT_RC", "r", { dashed: true, via: [[1640, R(6)], [1640, R(7) + 30]] });
  e("AT_RC", "b", "SY3", "l");
  e("SY3", "b", "MR", "r");
  e("MR", "b", "LOGOUT", "t");
  e("LOGOUT", "b", "END", "t");

  // ── Routing ortogonal ──
  const port = (id, side) => {
    const n = nodes[id], hw = n.w / 2, hh = n.h / 2;
    return { t: [n.x, n.y - hh], b: [n.x, n.y + hh], l: [n.x - hw, n.y], r: [n.x + hw, n.y] }[side];
  };
  const isV = (s) => s === "t" || s === "b";
  for (const ed of edges) {
    const s = port(ed.from, ed.fs), t = port(ed.to, ed.ts);
    let mid = ed.via ?? [];
    if (!ed.via && s[0] !== t[0] && s[1] !== t[1]) {
      if (isV(ed.fs) && !isV(ed.ts)) mid = [[s[0], t[1]]];
      else if (!isV(ed.fs) && isV(ed.ts)) mid = [[t[0], s[1]]];
      else if (isV(ed.fs)) { const m = (s[1] + t[1]) / 2; mid = [[s[0], m], [t[0], m]]; }
      else { const m = (s[0] + t[0]) / 2; mid = [[m, s[1]], [m, t[1]]]; }
    }
    ed.pts = [s, ...mid, t];
  }

  // ── Pemeriksaan geometri ──
  const warn = [];
  const list = Object.values(nodes);
  const bb = (n, m = 0) => [n.x - n.w / 2 - m, n.y - n.h / 2 - m, n.x + n.w / 2 + m, n.y + n.h / 2 + m];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = bb(list[i], 6), b = bb(list[j], 6);
      if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) warn.push(`node bertumpuk: ${list[i].id} & ${list[j].id}`);
    }
  const segs = [];
  edges.forEach((ed, k) => {
    for (let i = 0; i < ed.pts.length - 1; i++) {
      const [a, b] = [ed.pts[i], ed.pts[i + 1]];
      if (a[0] !== b[0] && a[1] !== b[1]) warn.push(`segmen miring: ${ed.from}->${ed.to}`);
      segs.push({ k, a, b, h: a[1] === b[1] });
    }
  });
  for (const s of segs) {
    const ed = edges[s.k];
    for (const n of list) {
      if (n.id === ed.from || n.id === ed.to) continue;
      const [x0, y0, x1, y1] = bb(n, -1);
      const sx0 = Math.min(s.a[0], s.b[0]), sx1 = Math.max(s.a[0], s.b[0]);
      const sy0 = Math.min(s.a[1], s.b[1]), sy1 = Math.max(s.a[1], s.b[1]);
      if (sx0 < x1 && sx1 > x0 && sy0 < y1 && sy1 > y0) warn.push(`garis ${ed.from}->${ed.to} menembus ${n.id}`);
    }
  }
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const p = segs[i], q = segs[j];
      if (p.k === q.k || p.h !== q.h) continue;
      const c = p.h ? 1 : 0, o = p.h ? 0 : 1;
      if (p.a[c] !== q.a[c]) continue;
      const lo = Math.max(Math.min(p.a[o], p.b[o]), Math.min(q.a[o], q.b[o]));
      const hi = Math.min(Math.max(p.a[o], p.b[o]), Math.max(q.a[o], q.b[o]));
      if (hi - lo > 1) warn.push(`garis berimpit: ${edges[p.k].from}->${edges[p.k].to} & ${edges[q.k].from}->${edges[q.k].to}`);
    }

  // ── Render ──
  let hops = 0;
  const hopXs = (k, a, b) => {
    const y = a[1], xa = Math.min(a[0], b[0]), xb = Math.max(a[0], b[0]), xs = [];
    for (const v of segs) {
      if (v.h || v.k === k) continue;
      const x = v.a[0], ya = Math.min(v.a[1], v.b[1]), yb = Math.max(v.a[1], v.b[1]);
      if (x > xa + HOP + 3 && x < xb - HOP - 3 && y > ya + 3 && y < yb - 3) xs.push(x);
    }
    return [...new Set(xs)];
  };
  const pathD = (ed, k) => {
    let d = `M ${ed.pts[0][0]} ${ed.pts[0][1]}`;
    for (let i = 0; i < ed.pts.length - 1; i++) {
      const [a, b] = [ed.pts[i], ed.pts[i + 1]];
      if (a[1] === b[1] && a[0] !== b[0]) {
        const dir = Math.sign(b[0] - a[0]);
        for (const x of hopXs(k, a, b).sort((p, q) => dir * (p - q))) {
          hops++;
          d += ` L ${x - dir * HOP} ${a[1]} A ${HOP} ${HOP} 0 0 ${dir > 0 ? 1 : 0} ${x + dir * HOP} ${a[1]}`;
        }
      }
      d += ` L ${b[0]} ${b[1]}`;
    }
    return d;
  };

  let out = "";
  // Jalur, header, pita
  LANES.forEach((L, i) => {
    out += `<rect x="${LX[i]}" y="${HEAD}" width="${LX[i + 1] - LX[i]}" height="${H - 2 - HEAD}" fill="${L.fill}"/>`;
    out += `<rect x="${LX[i]}" y="2" width="${LX[i + 1] - LX[i]}" height="${HEAD - 2}" fill="${L.head}"/>`;
    out += text((LX[i] + LX[i + 1]) / 2, 2 + (HEAD - 2) / 2, L.name, { size: FS_HEAD, weight: 700, vcenter: true, box: [LX[i], 2, LX[i + 1], HEAD] });
  });
  const bandW = LX[3] - LX[0];
  for (const [y0, y1] of [BAND_TOP, BAND_BOT]) {
    out += `<rect x="${LX[0]}" y="${y0}" width="${bandW}" height="${y1 - y0}" fill="${BAND_FILL}"/>`;
    if (y0 !== HEAD) out += `<line x1="${LX[0]}" y1="${y0}" x2="${LX[3]}" y2="${y0}" stroke="${INK}" stroke-width="2" stroke-dasharray="10 7"/>`;
    if (y1 !== H - 2) out += `<line x1="${LX[0]}" y1="${y1}" x2="${LX[3]}" y2="${y1}" stroke="${INK}" stroke-width="2" stroke-dasharray="10 7"/>`;
    out += text(LX[0] + 18, y0 === HEAD ? y0 + 44 : y1 - 26, "SEMUA PERAN", { anchor: "start", weight: 700, spacing: 2 });
  }
  for (const x of [LX[1], LX[2]]) {
    out += `<line x1="${x}" y1="2" x2="${x}" y2="${HEAD}" stroke="${INK}" stroke-width="2"/>`;
    out += `<line x1="${x}" y1="${BAND_TOP[1]}" x2="${x}" y2="${BAND_BOT[0]}" stroke="${INK}" stroke-width="2"/>`;
  }
  out += `<line x1="${LX[3]}" y1="2" x2="${LX[3]}" y2="${H - 2}" stroke="${INK}" stroke-width="2"/>`;
  out += `<line x1="2" y1="${HEAD}" x2="${W - 2}" y2="${HEAD}" stroke="${INK}" stroke-width="2"/>`;
  out += `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="${INK}" stroke-width="3"/>`;

  // Kelompok aktivitas bersama
  const gx0 = GX - GW / 2 - 30, gx1 = GX + GW / 2 + 30, gy0 = 452, gy1 = GY[3] + 32 + 30;
  out += `<rect x="${gx0}" y="${gy0}" width="${gx1 - gx0}" height="${gy1 - gy0}" rx="20" fill="#FFFFFF" fill-opacity="0.6" stroke="${INK}" stroke-width="2.5" stroke-dasharray="14 8"/>`;
  out += text(gx0 + 22, gy0 + 46, "Aktivitas bersama", { anchor: "start", weight: 700, box: [gx0, gy0, gx1, GY[0] - 32] });

  // Legenda (sisi kiri pita atas)
  const lgx = 18, lgy = 150, lgw = 312, items = 7, lgh = 70 + items * 52;
  out += `<rect x="${lgx}" y="${lgy}" width="${lgw}" height="${lgh}" rx="12" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>`;
  out += text(lgx + 18, lgy + 46, "Legenda", { anchor: "start", weight: 700, box: [lgx, lgy, lgx + lgw, lgy + 62] });
  const ly = (i) => lgy + 96 + i * 52;
  const sx = lgx + 46, tx = lgx + 92;
  const lbox = (i) => [tx - 10, ly(i) - 26, lgx + lgw, ly(i) + 26];
  out += `<circle cx="${sx}" cy="${ly(0)}" r="14" fill="${INK}"/>` + text(tx, ly(0), "Awal", { anchor: "start", vcenter: true, box: lbox(0) });
  out += `<circle cx="${sx}" cy="${ly(1)}" r="17" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="${sx}" cy="${ly(1)}" r="10" fill="${INK}"/>` + text(tx, ly(1), "Akhir", { anchor: "start", vcenter: true, box: lbox(1) });
  out += `<rect x="${sx - 30}" y="${ly(2) - 17}" width="60" height="34" rx="10" fill="#fff" stroke="${INK}" stroke-width="${SW}"/>` + text(tx, ly(2), "Aksi", { anchor: "start", vcenter: true, box: lbox(2) });
  out += `<path d="M ${sx} ${ly(3) - 20} L ${sx + 20} ${ly(3)} L ${sx} ${ly(3) + 20} L ${sx - 20} ${ly(3)} Z" fill="#fff" stroke="${INK}" stroke-width="${SW}"/>` + text(tx, ly(3), "Keputusan", { anchor: "start", vcenter: true, box: lbox(3) });
  out += `<line x1="${sx - 30}" y1="${ly(4)}" x2="${sx + 30}" y2="${ly(4)}" stroke="${INK}" stroke-width="${SW}"/>` + arrowHead([sx - 30, ly(4)], [sx + 30, ly(4)]) + text(tx, ly(4), "Alur", { anchor: "start", vcenter: true, box: lbox(4) });
  out += `<line x1="${sx - 30}" y1="${ly(5)}" x2="${sx + 30}" y2="${ly(5)}" stroke="${INK}" stroke-width="${SW}" stroke-dasharray="10 7"/>` + arrowHead([sx - 30, ly(5)], [sx + 30, ly(5)]) + text(tx, ly(5), "Notifikasi", { anchor: "start", vcenter: true, box: lbox(5) });
  out += `<path d="M ${sx - 30} ${ly(6)} L ${sx - 9} ${ly(6)} A 9 9 0 0 1 ${sx + 9} ${ly(6)} L ${sx + 30} ${ly(6)}" fill="none" stroke="${INK}" stroke-width="${SW}"/><line x1="${sx}" y1="${ly(6) - 22}" x2="${sx}" y2="${ly(6) + 22}" stroke="${INK}" stroke-width="${SW}"/>` + text(tx, ly(6), "Bersilangan", { anchor: "start", vcenter: true, box: lbox(6) });

  // Panah
  const guardTexts = [];
  edges.forEach((ed, k) => {
    out += `<path d="${pathD(ed, k)}" fill="none" stroke="${INK}" stroke-width="${SW}"${ed.dashed ? ` stroke-dasharray="14 9"` : ""} stroke-linejoin="round"/>`;
    const n = ed.pts.length;
    out += arrowHead(ed.pts[n - 2], ed.pts[n - 1]);
    if (ed.guard) {
      let [gx, gy, anchor] = ed.gpos ?? [];
      if (!ed.gpos) {
        const [a, b] = ed.pts;
        if (a[1] === b[1]) { const dir = Math.sign(b[0] - a[0]); gx = a[0] + dir * 12; gy = a[1] - 16; anchor = dir > 0 ? "start" : "end"; }
        else { gx = a[0] + 12; gy = a[1] + 46; anchor = "start"; }
      }
      guardTexts.push(text(gx, gy, ed.guard, { anchor, italic: true }));
    }
  });
  out += guardTexts.join("");

  // Node
  for (const n of list) {
    if (n.kind === "start") out += `<circle cx="${n.x}" cy="${n.y}" r="18" fill="${INK}"/>`;
    else if (n.kind === "end") out += `<circle cx="${n.x}" cy="${n.y}" r="22" fill="#fff" stroke="${INK}" stroke-width="${SW}"/><circle cx="${n.x}" cy="${n.y}" r="13" fill="${INK}"/>`;
    else if (n.kind === "diamond") out += `<path d="M ${n.x} ${n.y - 26} L ${n.x + 26} ${n.y} L ${n.x} ${n.y + 26} L ${n.x - 26} ${n.y} Z" fill="#fff" stroke="${INK}" stroke-width="${SW}"/>`;
    else {
      const [x0, y0, x1, y1] = bb(n);
      out += `<rect x="${x0}" y="${y0}" width="${n.w}" height="${n.h}" rx="${RAD}" fill="#FFFFFF" stroke="${INK}" stroke-width="${SW}"/>`;
      out += text(n.x, n.y, n.lines, { vcenter: true, box: [x0, y0, x1, y1] });
    }
  }

  // Data untuk pemeriksaan di browser
  const lines = [
    ...segs.map((s) => [...s.a, ...s.b]),
    [LX[3], 2, LX[3], H - 2], [2, HEAD, W - 2, HEAD],
    [LX[1], BAND_TOP[1], LX[1], BAND_BOT[0]], [LX[2], BAND_TOP[1], LX[2], BAND_BOT[0]],
    [LX[0], BAND_TOP[1], LX[3], BAND_TOP[1]], [LX[0], BAND_BOT[0], LX[3], BAND_BOT[0]],
    [gx0, gy0, gx1, gy0], [gx0, gy1, gx1, gy1], [gx0, gy0, gx0, gy1], [gx1, gy0, gx1, gy1],
  ];
  const rects = list.map((n) => bb(n));
  if (H > H_MAX) warn.push(`tinggi ${H}px melebihi batas ${H_MAX}px`);
  const actionCount = list.filter((n) => n.kind === "action").length;
  return {
    name: "AD-user-activity-A4", W, H, svg: svgDoc(W, H, out), warn, lines, rects,
    info: `node ${list.length} (aksi ${actionCount}, keputusan/merge ${list.filter((n) => n.kind === "diamond").length}), panah ${edges.length}, persilangan ${hops}`,
  };
}

// ═════════════════════════════════════════════════════════════════
// GAMBAR B — Arsitektur & stack teknologi
// ═════════════════════════════════════════════════════════════════
function buildArchitecture() {
  let out = "";
  const lines = [], rects = [], warn = [];
  const X0 = 12, X1 = W - 12;                 // tepi lapisan
  const IX0 = X0 + 26, IX1 = X1 - 26;         // tepi isi lapisan
  const CW = IX1 - IX0;

  const box = (x, y, w, h, label, o = {}) => {
    out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 12}" fill="${o.fill ?? "#FFFFFF"}" stroke="${INK}" stroke-width="${o.sw ?? 2.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>`;
    if (label) out += text(x + w / 2, y + h / 2, label, { vcenter: true, weight: o.weight, box: [x, y, x + w, y + h] });
    rects.push([x, y, x + w, y + h]);
  };
  const layer = (y0, y1, title, fill) => {
    out += `<rect x="${X0}" y="${y0}" width="${X1 - X0}" height="${y1 - y0}" rx="22" fill="${fill}" stroke="${INK}" stroke-width="${SW}"/>`;
    out += text(X0 + 28, y0 + 50, title, { anchor: "start", size: FS_HEAD, weight: 700, spacing: 1, box: [X0, y0, X1, y0 + 70] });
  };
  const grid = (y, cols, labels, h = 62, gap = 14) => {
    const w = (CW - gap * (cols - 1)) / cols;
    labels.forEach((l, i) => {
      if (l == null) return;
      const c = i % cols, r = Math.floor(i / cols);
      box(IX0 + c * (w + gap), y + r * (h + gap), w, h, l);
    });
    return y + Math.ceil(labels.length / cols) * (h + gap) - gap;
  };
  const vArrow = (x, y0, y1, both, label) => {
    out += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="${INK}" stroke-width="${SW}"/>`;
    out += arrowHead([x, y0], [x, y1]);
    if (both) out += arrowHead([x, y1], [x, y0]);
    lines.push([x, y0, x, y1]);
    if (label) out += text(x + 26, (y0 + y1) / 2, label, { anchor: "start", vcenter: true, weight: 600 });
  };
  const hArrow = (x0, x1, y) => {
    out += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${INK}" stroke-width="${SW}"/>` + arrowHead([x0, y], [x1, y]);
    lines.push([x0, y, x1, y]);
  };
  const caption = (y, s) => (out += text(IX0, y, s, { anchor: "start", weight: 600 }));

  // 1. Pengguna
  let y = 12;
  const U0 = y, U1 = y + 236;
  layer(U0, U1, "PENGGUNA", "#F4F5F7");
  const actor = (cx, top, label) => {
    const g = `stroke="${INK}" stroke-width="${SW}" fill="none" stroke-linecap="round"`;
    out += `<circle cx="${cx}" cy="${top + 16}" r="15" fill="#fff" stroke="${INK}" stroke-width="${SW}"/>`;
    out += `<path d="M ${cx} ${top + 31} L ${cx} ${top + 70} M ${cx - 26} ${top + 45} L ${cx + 26} ${top + 45} M ${cx} ${top + 70} L ${cx - 22} ${top + 100} M ${cx} ${top + 70} L ${cx + 22} ${top + 100}" ${g}/>`;
    out += text(cx, top + 142, label, { weight: 600, box: [cx - 230, top + 104, cx + 230, top + 162] });
  };
  const ax = [IX0 + CW / 6, IX0 + CW / 2, IX0 + (5 * CW) / 6];
  actor(ax[0], U0 + 66, "Super Admin");
  actor(ax[1], U0 + 66, "Admin Gudang");
  actor(ax[2], U0 + 66, "Admin Toko");

  // 2. Lapisan client
  const C0 = U1 + 80;
  vArrow(W / 2, U1, C0, false, "melalui peramban web");
  y = C0 + 84;
  const clientStart = out.length;
  box(IX0, y, CW, 70, "Next.js 16 (App Router) · React 19 · TypeScript", { weight: 700, fill: "#FFFFFF", sw: 3 });
  y += 70 + 20;
  y = grid(y, 3, [
    "Redux Toolkit + RTK Query", "Tailwind CSS (mode gelap)", "Middleware Next.js (cek sesi)",
    "Recharts (grafik)", "MUI X DataGrid (tabel)", "lucide-react (ikon)",
    "ExcelJS · jsPDF (ekspor)", "jsQR · qrcode (QRIS)", "redux-persist",
  ]);
  const C1 = y + 26;
  const clientBody = out.slice(clientStart);
  out = out.slice(0, clientStart);
  layer(C0, C1, "LAPISAN CLIENT", "#EEF3FB");
  out += clientBody;

  // 3. Server
  const S0 = C1 + 104;
  vArrow(W / 2, C1, S0, true, "HTTP / REST API (JSON) + cookie sesi");
  const serverStart = out.length;
  y = S0 + 84;
  box(IX0, y, CW, 66, "Express 5 · TypeScript · Node.js", { weight: 700, sw: 3 });
  y += 66 + 30;
  caption(y + 12, "Middleware global (sesuai urutan di index.ts)");
  y += 30;
  // Rantai middleware: 2 baris, panah berurutan
  const pills1 = ["1 express.json", "2 Helmet", "3 Morgan", "4 body-parser"];
  const pills2 = ["5 urlencoded", "6 CORS", "7 express-session", "8 static /assets"];
  const ph = 64, pgap = 52;
  const drawPills = (labels, yy) => {
    const ws = labels.map((l) => 70 + l.length * 16.5);
    const total = ws.reduce((a, b) => a + b, 0) + pgap * (labels.length - 1);
    let x = IX0 + (CW - total) / 2;
    const pos = [];
    labels.forEach((l, i) => {
      box(x, yy, ws[i], ph, l, { rx: 32 });
      pos.push([x, x + ws[i]]);
      if (i > 0) hArrow(pos[i - 1][1], x, yy + ph / 2);
      x += ws[i] + pgap;
    });
    return pos;
  };
  const r1 = drawPills(pills1, y);
  const y2 = y + ph + 46;
  const r2 = drawPills(pills2, y2);
  // sambungan baris 1 -> baris 2
  {
    const xa = (r1[3][0] + r1[3][1]) / 2, xb = (r2[0][0] + r2[0][1]) / 2, ym = y + ph + 23;
    out += `<path d="M ${xa} ${y + ph} L ${xa} ${ym} L ${xb} ${ym} L ${xb} ${y2}" fill="none" stroke="${INK}" stroke-width="${SW}"/>` + arrowHead([xb, ym], [xb, y2]);
    lines.push([xa, y + ph, xa, ym], [xa, ym, xb, ym], [xb, ym, xb, y2]);
  }
  y = y2 + ph + 26;
  // Otorisasi
  const aw = (CW - 70) / 2;
  box(IX0, y, aw, 96, "requireAuth\n(sesi & akun aktif)", { fill: "#FFFFFF" });
  box(IX0 + aw + 70, y, aw, 96, "requireRole\n(RBAC di server)", { fill: "#FFFFFF", weight: 700 });
  hArrow(IX0 + aw, IX0 + aw + 70, y + 48);
  y += 96 + 30;
  caption(y + 12, "Router + controller per modul");
  y += 30;
  y = grid(y, 4, [
    "Auth", "Dashboard", "Produk", "Pengguna",
    "Pengeluaran", "Inventori", "Purchase Order", "Transaksi",
    "Store Replenishment", "Notifikasi", "Laporan", "Pengaturan Toko",
  ]);
  y += 20;
  y = grid(y, 3, ["bcryptjs (hash sandi)", "Helper stok & tanggal", "QRIS dinamis (CRC-16)"]);
  const S1 = y + 26;
  const serverBody = out.slice(serverStart);
  out = out.slice(0, serverStart);
  layer(S0, S1, "LAPISAN SERVER", "#EEF8F1");
  out += serverBody;

  // 4. Database
  const D0 = S1 + 96;
  vArrow(W / 2, S1, D0, true, "Prisma ORM 7 (adapter pg)");
  const dbStart = out.length;
  y = D0 + 84;
  // Silinder PostgreSQL
  {
    const bx = IX0, bw = CW, bh = 72;
    box(bx, y, bw, bh, null, { sw: 3 });
    const cx = bx + 60, cy = y + 14, rw = 30, rh = 9, ch = 48;
    out += `<path d="M ${cx - rw} ${cy} L ${cx - rw} ${cy + ch} A ${rw} ${rh} 0 0 0 ${cx + rw} ${cy + ch} L ${cx + rw} ${cy}" fill="#fff" stroke="${INK}" stroke-width="${SW}"/>`;
    out += `<ellipse cx="${cx}" cy="${cy}" rx="${rw}" ry="${rh}" fill="#fff" stroke="${INK}" stroke-width="${SW}"/>`;
    out += text(bx + bw / 2 + 30, y + bh / 2, "PostgreSQL · database stockmanagement", { vcenter: true, weight: 700, box: [bx + 100, y, bx + bw, y + bh] });
    y += bh + 20;
  }
  y = grid(y, 3, [
    "Users *", "Products *", "ProductVariant *",
    "PurchaseOrder", "PurchaseOrderItem", "StockMovement †",
    "StoreReplenishment", "StoreReplenishmentItem", "Notification",
    "Transaction", "TransactionItem", "OperationalExpense *",
    "StoreSettings",
  ]);
  // Keterangan tanda di sebelah StoreSettings (baris terakhir)
  {
    const cw = (CW - 28) / 3;
    out += text(IX0 + cw + 14 + 18, y - 31, ["* soft delete / nonaktif (isActive)", "† riwayat mutasi stok"], { anchor: "start", vcenter: true, lh: 38, box: [IX0 + cw + 14, y - 62 - 30, IX1, y + 30] });
  }
  const D1 = y + 26;
  const dbBody = out.slice(dbStart);
  out = out.slice(0, dbStart);
  layer(D0, D1, "LAPISAN DATABASE", "#FDF6E9");
  out += dbBody;

  const H = D1 + 12;
  if (H > H_MAX) warn.push(`tinggi ${H}px melebihi batas ${H_MAX}px`);
  return { name: "ARSITEKTUR-A4", W, H, svg: svgDoc(W, H, out), warn, lines, rects, info: `lapisan 4, tinggi isi ${H}px` };
}

// ═════════════════════════════════════════════════════════════════
// Edge headless: ukur teks, screenshot, PDF
// ═════════════════════════════════════════════════════════════════
const WORK = join(process.env.STOCKMATE_DIAGRAM_TMP || tmpdir(), "stockmate-proposal");
mkdirSync(WORK, { recursive: true });
const EDGE = (ARGS.find((a) => a.startsWith("--edge=")) ?? "").split("=")[1]
  || ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
const edgeBase = (profile) => ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  "--run-all-compositor-stages-before-draw", `--user-data-dir=${join(WORK, profile)}`];
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function waitFile(p) {
  let last = -1;
  for (let i = 0; i < 240; i++) {
    sleep(500);
    if (!existsSync(p)) continue;
    const s = statSync(p).size;
    if (s > 0 && s === last) return;
    last = s;
  }
  throw new Error(`File tidak terbentuk: ${p}`);
}

// Pemeriksaan di browser dengan font sebenarnya: teks muat di kotak, teks tidak bertumpuk,
// teks tidak tertimpa garis, teks di dalam kanvas, ukuran font terkecil.
function browserCheck(d) {
  const html = join(WORK, `${d.name}-check.html`);
  writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${d.svg}
<script>
const L=${JSON.stringify(d.lines)}, R=${JSON.stringify(d.rects)}, W=${d.W}, H=${d.H};
const issues=[]; const T=[...document.querySelectorAll('svg text')]; let minFs=1e9;
const label=(t)=>t.textContent.slice(0,40);
const boxes=T.map(t=>{const b=t.getBBox(); minFs=Math.min(minFs,parseFloat(getComputedStyle(t).fontSize));
  const pad=t.hasAttribute('paint-order')?0:0; return {t, x0:b.x, y0:b.y, x1:b.x+b.width, y1:b.y+b.height};});
// ink box: kurangi ruang descent/ascent kosong
const ink=(b)=>({x0:b.x0+1,x1:b.x1-1,y0:b.y0+4,y1:b.y1-5});
boxes.forEach(b=>{
  if(b.x0<0||b.y0<0||b.x1>W||b.y1>H) issues.push('keluar kanvas: '+label(b.t));
  const db=b.t.getAttribute('data-box');
  if(db){const [x0,y0,x1,y1]=db.split(',').map(Number); const i=ink(b);
    if(i.x0<x0+6||i.x1>x1-6||i.y0<y0+3||i.y1>y1-3) issues.push('tidak muat di kotak: '+label(b.t)+' ['+Math.round(b.x1-b.x0)+'px vs '+(x1-x0)+'px]');}
  else { const i=ink(b); R.forEach(r=>{ if(i.x0<r[2]&&i.x1>r[0]&&i.y0<r[3]&&i.y1>r[1]) issues.push('menimpa node: '+label(b.t)); }); }
  const i=ink(b);
  L.forEach(s=>{const [ax,ay,bx,by]=s; const sx0=Math.min(ax,bx),sx1=Math.max(ax,bx),sy0=Math.min(ay,by),sy1=Math.max(ay,by);
    if(sx0<=i.x1&&sx1>=i.x0&&sy0<=i.y1&&sy1>=i.y0) issues.push('tertimpa garis: '+label(b.t)+' @'+s.map(Math.round).join(','));});
});
for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=ink(boxes[i]),b=ink(boxes[j]);
  if(a.x0<b.x1&&b.x0<a.x1&&a.y0<b.y1&&b.y0<a.y1) issues.push('teks bertumpuk: '+label(boxes[i].t)+' / '+label(boxes[j].t));}
document.body.setAttribute('data-r', JSON.stringify({n:T.length, minFs, issues}));
</script></body></html>`, "utf8");
  const dom = execFileSync(EDGE, [...edgeBase("check"), "--dump-dom", pathToFileURL(html).href], { encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "ignore"] });
  const m = dom.match(/data-r="([^"]*)"/);
  if (!m) throw new Error("Hasil pemeriksaan browser tidak terbaca");
  return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
}

// PNG: chunk pHYs (piksel per meter) agar terbaca 300 dpi di Word
function setPngDpi(file, dpi) {
  const buf = readFileSync(file);
  const sig = buf.subarray(0, 8), chunks = [];
  for (let o = 8; o < buf.length;) {
    const len = buf.readUInt32BE(o), type = buf.toString("latin1", o + 4, o + 8);
    chunks.push({ type, raw: buf.subarray(o, o + 12 + len) });
    o += 12 + len;
  }
  const ppm = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9); data.writeUInt32BE(ppm, 0); data.writeUInt32BE(ppm, 4); data.writeUInt8(1, 8);
  const typeData = Buffer.concat([Buffer.from("pHYs", "latin1"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(typeData) >>> 0, 0);
  const len = Buffer.alloc(4); len.writeUInt32BE(9, 0);
  const phys = Buffer.concat([len, typeData, crc]);
  const outChunks = [];
  for (const c of chunks) {
    if (c.type === "pHYs") continue;
    outChunks.push(c.raw);
    if (c.type === "IHDR") outChunks.push(phys);
  }
  writeFileSync(file, Buffer.concat([sig, ...outChunks]));
}
function readPngInfo(file) {
  const buf = readFileSync(file);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  let dpi = null;
  for (let o = 8; o < buf.length;) {
    const len = buf.readUInt32BE(o), type = buf.toString("latin1", o + 4, o + 8);
    if (type === "pHYs") { const ppm = buf.readUInt32BE(o + 8), unit = buf.readUInt8(o + 16); dpi = unit === 1 ? ppm * 0.0254 : null; }
    o += 12 + len;
  }
  return { w, h, dpi };
}
function screenshot(d) {
  const html = join(WORK, `${d.name}.html`);
  writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff;overflow:hidden}svg{display:block}</style></head><body>${d.svg}</body></html>`, "utf8");
  const png = join(OUT, `${d.name}.png`);
  if (existsSync(png)) rmSync(png);
  execFileSync(EDGE, [...edgeBase("shot"), "--force-device-scale-factor=1", `--window-size=${d.W},${d.H}`, `--screenshot=${png}`, pathToFileURL(html).href], { stdio: "ignore" });
  waitFile(png);
  setPngDpi(png, DPI);
  return png;
}

// Halaman pratinjau: A4 dengan margin proposal, gambar lebar 14 cm di tengah-atas, caption contoh
function previewHtml(items) {
  const page = (src, cap) => `<section class="page"><img src="${src}"><p class="cap">${esc(cap)}</p></section>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:0}
html,body{margin:0;padding:0;background:#fff}
.page{width:${PAGE_CM.w}cm;height:${PAGE_CM.h}cm;box-sizing:border-box;padding:${MARGIN_CM.top}cm ${MARGIN_CM.right}cm ${MARGIN_CM.bottom}cm ${MARGIN_CM.left}cm;page-break-after:always;break-after:page;overflow:hidden;position:relative}
.page:last-child{page-break-after:auto;break-after:auto}
.page img{display:block;width:${MAX_IMG_CM.w}cm;height:auto;margin:0 auto}
.cap{font-family:"Times New Roman",serif;font-size:12pt;text-align:center;margin:0.3cm 0 0}
</style></head><body>${items.map(([src, cap]) => page(src, cap)).join("")}</body></html>`;
}
function makePdf(pngs) {
  const html = join(WORK, "preview.html");
  writeFileSync(html, previewHtml([
    [pathToFileURL(pngs[1]).href, "Gambar 3.x Diagram Arsitektur Sistem"],
    [pathToFileURL(pngs[0]).href, "Gambar 3.y User Activity Diagram"],
  ]), "utf8");
  const pdf = join(OUT, "PREVIEW-A4.pdf");
  if (existsSync(pdf)) rmSync(pdf);
  execFileSync(EDGE, [...edgeBase("pdf"), "--no-pdf-header-footer", "--virtual-time-budget=10000", `--print-to-pdf=${pdf}`, pathToFileURL(html).href], { stdio: "ignore" });
  waitFile(pdf);
  const raw = readFileSync(pdf).toString("latin1");
  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const mb = raw.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
  // Screenshot halaman pratinjau (opsional, untuk diperiksa visual)
  const dir = (ARGS.find((a) => a.startsWith("--preview-png=")) ?? "").split("=")[1];
  if (dir) {
    mkdirSync(dir, { recursive: true });
    const pxPerCm = 96 / 2.54;
    pngs.forEach((p, i) => {
      const h1 = join(WORK, `preview-${i}.html`);
      writeFileSync(h1, previewHtml([[pathToFileURL(p).href, i === 0 ? "Gambar 3.y User Activity Diagram" : "Gambar 3.x Diagram Arsitektur Sistem"]]).replace("<body>", '<body style="outline:1px solid #999">'), "utf8");
      const shot = join(dir, `preview-${i + 1}.png`);
      if (existsSync(shot)) rmSync(shot);
      execFileSync(EDGE, [...edgeBase("pv"), "--force-device-scale-factor=1", `--window-size=${Math.round(PAGE_CM.w * pxPerCm)},${Math.round(PAGE_CM.h * pxPerCm)}`, `--screenshot=${shot}`, pathToFileURL(h1).href], { stdio: "ignore" });
      waitFile(shot);
    });
  }
  return { pdf, pages, mediaBox: mb ? mb.slice(1).map(Number) : null };
}

// ═════════════════════════════════════════════════════════════════
// Main
// ═════════════════════════════════════════════════════════════════
console.log(`Area gambar maks ${AREA_CM.w} x ${AREA_CM.h} cm; target ${MAX_IMG_CM.w} x ${MAX_IMG_CM.h} cm = ${W} x ${H_MAX} px @ ${DPI} dpi; font minimum ${MIN_FONT_PT} pt = ${MIN_FONT_PX} px`);
const diagrams = [buildActivity(), buildArchitecture()];
let ok = true;
for (const d of diagrams) {
  writeFileSync(join(OUT, `${d.name}.svg`), d.svg, "utf8");
  const sizes = [...d.svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
  const minFs = Math.min(...sizes);
  console.log(`\n${d.name}: ${d.W} x ${d.H} px (${((d.W / DPI) * 2.54).toFixed(2)} x ${((d.H / DPI) * 2.54).toFixed(2)} cm) · ${d.info}`);
  console.log(`  font terkecil di SVG: ${minFs} px = ${((minFs * 72) / DPI).toFixed(2)} pt ${minFs >= MIN_FONT_PX ? "(OK >= 8 pt)" : "(KURANG DARI 8 pt!)"}`);
  if (minFs < MIN_FONT_PX) ok = false;
  if (d.warn.length) { ok = false; d.warn.forEach((w) => console.log("  PERINGATAN geometri: " + w)); }
  else console.log("  geometri: bersih");
}
if (ARGS.includes("--svg-only")) process.exit(ok ? 0 : 1);
if (!EDGE) throw new Error("msedge.exe tidak ditemukan; berikan --edge=PATH");

const pngs = [];
for (const d of diagrams) {
  const r = browserCheck(d);
  console.log(`\n${d.name} — pemeriksaan browser: ${r.n} teks, font terkecil terukur ${r.minFs}px = ${((r.minFs * 72) / DPI).toFixed(2)} pt, masalah ${r.issues.length}`);
  r.issues.forEach((i) => console.log("  - " + i));
  if (r.issues.length) ok = false;
  const png = screenshot(d);
  const info = readPngInfo(png);
  console.log(`  PNG: ${png} -> ${info.w} x ${info.h} px, ${info.dpi?.toFixed(1)} dpi ${info.w <= W && info.h <= H_MAX && Math.round(info.dpi) === DPI ? "(OK)" : "(TIDAK SESUAI)"}`);
  pngs.push(png);
}
const p = makePdf(pngs);
console.log(`\nPDF: ${p.pdf} -> ${p.pages} halaman, MediaBox ${p.mediaBox?.join(" ")} pt (A4 = 595.3 x 841.9 pt)`);
console.log(ok ? "\nSEMUA PEMERIKSAAN LOLOS" : "\nADA PEMERIKSAAN YANG GAGAL");
process.exit(ok ? 0 : 1);
