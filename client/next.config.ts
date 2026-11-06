import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Cache dev Turbopack dimatikan: cache yang rusak (dev server mati paksa)
    // membuat halaman yang ada (mis. /login) tampil 404.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
