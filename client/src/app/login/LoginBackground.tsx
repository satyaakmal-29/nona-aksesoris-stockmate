"use client";

import { useEffect, useRef, useState } from "react";
import { Montserrat } from "next/font/google";
import { HangingJewel, JewelRing, LoosePearl, Sparkle } from "./JewelryOrnaments";

// Latar dekoratif halaman login Nona Aksesoris (gaya poster produk):
// - "NONA" putih tebal berukuran besar di BELAKANG form login yang tetap di tengah.
//   Bentuk huruf terbaca dari gradasi pastel di belakangnya; kartu form menutupi
//   huruf tengah dengan rapi dan bayangannya jatuh ke huruf.
// - Posisi dihitung dari ukuran tinta huruf sebenarnya (canvas measureText), sehingga
//   pusat huruf kapital tepat di pusat kartu dan "AKSESORIS" persis selebar kartu.
// - Murni dekorasi: pointer-events-none & aria-hidden, tidak menyentuh form.

const display = Montserrat({ subsets: ["latin"], weight: ["300", "900"], display: "swap" });

type Rect = { x: number; y: number; w: number; h: number };
type Layout = {
  mode: "behind" | "below";
  nona: { left: number; top: number; size: number; inkW: number; capTop: number; capH: number };
  aks: { left: number; top: number; size: number; spacing: number; width: number };
  blobTop: number; // area gradasi pastel (mengikuti bagian huruf yang terlihat)
  blobH: number;
};

// Ukuran tinta (bukan kotak teks) per 1px ukuran huruf
type Metrics = {
  inkLeft: number;   // jarak tepi kiri kotak teks ke tinta pertama
  inkW: number;      // lebar tinta
  capAscent: number; // tinggi huruf kapital di atas garis dasar
  baseline: number;  // posisi garis dasar dari atas kotak (line-height 1)
};

const measureText = (text: string, weight: number, family: string): Metrics | null => {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  const size = 100;
  ctx.font = `${weight} ${size}px ${family}`;
  const m = ctx.measureText(text);
  const fontAscent = m.fontBoundingBoxAscent ?? size * 0.95;
  const fontDescent = m.fontBoundingBoxDescent ?? size * 0.25;
  return {
    inkLeft: -m.actualBoundingBoxLeft / size,
    inkW: (m.actualBoundingBoxRight + m.actualBoundingBoxLeft) / size,
    capAscent: m.actualBoundingBoxAscent / size,
    // dengan line-height 1, kotak baris = 1em; sisa ruang dibagi rata atas-bawah
    baseline: ((size - (fontAscent + fontDescent)) / 2 + fontAscent) / size,
  };
};

// ── Komponen utama ────────────────────────────────────────────────
const LoginBackground = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    const container = rootRef.current?.parentElement;
    if (!container) return;
    const family = display.style.fontFamily;

    let frame = 0;
    let nonaM: Metrics | null = null;
    let aksM: Metrics | null = null;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const cardEl = container.querySelector<HTMLElement>("[data-login-card]");
        if (!cardEl) return;
        nonaM ??= measureText("NONA", 900, family);
        aksM ??= measureText("AKSESORIS", 300, family);
        if (!nonaM || !aksM) return;

        const base = container.getBoundingClientRect();
        const c = cardEl.getBoundingClientRect();
        const card: Rect = { x: c.left - base.left, y: c.top - base.top, w: c.width, h: c.height };
        const W = base.width;
        const cx = card.x + card.w / 2;

        // Layar lebar: tulisan di belakang kartu (huruf tengah tertutup kartu, seperti contoh).
        // Layar sempit (HP/tablet tegak): kartu hampir selebar layar → tulisan di bawah kartu,
        // bagian atas huruf tetap tertutup tepi bawah kartu.
        const mode: Layout["mode"] = 0.94 * W >= 2.5 * card.w ? "behind" : "below";

        let size: number;
        let capCenterY: number;
        if (mode === "behind") {
          size = Math.min((3 * card.w) / nonaM.inkW, (0.94 * W) / nonaM.inkW, (0.9 * card.h) / nonaM.capAscent);
          capCenterY = card.y + card.h / 2;
        } else {
          size = Math.min((0.92 * W) / nonaM.inkW, (2.4 * card.w) / nonaM.inkW);
          const capH = size * nonaM.capAscent;
          // ±30% atas huruf berada di belakang kartu
          capCenterY = card.y + card.h + capH * 0.2;
        }

        const inkW = size * nonaM.inkW;
        const capH = size * nonaM.capAscent;

        const nona = {
          // geser kotak teks agar tinta huruf tepat di tengah
          left: cx - inkW / 2 - size * nonaM.inkLeft,
          top: capCenterY - (size * nonaM.baseline - capH / 2),
          size,
          inkW,
          capTop: capCenterY - capH / 2,
          capH,
        };

        // "AKSESORIS": tipis dengan jarak huruf sedang (0.35em); lebar total ±80% kartu
        const TRACK = 0.35;
        const letters = 9;
        const aksWidth = Math.min(card.w * 0.8, 0.8 * W);
        const aksSize = Math.max(16, Math.min(aksWidth / (aksM.inkW + TRACK * (letters - 1)), 40));
        const spacing = aksSize * TRACK;
        const realWidth = aksSize * aksM.inkW + spacing * (letters - 1);
        const nonaBottom = nona.capTop + capH;
        // di bawah kartu (layar lebar) atau di bawah huruf NONA (layar sempit)
        const aksTop = (mode === "behind" ? card.y + card.h : nonaBottom) + Math.max(28, aksSize * 1.5);

        setLayout({
          mode,
          nona,
          aks: { left: cx - realWidth / 2 - aksSize * aksM.inkLeft, top: aksTop, size: aksSize, spacing, width: realWidth },
          blobTop: mode === "below" ? nona.capTop - capH * 0.25 : nona.capTop - capH * 0.7,
          blobH: mode === "below" ? capH * 1.6 : capH * 2.4,
        });
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    const card = container.querySelector("[data-login-card]");
    if (card) ro.observe(card);
    // ukur ulang setelah font Montserrat benar-benar termuat
    document.fonts?.load(`900 100px ${family}`).then(() => { nonaM = null; aksM = null; measure(); });
    document.fonts?.load(`300 100px ${family}`).then(() => { aksM = null; measure(); });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div ref={rootRef} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none">
      {/* ── Gradasi pastel di belakang tulisan (membuat huruf putih terbaca) ── */}
      {layout && (
        <div
          className="absolute transition-opacity duration-700"
          style={{
            left: layout.nona.left + layout.nona.size * 0.02,
            top: layout.blobTop,
            width: layout.nona.inkW,
            height: layout.blobH,
          }}
        >
          <div className="absolute left-[-8%] top-[16%] h-[72%] w-[46%] rounded-full bg-brand-300/60 blur-3xl dark:bg-brand-500/30" />
          <div className="absolute left-[28%] top-[6%] h-[84%] w-[44%] rounded-full bg-purple-300/50 blur-3xl dark:bg-purple-500/25" />
          <div className="absolute right-[-8%] top-[18%] h-[70%] w-[46%] rounded-full bg-fuchsia-300/50 blur-3xl dark:bg-fuchsia-500/25" />
        </div>
      )}

      {/* ── NONA (focal point) ─────────────────────────────────────── */}
      <div className={`${display.className} transition-opacity duration-500 ${layout ? "opacity-100" : "opacity-0"}`}>
        {layout && (
          <>
            <span
              className="nona-word absolute whitespace-nowrap font-black leading-none"
              style={{ left: layout.nona.left, top: layout.nona.top, fontSize: layout.nona.size }}
            >
              NONA
            </span>

            {/* AKSESORIS: tipis & lebar, selebar kartu */}
            <span
              className="absolute whitespace-nowrap font-light leading-none text-brand-500/80 dark:text-brand-300/70"
              style={{
                left: layout.aks.left,
                top: layout.aks.top,
                fontSize: layout.aks.size,
                letterSpacing: layout.aks.spacing,
                marginRight: -layout.aks.spacing,
              }}
            >
              AKSESORIS
            </span>

          </>
        )}
      </div>

      {/* ── Hiasan gantung di tepi atas layar (berayun pelan) ───────── */}
      {/* HP: dua hiasan pendek di pojok agar tidak menutupi logo */}
      <HangingJewel chain={46} pendant="heart" className="absolute left-[6%] top-0 h-40 [animation-delay:-1.5s] md:hidden" />
      <HangingJewel chain={30} pearls={3} pendant="crystal" className="absolute right-[6%] top-0 h-48 [animation-delay:-4s] md:hidden" />

      {/* Layar lebar: empat untaian dengan panjang & liontin berbeda */}
      <HangingJewel chain={70} pearls={9} pendant="crystal" className="absolute left-[8%] top-0 hidden h-[400px] md:block" />
      <HangingJewel chain={96} pendant="heart" className="absolute left-[19%] top-0 hidden h-[270px] [animation-delay:-2.2s] md:block" />
      <HangingJewel chain={120} pearls={2} pendant="pearl-drop" className="absolute right-[19%] top-0 hidden h-[330px] [animation-delay:-3.6s] md:block" />
      <HangingJewel chain={40} pearls={5} pendant="star" className="absolute right-[8%] top-0 hidden h-[270px] [animation-delay:-5s] md:block" />

      {/* ── Aksen bawah: cincin & mutiara lepas ──────────────────────── */}
      <JewelRing className="absolute bottom-[6%] right-[6%] hidden w-24 rotate-[16deg] md:block" />
      <LoosePearl className="absolute bottom-[9%] right-[13%] hidden w-4 md:block" />
      <LoosePearl className="absolute bottom-[12%] left-[7%] hidden w-5 md:block" />
      <LoosePearl className="absolute bottom-[8%] left-[10%] hidden w-3 md:block" />
      <Sparkle className="nona-twinkle absolute bottom-[16%] left-[13%] hidden h-4 w-4 text-brand-300 md:block" />
      <Sparkle className="nona-twinkle absolute bottom-[18%] right-[9%] hidden h-3.5 w-3.5 text-brand-300 [animation-delay:2.5s] md:block" />
      <Sparkle className="nona-twinkle absolute left-[28%] top-[14%] hidden h-3 w-3 text-brand-300 [animation-delay:1.2s] md:block" />
      <Sparkle className="nona-twinkle absolute right-[28%] top-[10%] hidden h-3.5 w-3.5 text-brand-300 [animation-delay:3.2s] md:block" />
    </div>
  );
};

export default LoginBackground;
