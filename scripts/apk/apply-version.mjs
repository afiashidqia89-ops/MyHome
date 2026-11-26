#!/usr/bin/env node
// ============================================================
// RumahLayak (MyHome) — naikkan versi APK secara otomatis
//
// Dipakai oleh .github/workflows/build-apk.yml (dan bisa dijalankan
// manual sebelum `./gradlew assembleDebug`).
//
// Sumber nomor versi:
//   - mayor.minor : field "version" di package.json (mis. "0.2.1")
//   - nomor build : env GITHUB_RUN_NUMBER — naik +1 setiap kali workflow
//                   "Build APK" berjalan di GitHub Actions (default 1 lokal)
//
// Hasil (ditulis ke android/app/build.gradle sebelum build):
//   - versionCode = nomor build          → selalu NAIK, sehingga Android
//     menganggap APK baru sebagai PEMBARUAN (dipasang di atas versi lama)
//   - versionName = "<mayor>.<minor>.<nomor build>" (mis. "0.2.7")
//
// Output tambahan untuk langkah GitHub Actions berikutnya:
//   $GITHUB_OUTPUT → versionName, versionCode
// ============================================================

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pkgPath = join(root, "package.json");
const gradlePath = join(root, "android", "app", "build.gradle");

// 1. Versi dasar dari package.json
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const [mayor = "1", minor = "0"] = String(pkg.version || "1.0.0").split(".");

// 2. Nomor build: GITHUB_RUN_NUMBER di Actions; saat lokal default 1
const buildNumber = Number.parseInt(process.env.GITHUB_RUN_NUMBER || "1", 10);
if (!Number.isFinite(buildNumber) || buildNumber < 1) {
  console.error(`Nomor build tidak valid: ${process.env.GITHUB_RUN_NUMBER}`);
  process.exit(1);
}
const versionCode = buildNumber;
const versionName = `${mayor}.${minor}.${buildNumber}`;

// 3. Patch android/app/build.gradle yang dihasilkan `npx cap add android`
if (!existsSync(gradlePath)) {
  console.error(
    `Tidak menemukan ${gradlePath} — jalankan "npx cap add android" terlebih dahulu.`,
  );
  process.exit(1);
}
let gradle = readFileSync(gradlePath, "utf8");
const sebelumCode = gradle.match(/versionCode\s+\d+/)?.[0];
const sebelumName = gradle.match(/versionName\s+"[^"]*"/)?.[0];
if (!sebelumCode || !sebelumName) {
  console.error(
    "build.gradle tidak memuat versionCode/versionName bawaan Capacitor — tidak dipatch.",
  );
  process.exit(1);
}
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
writeFileSync(gradlePath, gradle);

console.log(`versionName : ${sebelumName} → "${versionName}"`);
console.log(`versionCode : ${sebelumCode} → ${versionCode} (naik otomatis tiap build)`);

// 3b. Patch android/app/src/main/AndroidManifest.xml — tambahkan izin
//     GPS & kamera. `npx cap add android` menghasilkan manifest yang
//     HANYA memuat izin INTERNET, dan plugin @capacitor/geolocation
//     TIDAK mendeklarasikan izin lokasi di manifestnya sendiri
//     (terverifikasi: manifest plugin kosong). Tanpa patch ini Android
//     menolak permintaan izin SECARA DIAM-DIAM — dialog "izinkan
//     lokasi/kamera" tidak pernah muncul di APK, tagging GPS selalu
//     gagal dan kamera in-app (getUserMedia) tak bisa dibuka.
//     Idempoten: izin yang sudah ada tidak ditulis ulang.
const manifestPath = join(root, "android", "app", "src", "main", "AndroidManifest.xml");
if (existsSync(manifestPath)) {
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
  let manifest = readFileSync(manifestPath, "utf8");
  const perluIzin = IZIN.filter((i) => !manifest.includes(i));
  const perluFitur = FITUR.filter((f) => !manifest.includes(f.match(/android:name="([^"]+)"/)[1]));
  if (perluIzin.length || perluFitur.length) {
    const idx = manifest.indexOf("<application");
    if (idx === -1) {
      console.warn("AndroidManifest tidak memuat <application> — izin TIDAK dipatch!");
    } else {
      const baris = [];
      const ditambah = [];
      for (const izin of perluIzin) {
        baris.push(`    <uses-permission android:name="${izin}" />`);
        ditambah.push(izin.split(".").pop());
      }
      for (const fitur of perluFitur) {
        baris.push(`    ${fitur}`);
        ditambah.push(fitur.match(/android:name="([^"]+)"/)[1].replace("android.hardware.", "fitur:"));
      }
      const blok = baris.join("\n\n");
      manifest = `${manifest.slice(0, idx).trimEnd()}\n\n${blok}\n\n    ${manifest.slice(idx).trimStart()}`;
      writeFileSync(manifestPath, manifest);
      console.log(`Izin AndroidManifest: + ${ditambah.join(", ")}`);
    }
  } else {
    console.log("Izin GPS & kamera sudah ada di AndroidManifest — tidak ada yang diubah.");
  }
} else {
  console.warn("android/app/src/main/AndroidManifest.xml tidak ditemukan — izin TIDAK dipatch (jalankan npx cap add android dulu).");
}

// 4. Output untuk langkah lanjutan di GitHub Actions (nama file, Release)
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(
    process.env.GITHUB_OUTPUT,
    `versionName=${versionName}\nversionCode=${versionCode}\n`,
    { flag: "a" },
  );
}
