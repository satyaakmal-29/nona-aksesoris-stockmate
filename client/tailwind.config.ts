import type { Config } from "tailwindcss";

// Palet merek Nona Aksesoris (pink, diturunkan dari logo toko).
// 50–200 : pink muda untuk latar & aksen lembut
// 500–700: pink raspberry untuk tombol / teks di atas putih
//          (500 = #c93e7b, kontras dengan teks putih ±4,7:1 → lolos WCAG AA)
const brand = {
  50:  "#fff4f8",
  100: "#fde6ef",
  200: "#fbcde0",
  300: "#f5a3c3",
  400: "#e9739f",
  500: "#c93e7b",
  600: "#b0326a",
  700: "#922957",
  800: "#782449",
  900: "#64213f",
  950: "#3d0f24",
};

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand,
        // Seluruh warna aksen aplikasi sebelumnya memakai "blue-*".
        // Dipetakan ke palet merek agar tombol, link, menu aktif, fokus input,
        // dan badge informasi otomatis berwarna pink secara konsisten.
        blue: brand,
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};

export default config;
