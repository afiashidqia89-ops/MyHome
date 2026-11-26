#!/usr/bin/env node
// ============================================================
// RumahLayak (MyHome) — terapkan IZIN PERANGKAT ke AndroidManifest
//
// Dipakai oleh .github/workflows/build-apk.yml, dijalankan SETELAH
// `npx cap add android` + `npx cap sync android`.
//
// Kenapa perlu: manifest bawaan `cap add` HANYA memuat izin INTERNET,
// dan plugin @capacitor/geolocation TIDAK mendeklarasikan izin lokasi
// di manifestnya sendiri (terverifikasi: AndroidManifest.xml plugin
// kosong). Tanpa patch ini Android menolak permintaan izin SECARA
// DIAM-DIAM — dialog "izinkan lokasi/kamera" tidak pernah muncul,
// tagging GPS selalu gagal dan kamera in-app tak bisa dibuka.
//
// Idempoten: izin yang sudah ada tidak ditulis ulang — aman dijalankan
// berulang kali (folder android/ dipertahankan antar build).
// ============================================================

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifestPath = join(root, "android", "app", "src", "main", "AndroidManifest.xml");

const IZIN = [
  // GPS — tagging koordinat pemeriksaan (@capacitor/geolocation)
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  // Kamera bawaan aplikasi — getUserMedia di WebView (VIDEO_CAPTURE);
  // Capacitor otomatis memunculkan dialog runtime bila izin ini ada.
  "android.permission.CAMERA",
];

const FITUR = [
  '<uses-feature android:name="android.hardware.location.gps" android:required="false" />',
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
];

if (!existsSync(manifestPath)) {
  console.error(
    `Tidak menemukan ${manifestPath} — jalankan "npx cap add android" terlebih dahulu.`,
  );
  process.exit(1);
}

let manifest = readFileSync(manifestPath, "utf8");
const ditambah = [];

// Sisipkan blok izin tepat SEBELUM <application> (posisi standar uses-permission).
function sisipSebelumAplikasi(blok) {
  const idx = manifest.indexOf("<application");
  if (idx === -1) {
    console.error("AndroidManifest tidak memuat <application> — format tidak dikenal, tidak dipatch.");
    process.exit(1);
  }
  manifest = `${manifest.slice(0, idx).trimEnd()}\n\n${blok}\n\n    ${manifest.slice(idx).trimStart()}`;
}

const perluIzin = IZIN.filter((i) => !manifest.includes(i));
const perluFitur = FITUR.filter((f) => !manifest.includes(f.match(/android:name="([^"]+)"/)[1]));

if (!perluIzin.length && !perluFitur.length) {
  console.log("Semua izin GPS & kamera sudah ada di AndroidManifest — tidak ada yang diubah.");
  process.exit(0);
}

const baris = [];
for (const izin of perluIzin) {
  baris.push(`    <uses-permission android:name="${izin}" />`);
  ditambah.push(izin.split(".").pop());
}
for (const fitur of perluFitur) {
  baris.push(`    ${fitur}`);
  ditambah.push(fitur.match(/android:name="([^"]+)"/)[1].replace("android.hardware.", "fitur:"));
}

sisipSebelumAplikasi(baris.join("\n\n"));
writeFileSync(manifestPath, manifest);

console.log(`Izin ditambahkan ke AndroidManifest: ${ditambah.join(", ")}`);
