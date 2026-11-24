# RumahLayak — Panduan Deployment (GitHub + Neon + Vercel)

Panduan lengkap membawa aplikasi dari sandbox demo ke produksi: kode di **GitHub**, database di **Neon PostgreSQL**, aplikasi berjalan di **Vercel**, dan APK Android mengarah ke domain Vercel.

> Ringkasan alur: **push repo ke GitHub → buat database Neon → isi data (porting/seed) → import repo di Vercel → set environment variables → deploy → uji → atur APK.**

---

## 0. Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| Akun GitHub | untuk menyimpan repo |
| Akun Neon | database PostgreSQL gratis (free plan cukup untuk demo) |
| Akun Vercel | hosting Next.js (Hobby plan cukup) |
| Tools lokal | git, Node.js ≥ 20 (atau Bun ≥ 1.1) |
| Kode | repo bersih — `.env`, `db/custom.db`, artefak sandbox sudah dikeluarkan dari tracking |

## 1. GitHub — simpan kode

Repo GitHub **rumahlayak** sudah disiapkan (kosong). Tinggal sambungkan dan push:

```bash
cd <folder proyek>
git remote add origin https://github.com/<akun-anda>/rumahlayak.git
git push -u origin main
```

Yang masuk repo: `src/`, `prisma/`, `scripts/`, `public/`, konfigurasi, `README.md`, `DEPLOY.md`, `vercel.json`, `.env.example`.
Yang **tidak** masuk (sudah di `.gitignore`): `.env`, `db/*.db`, foto upload, artefak sandbox, dan `prisma/schema.postgres.prisma` (di-generate otomatis saat build).

## 2. Neon — buat database PostgreSQL

1. Buka [console.neon.tech](https://console.neon.tech) → **New Project**.
2. Nama proyek: `rumahlayak`; **Region: Singapore (AWS ap-southeast-1)** — paling dekat dengan Kalimantan.
3. Buka **Dashboard → Connection Details** dan salin **connection string** langsung (host TANPA akhiran `-pooler`), format:

```
postgresql://<user>:<password>@ep-xxx.ap-southeast-1.aws.neon.tech/rumahlayak?sslmode=require
```

> Mengapa langsung (bukan pooled)? Perintah `prisma db push` yang dijalankan saat build Vercel membutuhkan koneksi langsung. Untuk skala demo, koneksi langsung aman dipakai juga saat runtime. Jika kelak traffic tinggi, aktifkan pooled connection untuk aplikasi dan simpan yang langsung untuk migrasi.

> **Alternatif tanpa copy-paste**: di Vercel → tab **Storage → Marketplace → Neon → Create database**. Vercel membuat database dan mengisi `DATABASE_URL` otomatis pada project. Lewati langkah 3 (porting/seed manual) dan jalankan seed lewat Vercel CLI, atau tetap ikuti langkah 3 dari komputer lokal memakai URL yang diberikan Vercel.

## 3. Isi data Neon — porting atau seed

Semua data demo sandbox siap dibangun ke Neon lewat satu skrip. Pilih salah satu:

**Pilihan A — Porting (disarankan): salin PERSIS data pratinjau saat ini**

Meng-copy seluruh isi `db/custom.db` dengan ID asli dipertahankan: struktur estate/kebun/afdeling/9 perumahan, 9 pengguna + 10 binding multi-level, 4 kartu + 27 item checklist, 4 matriks approval, **12 inspeksi (kode PRM-W#-##)**, 324 hasil item, **22 foto (dataUrl + GPS)**, 7 temuan (TND-###), 4 tindak lanjut, 24 log aktivitas.

```bash
scripts/deploy/neon-sync.sh "postgresql://…neon.tech/rumahlayak?sslmode=require"
```

**Pilihan B — Seed segar: data demo standar dari `prisma/seed.ts`**

```bash
scripts/deploy/neon-sync.sh "postgresql://…neon.tech/rumahlayak?sslmode=require" --seed
```

> ⚠️ `--seed` menghapus seluruh data yang ada di Neon sebelum menanam ulang.

Yang dilakukan skrip (kedua pilihan):
1. Generate `prisma/schema.postgres.prisma` (provider `postgresql`) dari `schema.prisma`.
2. `prisma db push` — membuat semua tabel di Neon.
3. Porting/seed data + verifikasi jumlah baris per tabel.
4. Mengembalikan Prisma client ke SQLite agar pengembangan sandbox tetap jalan.

Tanpa skrip (manual): `DATABASE_URL=<neon> scripts/deploy/prepare-postgres.sh` lalu `DATABASE_URL=<neon> bun scripts/deploy/port-sqlite-to-neon.ts` (atau `bun prisma/seed.ts`).

## 4. Vercel — deploy aplikasi

1. [vercel.com/new](https://vercel.com/new) → **Import** repo `rumahlayak` dari GitHub.
2. Framework: **Next.js** (terdeteksi otomatis). `vercel.json` sudah menetapkan build command yang benar — meng-generate schema PostgreSQL lalu `prisma db push` lalu `next build`, jadi tabel Neon selalu selaras dengan skema repo.
3. **Environment Variables** (Project → Settings → Environment Variables, untuk Production + Preview):

   | Variabel | Nilai | Contoh |
   |---|---|---|
   | `DATABASE_URL` | connection string Neon (langkah 2) | `postgresql://user:pass@ep-xxx…neon.tech/rumahlayak?sslmode=require` |
   | `AUTH_SECRET` | string acak panjang — buat dengan `openssl rand -hex 32` | `9f1c…` (64 karakter hex) |

4. (Disarankan) Settings → Functions → **Region: Singapore (sin1)** — satu wilayah dengan Neon, respons lebih cepat.
5. Klik **Deploy**. Build pertama akan membuat semua tabel di Neon.
6. Buka `https://<project>.vercel.app` → wajib berhasil memuat halaman login.

> Skema `prisma/schema.prisma` di repo tetap SQLite untuk sandbox; versi PostgreSQL di-generate otomatis oleh `scripts/deploy/make-postgres-schema.mjs` — hanya 1 baris provider yang berbeda, semua model bebas fitur spesifik provider.

## 5. Uji pasca-deploy

| Uji | Cara | Hasil yang diharapkan |
|---|---|---|
| Health & DB | `curl https://<project>.vercel.app/api/health` | JSON ok + info database |
| Login 3 peran | `budi` / `fauzi` / `hendra` (sandi `demo123`) | masing-masing masuk dengan binding benar |
| Dashboard AUDITEE (fauzi) | buka papan rekap | hanya Kebun Mandor sesuai binding |
| Inspeksi AUDITOR (budi) | mulai pemeriksaan 27 item → tandai H/M → kirim | kode **PRM-W#-##** baru muncul |
| Temuan & tindak lanjut | buat temuan TND, submit TL auditee | status OPEN → SUBMITTED → VERIFIED |
| Foto | ambil foto di APK / unggah di web | tersimpan (dataUrl di tabel Foto) |
| Ekspor | Rekap → Unduh XLSX & JSON | file berisi data Neon terkini |
| Registrasi admin | hendra → daftarkan user baru (tanpa email, binding checkbox) | user PENDING → ACTIVE |

## 6. APK Android (Capacitor)

APK memakai model **WebView shell**: aplikasi Android memuat UI langsung dari server Vercel, sedangkan API & penyimpanan token sudah diarahkan perangkat (`src/lib/api.ts` — token di localStorage, menu **Set IP**). Artinya: **pembaruan aplikasi cukup deploy ulang ke Vercel — APK tidak perlu dibangun ulang.**

### 6.1 Prasyarat di laptop

| Alat | Versi | Catatan |
|---|---|---|
| Node.js | ≥ 20 | untuk npm/npx |
| JDK | **21** (Temurin/Adoptium) | wajib untuk Capacitor 8 / Gradle 8 |
| Android Studio | terbaru | memuat Android SDK; buka sekali → More Actions → SDK Manager (instal Android 15/API 35) |

Setelah instal, cek: `java -version` (harus 21) dan `node -v`.

### 6.2 Siapkan proyek di laptop

```bash
git clone https://github.com/afiashidqia89-ops/MyHome.git
cd MyHome
npm install
```

### 6.3 Arahkan APK ke domain Vercel (WAJIB sebelum build)

Buka `capacitor.config.ts` dan isi `server.url` dengan domain Vercel Anda:

```ts
url: "https://myhome-afiashidqia89-ops.vercel.app",  // contoh — sesuaikan
```

> Kerjakan ini **setelah** aplikasi live di Vercel (langkah 4) sehingga APK langsung terhubung.

### 6.4 Buat proyek Android (sekali saja)

```bash
npm run cap:add      # npx cap add android — membuat folder android/
```

Folder `android/` di-commit juga (konvensi Capacitor) agar tim lain bisa membangun ulang.

### 6.5 Bangun APK

```bash
npm run cap:sync     # salin webDir + plugin native ke proyek android

# Windows (PowerShell/CMD):
cd android && gradlew.bat assembleDebug

# macOS/Linux:
cd android && ./gradlew assembleDebug
```

Hasil: `android/app/build/outputs/apk/debug/app-debug.apk` — siap dipasang untuk uji internal.

### 6.6 APK rilis bertanda tangan (opsional — untuk distribusi luas)

```bash
keytool -genkeypair -v -keystore rumahlayak.keystore -alias rumahlayak -keyalg RSA -keysize 2048 -validity 10000
```

Lalu di `android/app/build.gradle` tambahkan `signingConfigs.release` (simpan sandi di `gradle.properties` lokal, JANGAN di-commit) dan jalankan `gradlew assembleRelease` → `app-release.apk`.

### 6.7 Pasang & uji di ponsel

1. Salin APK ke ponsel dan buka (izinkan "instal sumber tidak dikenal"), atau `adb install -r app-debug.apk`.
2. Aplikasi terbuka → langsung memuat domain Vercel.
3. Bila perlu ganti server: layar login → **ikon gerigi** kanan atas → **Set IP / Alamat server**.
4. **Download data master** untuk cache offline, lalu login `budi` / `fauzi` / `hendra` (sandi `demo123`).
5. Token JWT disimpan di perangkat (localStorage) — bila `AUTH_SECRET` diganti, pengguna harus login ulang.

### 6.8 Kapan APK perlu dibangun ulang?

| Perubahan | Rebuild APK? |
|---|---|
| Perbaikan bug / fitur baru di UI & API | Tidak — deploy ulang Vercel saja |
| Ganti alamat server bawaan | Ya — edit `capacitor.config.ts` → `npx cap sync android` → build |
| Ikon, nama, versi, permission (kamera/GPS) | Ya |
| Pindah dari debug ke release bertanda tangan | Ya |

### 6.9 Build APK otomatis via GitHub Actions (tanpa Android Studio)

Repo memuat workflow **`.github/workflows/build-apk.yml`**: GitHub membangun APK di server-nya (runner ubuntu-latest sudah memuat Android SDK) — laptop tidak perlu JDK/Android Studio. **Setiap ada update (push ke `main`), nomor versi APK naik otomatis.**

**Setup sekali:**
1. Upload workflow + `scripts/apk/apply-version.mjs` ke repo → **Settings → Secrets and variables → Actions → tab Variables → New repository variable**:
   - Name: `APP_SERVER_URL`
   - Value: `https://<domain-vercel-Anda>.vercel.app`
2. Tab **Actions** di repo → workflow **Build APK** → **Run workflow** (atau otomatis tiap push ke `main` yang menyentuh `src/`, `www/`, `capacitor.config.ts`, `package.json`).
3. Setelah run hijau (±4–6 menit) → unduh APK di bagian **Artifacts** (bawah halaman run, `RumahLayak-debug-apk`) atau di halaman **Releases** (file `RumahLayak-v<versi>-debug.apk` terlampir pada release terbaru).

**Cara versi naik otomatis** (logika di `scripts/apk/apply-version.mjs`):

| Komponen | Sumber | Contoh |
|---|---|---|
| `versionCode` | nomor build GitHub (`GITHUB_RUN_NUMBER`, +1 tiap workflow jalan) | `7` |
| `versionName` | mayor.minor dari `package.json` + nomor build | `0.2.7` |
| Nama file APK | dibuat dari versionName | `RumahLayak-v0.2.7-debug.apk` |
| Tag Release | dibuat otomatis per build | `v0.2.7` |

Karena `versionCode` selalu naik, Android menganggap APK terbaru sebagai **pembaruan** — bisa dipasang langsung di atas versi lama tanpa uninstall.

**Naik versi besar** (mis. 1.0 / 2.0): ubah field `"version"` di `package.json` (mis. `"1.0.0"`) lalu push — versionName build berikutnya otomatis menjadi `1.0.<nomor build>`.

> Bila variabel `APP_SERVER_URL` belum diisi, build tetap jalan tetapi APK memakai placeholder `server.url` (run ditandai warning). `capacitor.config.ts` membaca `process.env.CAP_SERVER_URL`, diisi workflow dari variabel repo.

Untuk APK **rilis bertanda tangan** di CI (opsional): simpan keystore base64 + sandi di repository *Secrets* (mis. `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`), tambahkan step dekode + `signingConfig` Gradle, lalu jalankan `assembleRelease`.

### 6.10 Mengganti nama aplikasi & ikon (192/512/APK)

**Nama aplikasi** — tampil di beberapa tempat, ubah sesuai kebutuhan:

| Nama yang tampil di mana | File yang diedit | Bagian |
|---|---|---|
| Di bawah ikon APK (launcher Android) | `capacitor.config.ts` | `appName: "RumahLayak"` |
| Nama file APK & judul Release GitHub | Variabel repo `APP_NAME` (opsional) | Settings → Variables; kosong = `RumahLayak` |
| Judul tab browser (web dashboard) | `src/app/layout.tsx` | `metadata.title` |
| Halaman jembatan saat APK menyala | `www/index.html` | `<title>` dan `<h1>` |
| Nama aplikasi PWA (web install) | `public/manifest.webmanifest` | `name` & `short_name` |

**Ikon aplikasi** — satu motif brand (rumah emas + pohon kanopi di atas hijau sawit) dipakai di semua tempat. Untuk mengganti, cukup tukar file berikut lalu push (build APK otomatis berjalan):

| Pakai di mana | File yang diganti | Ukuran |
|---|---|---|
| Ikon web/PWA 192×192 | `public/icon-192.png` | 192×192 px |
| Ikon web/PWA 512×512 | `public/icon-512.png` | 512×512 px |
| **Ikon launcher APK** (semua ukuran mipmap dibuat otomatis oleh `@capacitor/assets` saat build) | `assets/icon.png` | 1024×1024 px |
| **Splash screen APK** | `assets/splash.png` | 2732×2732 px |
| Logo vektor di halaman web | `public/logo.svg` | bebas (SVG) |

Catatan penting:
- Untuk `assets/icon.png`, jaga gambar utama di **tengah ±60% kanvas** — Android memotong ikon menjadi lingkaran/iskan adaptif, bagian pinggir bisa hilang.
- Folder `android/` tidak perlu disentuh: workflow `build-apk.yml` menjalankan `npx @capacitor/assets generate --android` setelah `cap add`, sehingga semua `mipmap-*/ic_launcher.png` dan splash dibuat ulang dari `assets/`.
- Ikon web (192/512) juga tercantum di `public/manifest.webmanifest` dan dirujuk `src/app/layout.tsx`; bila nama file diganti, sesuaikan keduanya.
- Generator ikon bawaan repo dapat dijalankan ulang: `python3 scripts/buat-ikon-brand.py`.

## 7. Catatan teknis

- **Foto**: disimpan sebagai `dataUrl` JPEG di tabel `Foto` (bukan file di disk) sehingga aman di serverless Vercel. Batas body request Vercel ≈ 4,5 MB — foto dari kamera sudah dikompresi di klien.
- **Cold start Neon**: database free plan otomatis suspend setelah ~5 menit idle; request pertama butuh ±0,5–1 s untuk resume (bukan error).
- **Rate limit login**: 8 percobaan / 5 menit per koneksi (in-memory per instance function).
- **Migrasi skema selanjutnya**: ubah `prisma/schema.prisma` → push → deploy; `prisma db push` pada build menjaga Neon selaras. Untuk riwayat migrasi formal, ganti ke `prisma migrate deploy` + folder `migrations/`.
- **Koneksi Neon habis kuota/terputus saat build**: ulangi deploy; pastikan memakai connection string langsung.

## 8. Variabel lingkungan (ringkasan)

| Variabel | Wajib? | Dipakai di | Fungsi |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Vercel (build & runtime), skrip porting | Koneksi PostgreSQL Neon |
| `AUTH_SECRET` | ✅ | Vercel runtime | Tanda tangan & verifikasi JWT HS256 (default dev hanya untuk sandbox!) |
| `NEXT_PUBLIC_*` | — | tidak ada | aplikasi memakai origin sendiri + Set IP perangkat, jadi tidak butuh env publik |

Contoh lengkap: [.env.example](./.env.example).
