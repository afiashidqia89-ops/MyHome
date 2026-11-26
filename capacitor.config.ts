import type { CapacitorConfig } from "@capacitor/cli";

// ============================================================
// RumahLayak (MyHome) — Konfigurasi APK Android (Capacitor 8)
// Model OFFLINE-FIRST: WebView memuat aplikasi dari BUNDLE LOKAL
// di dalam APK (folder www/ hasil `npm run build:www`), jadi APK
// selalu bisa dibuka tanpa internet.
//
// Server (LAN/Vercel) dipakai untuk LOGIN + SINKRONISASI data;
// alamatnya diisi di aplikasi: ikon gear (Set IP) di layar login
// / menu Pengaturan — tidak perlu membangun ulang APK untuk
// mengganti server. cleartext: true → izinkan http://192.168.x.x
// (server LAN). androidScheme: "http" → fetch ke server LAN
// http:// tidak dianggap mixed-content oleh WebView.
// ============================================================

const config: CapacitorConfig = {
  appId: "id.pertanian.rumahlayak",
  // Nama launcher (di bawah ikon APK): variabel repo GitHub APP_NAME
  // (Settings → Secrets and variables → Actions → Variables) → bila kosong,
  // pakai nilai di bawah. Ganti nilai di bawah untuk mengubah permanen.
  appName: process.env.APP_NAME || "RumahLayak",
  // Folder web statis bawaan — DIISI oleh `npm run build:www`
  // (export Next.js + API routes dihapus) sebelum `npx cap sync android`.
  webDir: "www",
  server: {
    // Tanpa `url` → WebView memuat bundle lokal (offline-first).
    // JANGAN menaruh server.url lagi — alamat server diatur dari
    // dalam aplikasi lewat menu Set IP (tersimpan per perangkat).
    cleartext: true,
    androidScheme: "http",
  },
  plugins: {
    // SPLASH SCREEN — ikon+brand tampil saat APK dibuka (dari assets/splash.png
    // yang diterapkan workflow lewat @capacitor/assets). autoHide setelah 1,5 s
    // sehingga aplikasi langsung masuk Beranda tanpa penundaan terasa.
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      launchFadeOutDuration: 400,
      backgroundColor: "#14532D",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
