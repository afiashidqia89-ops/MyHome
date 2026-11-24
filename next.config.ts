import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" hanya untuk sandbox/self-host; di Vercel biarkan undefined —
  // pada Next 16.3+ kombinasi standalone + adapter Vercel membuat build gagal
  // (vercel/next.js#96646).
  output: process.env.VERCEL ? undefined : "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
