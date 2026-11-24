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

APK tidak perlu dibangun ulang untuk ganti server:

1. Buka APK → layar login → **ikon gerigi** kanan atas → **Set IP / Alamat server**.
2. Masukkan domain Vercel, contoh `https://rumahlayak.vercel.app` (boleh tanpa `https://`).
3. **Download data master** untuk cache offline, lalu login.
4. Token JWT disimpan di perangkat (localStorage) — bila `AUTH_SECRET` diganti, pengguna harus login ulang.

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
