# RumahLayak

Sistem pemeriksaan kelayakan perumahan & fasilitas karyawan (Kamishibai Digital) untuk emplasemen perkebunan sawit. Pemeriksaan mingguan 27 item dalam 4 kartu, temuan berlevel dengan matriks approval, tindak lanjut berfoto ber-GPS, rekap papan kanban, dan ekspor XLSX/JSON.

- **Web (portal)**: dashboard, rekap, temuan, dokumentasi teknis — untuk ADMIN/AUDITOR/AUDITEE.
- **APK (Android/Capacitor)**: pemeriksaan lapangan, kamera + watermark GPS, mode offline dengan sinkronisasi.

## Stack

| Bagian | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 |
| Database | PostgreSQL (Neon) via Prisma — sandbox demo: SQLite (`db/custom.db`) |
| Autentikasi | bcryptjs + JWT HS256 (`jose`) — cookie httpOnly & `Authorization: Bearer` |
| Peta | Leaflet + OpenStreetMap |
| Mobile | Capacitor 8 (APK Android) — WebView shell ke server Vercel; konfigurasi server lewat "Set IP" di layar login; **build otomatis via GitHub Actions, versi APK naik tiap build** — panduan: DEPLOY.md §6.9 |
| Branding | Nama & ikon aplikasi (ikon 192/512 web, launcher APK, splash) tinggal tukar file: `public/icon-192.png`, `public/icon-512.png`, `assets/icon.png`, `assets/splash.png` — panduan: DEPLOY.md §6.10 |
| Ekspor | XLSX & JSON server-side (`/api/export/*`) |

## Mulai cepat (sandbox/demo)

```bash
bun install
bun run db:push     # buat tabel SQLite demo
bun run db:seed     # master data + data demo November 2026
bun run dev         # http://localhost:3000
```

Akun demo (sandi `demo123`): `budi` (AUDITOR), `fauzi` (AUDITEE), `hendra` (ADMIN).

## Struktur penting

```
prisma/schema.prisma            # skema database (SQLite demo; PostgreSQL di-generate otomatis)
prisma/seed.ts                  # seed data demo (kartu, 27 item, matriks, pengguna, inspeksi)
src/lib/data.ts                 # sumber data master demo + tipe
src/lib/auth.ts                 # JWT, bcrypt, RBAC, rate-limit login
src/lib/scope.ts                # resolusi binding pengguna → scope data
src/app/api/…                   # REST API (auth, inspeksi, temuan, master, export, health)
src/components/web|mobile       # UI portal web & layar APK
capacitor.config.ts             # konfigurasi APK (isi server.url = domain Vercel)
www/                            # shell web statis APK (jembatan ke server)
.github/workflows/build-apk.yml  # build APK otomatis di Actions (versi naik tiap build)
scripts/deploy/                 # penerapan: Neon, porting data, generator skema Postgres
vercel.json                     # buildCommand Vercel (schema Postgres + prisma db push otomatis)
```

## Deployment

Panduan lengkap **GitHub + Neon + Vercel** (termasuk porting data dan konfigurasi APK): lihat **[DEPLOY.md](./DEPLOY.md)**.

Ringkas:

```bash
# 1. Push repo ke GitHub
git remote add origin https://github.com/<akun>/rumahlayak.git
git push -u origin main

# 2. Isi Neon dengan data (porting persis demo, atau seed segar)
scripts/deploy/neon-sync.sh "postgresql://…neon.tech/rumahlayak?sslmode=require" --port

# 3. Import repo di Vercel, set env DATABASE_URL + AUTH_SECRET → Deploy

# 4. APK otomatis: tiap push ke main, GitHub Actions membangun APK dengan
#    versi naik sendiri — unduh di tab Actions → Artifacts atau halaman Releases
#    (atur variabel repo APP_SERVER_URL dulu — lihat DEPLOY.md §6.9)
```

Variabel lingkungan produksi: `DATABASE_URL` (Neon PostgreSQL) dan `AUTH_SECRET` (JWT) — contoh di [.env.example](./.env.example).
