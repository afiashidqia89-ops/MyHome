// ============================================================
// RumahLayak — Membangun bundle WEB STATIS untuk APK (offline-first)
//
// Alur:
//   1. `prisma generate` (dibutuhkan impor @prisma/client saat build)
//   2. API routes (`src/app/api`) DIPINDAH sementara keluar dari src/app
//      → export statis tidak boleh memuat route handler dinamis
//   3. `next build` dengan BANGUN_WWW=1 → output: "export" → folder out/
//   4. API routes dikembalikan (selalu, termasuk saat build gagal)
//   5. out/ disalin ke www/ (dibaca Capacitor saat membangun APK)
// Pakai: npm run build:www
// ============================================================

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const AKAR = process.cwd();
const DIR_API = path.join(AKAR, "src", "app", "api");
const DIR_SIMPAN = path.join(AKAR, ".apk-simpan-api");
const DIR_OUT = path.join(AKAR, "out");
const DIR_WWW = path.join(AKAR, "www");

function jalankan(cmd, args, env = {}) {
  const hasil = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (hasil.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} keluar dengan kode ${hasil.status}`);
  }
}

function pindahkanApiKeluar() {
  if (fs.existsSync(DIR_API)) {
    fs.rmSync(DIR_SIMPAN, { recursive: true, force: true });
    fs.renameSync(DIR_API, DIR_SIMPAN);
    console.log("[bangun-www] src/app/api dipindah sementara → .apk-simpan-api");
  }
}

function kembalikanApi() {
  if (fs.existsSync(DIR_SIMPAN)) {
    fs.rmSync(DIR_API, { recursive: true, force: true });
    fs.renameSync(DIR_SIMPAN, DIR_API);
    console.log("[bangun-www] src/app/api dikembalikan ke tempatnya");
  }
}

try {
  // 1) Prisma client (tanpa koneksi DB — hanya generate tipe)
  jalankan("npx", ["prisma", "generate"]);

  // 2) Pindahkan API routes keluar dari pohon app
  pindahkanApiKeluar();

  // 3) Build statis
  jalankan("npx", ["next", "build"], { BANGUN_WWW: "1" });
} finally {
  // 4) SELALU kembalikan API routes (juga saat build gagal)
  kembalikanApi();
}

// 5) Salin out/ → www/
if (!fs.existsSync(path.join(DIR_OUT, "index.html"))) {
  console.error("[bangun-www] GAGAL: out/index.html tidak ditemukan — export statis tidak lengkap.");
  process.exit(1);
}
fs.rmSync(DIR_WWW, { recursive: true, force: true });
fs.cpSync(DIR_OUT, DIR_WWW, { recursive: true });
const ukuran = hitungUkuran(DIR_WWW);
console.log(`[bangun-www] www/ siap — ${(ukuran / 1024 / 1024).toFixed(1)} MB, ${hitungFile(DIR_WWW)} file`);
console.log("[bangun-www] Lanjutkan dengan: npx cap sync android && gradlew assembleDebug");

function hitungUkuran(dir) {
  let total = 0;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    total += f.isDirectory() ? hitungUkuran(p) : fs.statSync(p).size;
  }
  return total;
}

function hitungFile(dir) {
  let n = 0;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    n += f.isDirectory() ? hitungFile(p) : 1;
  }
  return n;
}
