"use client";

import { useId } from "react";

// Hiasan perhiasan realistis untuk latar login (SVG inline, tanpa file gambar).
// - Logam "rose-gold" & kristal memakai gradasi dari palet brand yang sudah ada.
// - Mutiara: gradasi bulat + titik pantulan cahaya.
// - Rantai: mata rantai bergantian (tampak depan / samping), bukan garis titik.
// - Hiasan gantung di tepi atas berayun pelan (.nona-sway), mati jika "kurangi gerak".

// Warna stop gradasi diambil dari theme Tailwind (tidak ada palet baru)
const STOP = {
  white:  "[stop-color:#ffffff]",
  b50:    "[stop-color:theme(colors.brand.50)]",
  b100:   "[stop-color:theme(colors.brand.100)]",
  b200:   "[stop-color:theme(colors.brand.200)]",
  b300:   "[stop-color:theme(colors.brand.300)]",
  b400:   "[stop-color:theme(colors.brand.400)]",
  b500:   "[stop-color:theme(colors.brand.500)]",
  b600:   "[stop-color:theme(colors.brand.600)]",
  b700:   "[stop-color:theme(colors.brand.700)]",
};

// Gradasi bersama (dibuat sekali per SVG dengan id unik)
const Defs = ({ id }: { id: string }) => (
  <defs>
    {/* logam mengilap: gelap → terang → kilau putih → gelap */}
    <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" className={STOP.b400} />
      <stop offset="0.35" className={STOP.b200} />
      <stop offset="0.5" className={STOP.white} />
      <stop offset="0.65" className={STOP.b300} />
      <stop offset="1" className={STOP.b600} />
    </linearGradient>
    {/* mutiara: pantulan di kiri atas, tepi sedikit kemerahan */}
    <radialGradient id={`${id}-pearl`} cx="0.36" cy="0.3" r="0.75">
      <stop offset="0" className={STOP.white} />
      <stop offset="0.45" className={STOP.b50} />
      <stop offset="0.8" className={STOP.b100} />
      <stop offset="1" className={STOP.b300} />
    </radialGradient>
    {/* kristal */}
    <linearGradient id={`${id}-gem`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" className={STOP.b100} />
      <stop offset="0.4" className={STOP.b300} />
      <stop offset="0.75" className={STOP.b500} />
      <stop offset="1" className={STOP.b700} />
    </linearGradient>
  </defs>
);

// Rantai vertikal dari y0 sejauh `length`: mata rantai oval saling mengait,
// bergantian tampak depan (oval lebar) dan samping (oval pipih); tiap mata
// diberi garis tepi gelap lalu lapisan logam mengilap agar bentuknya tegas.
const Chain = ({ id, x, y0, length }: { id: string; x: number; y0: number; length: number }) => {
  const STEP = 4.3; // jarak antarmata < tinggi mata → saling bertumpuk/mengait
  const links = Math.max(1, Math.floor(length / STEP));
  const link = (i: number, stroke: string, width: number) => {
    const cy = y0 + i * STEP + 3;
    return i % 2 === 0
      ? <ellipse key={i} cx={x} cy={cy} rx="2.3" ry="3.4" stroke={stroke} strokeWidth={width} />
      : <ellipse key={i} cx={x} cy={cy} rx="0.75" ry="3.4" stroke={stroke} strokeWidth={width + 0.25} />;
  };
  return (
    <g fill="none">
      <g className="[stroke:theme(colors.brand.600)]" opacity="0.55">
        {Array.from({ length: links }, (_, i) => link(i, "inherit", 1.7))}
      </g>
      {Array.from({ length: links }, (_, i) => link(i, `url(#${id}-metal)`, 1.05))}
    </g>
  );
};

const PearlBead = ({ id, cx, cy, r }: { id: string; cx: number; cy: number; r: number }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-pearl)`} />
    {/* tepi tipis agar bulatan tegas di atas latar terang */}
    <circle cx={cx} cy={cy} r={r - 0.25} fill="none" strokeWidth="0.5" className="[stroke:theme(colors.brand.300)]" opacity="0.7" />
    <ellipse cx={cx - r * 0.35} cy={cy - r * 0.4} rx={r * 0.28} ry={r * 0.18} fill="#fff" opacity="0.9" />
  </g>
);

// Liontin kristal bersegi berbentuk tetes air, digantung di (cx, top)
const Crystal = ({ id, cx, top, size }: { id: string; cx: number; top: number; size: number }) => {
  const s = size / 40;
  const p = (x: number, y: number) => `${cx + x * s},${top + y * s}`;
  return (
    <g>
      {/* kait kecil */}
      <circle cx={cx} cy={top - 2.2} r="2.2" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="1.2" />
      {/* badan kristal */}
      <polygon points={[p(0, 0), p(13, 22), p(10, 40), p(0, 50), p(-10, 40), p(-13, 22)].join(" ")} fill={`url(#${id}-gem)`} />
      {/* segi-segi */}
      <polygon points={[p(0, 0), p(13, 22), p(0, 28), p(-13, 22)].join(" ")} fill="#fff" opacity="0.28" />
      <polygon points={[p(0, 0), p(-13, 22), p(-5, 20)].join(" ")} fill="#fff" opacity="0.55" />
      <polygon points={[p(-13, 22), p(0, 28), p(-10, 40)].join(" ")} fill="#fff" opacity="0.12" />
      <polyline points={[p(-13, 22), p(0, 28), p(13, 22)].join(" ")} fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.6" />
      <polyline points={[p(0, 28), p(0, 50)].join(" ")} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.6" />
      {/* kilau */}
      <path d={`M${cx - 6 * s} ${top + 13 * s}l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2Z`} fill="#fff" />
    </g>
  );
};

const HeartCharm = ({ id, cx, top, size }: { id: string; cx: number; top: number; size: number }) => {
  const s = size / 30;
  return (
    <g>
      <circle cx={cx} cy={top - 2.2} r="2.2" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="1.2" />
      <path
        transform={`translate(${cx - 15 * s} ${top}) scale(${s})`}
        d="M15 27C5 20 0 14 0 8.5A7.5 7.5 0 0 1 15 5a7.5 7.5 0 0 1 15 3.5C30 14 25 20 15 27Z"
        fill={`url(#${id}-metal)`}
      />
      <path
        transform={`translate(${cx - 15 * s} ${top}) scale(${s})`}
        d="M7 4.5A4 4 0 0 0 3.5 9"
        fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.85"
      />
    </g>
  );
};

const StarCharm = ({ id, cx, top, size }: { id: string; cx: number; top: number; size: number }) => {
  const s = size / 24;
  return (
    <g>
      <circle cx={cx} cy={top - 2.2} r="2.2" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="1.2" />
      <path
        transform={`translate(${cx - 12 * s} ${top}) scale(${s})`}
        d="M12 0C12.9 7.6 16.4 11.1 24 12 16.4 12.9 12.9 16.4 12 24 11.1 16.4 7.6 12.9 0 12 7.6 11.1 11.1 7.6 12 0Z"
        fill={`url(#${id}-metal)`}
      />
      <circle cx={cx - 1.5 * s} cy={top + 9 * s} r={1.2 * s} fill="#fff" opacity="0.9" />
    </g>
  );
};

// ── Hiasan gantung (tergantung dari tepi atas layar) ──────────────
type Pendant = "crystal" | "heart" | "star" | "pearl-drop";

type HangingProps = {
  chain: number;          // panjang rantai / untaian (unit viewBox)
  pearls?: number;        // jumlah mutiara untaian (0 = rantai saja)
  pendant: Pendant;
  className?: string;     // posisi, tinggi (ukuran tampil) & delay ayunan
};

export const HangingJewel = ({ chain, pearls = 0, pendant, className = "" }: HangingProps) => {
  const id = useId().replace(/:/g, "");
  const cx = 20;
  const pearlR = 4.2;
  const strand = pearls * (pearlR * 2 + 1.2);
  const pendantTop = chain + strand + 4;
  const total = pendantTop + 56;

  return (
    <svg viewBox={`0 0 40 ${total}`} className={`nona-sway nona-hang ${className}`} overflow="visible">
      <Defs id={id} />
      <Chain id={id} x={cx} y0={-4} length={chain + 4} />
      {Array.from({ length: pearls }, (_, i) => (
        <PearlBead key={i} id={id} cx={cx} cy={chain + pearlR + 0.6 + i * (pearlR * 2 + 1.2)} r={pearlR} />
      ))}
      {pendant === "crystal" && <Crystal id={id} cx={cx} top={pendantTop} size={32} />}
      {pendant === "heart" && <HeartCharm id={id} cx={cx} top={pendantTop} size={22} />}
      {pendant === "star" && <StarCharm id={id} cx={cx} top={pendantTop} size={30} />}
      {pendant === "pearl-drop" && (
        <>
          <circle cx={cx} cy={pendantTop - 2.2} r="2.2" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="1.2" />
          <PearlBead id={id} cx={cx} cy={pendantTop + 8} r={8} />
        </>
      )}
    </svg>
  );
};

// ── Cincin realistis (logam mengilap + permata) ───────────────────
export const JewelRing = ({ className = "" }: { className?: string }) => {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 120" className={`nona-hang ${className}`}>
      <Defs id={id} />
      {/* lingkar cincin: dua elips berlapis memberi kesan tebal */}
      <ellipse cx="60" cy="76" rx="38" ry="33" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="8" />
      <ellipse cx="60" cy="76" rx="38" ry="33" fill="none" stroke="#fff" strokeWidth="1.2" strokeOpacity="0.55" strokeDasharray="40 200" strokeDashoffset="-150" />
      {/* dudukan permata */}
      <path d="M48 44h24l-4 7H52Z" fill={`url(#${id}-metal)`} />
      {/* permata bersegi */}
      <polygon points="60,18 76,32 60,48 44,32" fill={`url(#${id}-gem)`} />
      <polygon points="60,18 76,32 60,30 44,32" fill="#fff" opacity="0.35" />
      <polygon points="60,18 44,32 54,30" fill="#fff" opacity="0.6" />
      <path d="M52 26l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1Z" fill="#fff" />
    </svg>
  );
};

// ── Mutiara lepas ─────────────────────────────────────────────────
export const LoosePearl = ({ className = "" }: { className?: string }) => {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 20 20" className={`nona-hang ${className}`}>
      <Defs id={id} />
      <PearlBead id={id} cx={10} cy={10} r={9} />
    </svg>
  );
};

// ── Kilauan bintang kecil ─────────────────────────────────────────
export const Sparkle = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 0C12.9 7.6 16.4 11.1 24 12 16.4 12.9 12.9 16.4 12 24 11.1 16.4 7.6 12.9 0 12 7.6 11.1 11.1 7.6 12 0Z" />
  </svg>
);
