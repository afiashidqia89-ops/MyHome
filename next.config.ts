import type { NextConfig } from "next";

// BANGUN_WWW=1 → build STATIS untuk bundle dalam APK (Capacitor webDir www).
// API routes dipindahkan sementara oleh scripts/apk/bangun-www.mjs sebelum
// build ini dijalankan, sehingga export murni klien (offline-first).
const bangunWww = process.env.BANGUN_WWW === "1";

const nextConfig: NextConfig = {
  // BANGUN_WWW=1 → "export" (folder out/ → www/)
  // VERCEL       → undefined (full server: API routes + SSR)
  // sandbox/self-host → "standalone"
  output: bangunWww ? "export" : process.env.VERCEL ? undefined : "standalone",
  images: bangunWww ? { unoptimized: true } : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
