import type { CapacitorConfig } from "@capacitor/cli";

// ============================================================
// RumahLayak (MyHome) — Konfigurasi APK Android (Capacitor 8)
// Model: WebView shell → memuat UI dari server Vercel.
// Ganti server lewat menu "Set IP" di layar login APK (perangkat),
// atau edit baris `url` di bawah lalu jalankan ulang `npx cap sync android`.
// ============================================================

const config: CapacitorConfig = {
  appId: "id.pertanian.rumahlayak",
  // Nama launcher (di bawah ikon APK): variabel repo GitHub APP_NAME
  // (Settings → Secrets and variables → Actions → Variables) → bila kosong,
  // pakai nilai di bawah. Ganti nilai di bawah untuk mengubah permanen.
  appName: process.env.APP_NAME || "RumahLayak",
  // Folder web statis bawaan (jembatan sebelum WebView mengarah ke server)
  webDir: "www",
  server: {
    // Alamat server Vercel yang dibenamkan ke APK.
    // Prioritas: variabel repo GitHub `APP_SERVER_URL` (dipakai workflow
    // build-apk.yml) → kalau kosong, pakai nilai di bawah (edit manual).
    // Contoh: CAP_SERVER_URL="https://myhome-afiashidqia89-ops.vercel.app"
    url: process.env.CAP_SERVER_URL || "https://GANTI-DOMAIN-VERCEL-ANDA.vercel.app",
    // true = izinkan Set IP ke server LAN http://192.168.x.x (mode demo/pratinjau).
    // Untuk rilis publik, set false (semua koneksi wajib https).
    cleartext: true,
    androidScheme: "https",
  },
};

export default config;
