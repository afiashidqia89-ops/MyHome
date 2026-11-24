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

// 4. Output untuk langkah lanjutan di GitHub Actions (nama file, Release)
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(
    process.env.GITHUB_OUTPUT,
    `versionName=${versionName}\nversionCode=${versionCode}\n`,
    { flag: "a" },
  );
}
