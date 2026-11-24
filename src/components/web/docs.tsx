"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Database, FileJson, GitBranch, KeyRound, Layers, Rocket, Smartphone, TerminalSquare } from "lucide-react";

const TABS = [
  { id: "arsitektur", label: "Arsitektur" },
  { id: "skema", label: "Skema Database" },
  { id: "api", label: "REST API" },
  { id: "auth", label: "Auth & Binding" },
  { id: "deploy", label: "Deploy Produksi" },
] as const;

const API_LIST: { m: string; p: string; r: string; akses: string }[] = [
  { m: "GET", p: "/api/health", r: "Uji koneksi server & database", akses: "publik" },
  { m: "POST", p: "/api/auth/login", r: "Login bcrypt + sesi JWT (cookie httpOnly + token Bearer; rate-limit 8x/5 menit)", akses: "publik" },
  { m: "GET", p: "/api/auth/me", r: "Sesi aktif + daftar binding unit", akses: "login" },
  { m: "POST", p: "/api/auth/logout", r: "Akhiri sesi", akses: "login" },
  { m: "GET", p: "/api/master-data", r: "Checklist 27 item (4 kartu), perumahan, afdeling, kebun, matriks, user (cache offline APK)", akses: "login" },
  { m: "POST", p: "/api/master/{entity}", r: "Tambah estate / kebun / afdeling / perumahan (ID otomatis dari server)", akses: "ADMIN" },
  { m: "POST", p: "/api/master/import", r: "Unggah XLSX data master — kolom ESTATE, KEBUN, AFDELING, PERUMAHAN (upsert, duplikat dilewati)", akses: "ADMIN" },
  { m: "PATCH", p: "/api/master/{entity}/{id}", r: "Ubah data master: nama, induk, tipe, kapasitas, koordinat", akses: "ADMIN" },
  { m: "DELETE", p: "/api/master/{entity}/{id}", r: "Hapus data master — ditolak 409 bila masih dipakai entitas lain", akses: "ADMIN" },
  { m: "GET", p: "/api/inspeksi", r: "Daftar pemeriksaan + hasil + foto (scope kebun)", akses: "login" },
  { m: "POST", p: "/api/inspeksi", r: "Simpan pemeriksaan atomik: 27 item + foto tergeotag + temuan + audit trail", akses: "AUDITOR" },
  { m: "GET", p: "/api/temuan", r: "Daftar temuan + tindak lanjut (auditee: miliknya; auditor: kebunnya)", akses: "login" },
  { m: "PATCH", p: "/api/temuan/{id}", r: "Ubah status (auditee: tandai sedang dikerjakan)", akses: "AUDITEE PIC" },
  { m: "POST", p: "/api/temuan/{id}/tindak-lanjut", r: "Kirim bukti perbaikan + foto tergeotag", akses: "AUDITEE PIC" },
  { m: "POST", p: "/api/temuan/{id}/verifikasi", r: "Verifikasi penutupan (Langkah 4) — temuan CLOSED, kartu HIJAU", akses: "AUDITOR" },
  { m: "GET / POST", p: "/api/users", r: "Daftar & daftarkan user (binding multi unit via checkbox admin)", akses: "ADMIN" },
  { m: "PATCH", p: "/api/users/{id}", r: "Setujui / tolak / ubah user", akses: "ADMIN" },
  { m: "GET", p: "/api/aktivitas", r: "Audit trail 30 aktivitas terbaru", akses: "login" },
  { m: "GET", p: "/api/export/xlsx?kebunId=", r: "Buku kerja 4 sheet dibangun di server", akses: "AUDITOR/ADMIN" },
  { m: "GET", p: "/api/export/json", r: "Paket sync JSON (backup/integrasi)", akses: "login" },
];

const SKEMA_SQL = `-- Ringkasan tabel utama (Prisma schema penuh: prisma/schema.prisma)
User(id PK, username UQ, nama, passwordHash, role, jabatan,
     kebunId FK->Kebun,  afdelingId FK->Afdeling,  -- BINDING PENDAFTARAN
     status, createdAt, updatedAt)                        -- TANPA EMAIL: username otomatis
Estate(id PK, nama)  ─ Kebun(id PK, estateId FK, nama)
Afdeling(id PK, kebunId FK, nama, lat, lng)
Perumahan — tabel DB "Barak" (id PK, afdelingId FK, nama, tipe, kapasitas, lat, lng)
Kartu(id PK 'kartu 1..4', nama, singkat, warna)
ChecklistItem(id PK 'A1..D8', kartuId FK, nomor, label, standar)
MatriksApproval(id PK 1..4, jalur, sumberDana, kategori, pengaju,
     verifikator, final, sla)
Inspeksi(id PK, kode UQ, tanggal, minggu, periode, barakId FK,
     auditorId FK, picLabel, kesimpulan, status DRAFT|TERKIRIM, lat/lng = koordinat TAG auditor)
HasilItem(id PK, inspeksiId FK, itemId FK, status H|M|null, catatan,
     UQ(inspeksiId,itemId))
Foto(id PK, hasilId? FK, tindakId? FK, dataUrl, lat, lng, label)
Temuan(id PK, kode UQ 'TND-###', inspeksiId FK, barakId FK, afdelingId,
     itemId, uraian, level 1..4, mitigasiDarurat, noWO, targetSelesai,
     status OPEN|IN_PROGRESS|SUBMITTED|VERIFIED|CLOSED, auditeeId FK)
TindakLanjut(id PK, temuanId FK, uraian, olehId FK, status)
AksiLog(id PK, userId? FK, aktor, aksi, createdAt)`;

const SKEMA_DDL = `// prisma/schema.prisma — produksi Neon Postgres
generator client { provider = "prisma-client-js" }
datasource db {
  provider = "postgresql"   // ← dari "sqlite" (demo sandbox)
  url      = env("DATABASE_URL")
}
// Semua model portabel: tanpa fitur spesifik provider.
// Migrasi: bunx prisma db push  → skema identik di Neon.`;

const ENV_TXT = `# .env (Vercel Project Settings → Environment Variables)
DATABASE_URL="postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/rumahlayak?sslmode=require"
AUTH_SECRET="kunci-acak-min-32-karakter"   # openssl rand -hex 32`;

const DEPLOY_STEPS: { judul: string; isi: string }[] = [
  { judul: "1. GitHub", isi: "git init && git add -A && git commit -m \"RumahLayak v1 produksi\" && git push ke repo baru. Aktifkan branch protection untuk main (opsional CI lint)." },
  { judul: "2. Neon", isi: "Buat project Neon (free tier cukup). Salin connection string pooled (postgres://...neon.tech/rumahlayak?sslmode=require). Jalankan bunx prisma db push + bun run db:seed untuk master data awal." },
  { judul: "3. Vercel", isi: "Import repo GitHub di Vercel. Set Environment Variables: DATABASE_URL (Neon pooled) + AUTH_SECRET. Deploy — semua API route berjalan di Vercel Functions (runtime nodejs)." },
  { judul: "4. Capacitor (APK)", isi: "bunx cap add android; pointing ke https://<domain-vercel>. Preflight: konfigurasi CORS tetap same-origin (web) dan absolute URL API untuk APK. Build AAB via Android Studio." },
  { judul: "5. Ops", isi: "Audit trail AksiLog untuk forensik; backup Neon branch; monitor Vercel Logs; rotasi AUTH_SECRET per 90 hari; rate-limit login sudah aktif di API." },
];

export function WebDocs() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("arsitektur");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 rounded-xl border bg-white p-3 shadow-sm">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold", tab === t.id ? "bg-forest text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "arsitektur" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-800"><Layers className="h-4 w-4 text-forest" /> Arsitektur Produksi</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-5">
              {[
                { ik: <Smartphone className="h-5 w-5" />, judul: "APK Auditor/Auditee", isi: "Capacitor (Android) — UI identik dengan web, kamera + GPS native" },
                { ik: <GitBranch className="h-5 w-5" />, judul: "Next.js 16 (Vercel)", isi: "UI mobile & dashboard + REST API (route handlers, runtime nodejs)" },
                { ik: <KeyRound className="h-5 w-5" />, judul: "Auth bcrypt + JWT", isi: "Sesi hibrida: token Bearer + cookie httpOnly 7 hari, rate-limit, RBAC per peran & kebun" },
                { ik: <Database className="h-5 w-5" />, judul: "Neon PostgreSQL", isi: "Prisma ORM — transaksi atomik, indeks scope kebun, audit trail" },
                { ik: <Rocket className="h-5 w-5" />, judul: "Ops", isi: "GitHub CI, Vercel preview, backup Neon branch, ekspor XLSX/JSON" },
              ].map((s, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest text-white">{s.ik}</span>
                  <p className="mt-2 text-[12.5px] font-bold text-slate-800">{s.judul}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-500">{s.isi}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg bg-forest-soft p-3 font-mono text-[10.5px] leading-relaxed text-forest">
              APK (Capacitor) ──HTTPS──▶ Vercel: Next.js API (JWT verify, RBAC, zod-lite validation)
              ──Prisma──▶ Neon PostgreSQL ◀──Dashboard Web (React Query + fetch credentials)
            </div>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="text-[14px] font-bold text-slate-800">Model Sinkronisasi Offline (APK)</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[11.5px] leading-relaxed text-slate-600">
              <li><b>Web (sekarang):</b> setiap aksi POST langsung ke server — satu sumber kebenaran, transaksi atomik.</li>
              <li><b>APK:</b> transaksi masuk antrian lokal (SQLite/IndexedDB) status <i>draft → queued</i>; service worker mengirim saat online; server menjawab <i>synced</i> + kode resmi (PRM-W#-##, TND-###).</li>
              <li><b>Master data</b> di-cache per perangkat; refresh manual dari menu Data; hanya admin yang mengubahnya.</li>
              <li><b>Pra-login (gear kanan-atas layar login):</b> Set IP server kustom (uji koneksi langsung), Unduh Data Master publik ke cache offline, dan Periksa Update aplikasi via /api/app-version.</li>
              <li><b>Foto:</b> JPEG q0.72 + watermark GPS/waktu (Canvas), disimpan kolom dataUrl; produksi besar dapat dipindah ke Vercel Blob tanpa mengubah UI.</li>
              <li><b>Konflik:</b> server mengabaikan kode duplikat (deteksi + suffix detik); temuan tetap terkait inspeksi asal via FK.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === "skema" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-800"><Database className="h-4 w-4 text-forest" /> Skema Database (ringkas)</h3>
            <pre className="mt-3 max-h-72 overflow-auto thin-scroll rounded-lg bg-slate-900 p-3 font-mono text-[10.5px] leading-relaxed text-green-300">{SKEMA_SQL}</pre>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-800"><FileJson className="h-4 w-4 text-forest" /> Migrasi SQLite (demo) → Neon Postgres</h3>
            <pre className="mt-3 rounded-lg bg-slate-900 p-3 font-mono text-[10.5px] leading-relaxed text-amber-200">{SKEMA_DDL}</pre>
            <p className="mt-2 text-[11px] text-slate-500">Sandbox demo berjalan di SQLite agar pratinjau hidup tanpa cloud. Skema model bebas fitur provider — pindah Neon hanya mengubah baris provider + DATABASE_URL.</p>
          </div>
        </div>
      )}

      {tab === "api" && (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-800"><TerminalSquare className="h-4 w-4 text-forest" /> REST API Aktif ({API_LIST.length} endpoint)</h3>
          <p className="mt-1 text-[11px] text-slate-500">Semua endpoint menegakkan sesi JWT + binding unit (multi estate/kebun/afdeling/perumahan) di sisi server.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-forest text-white">
                  <th className="px-2.5 py-2 text-left">Metode</th>
                  <th className="px-2.5 py-2 text-left">Path</th>
                  <th className="px-2.5 py-2 text-left">Fungsi</th>
                  <th className="px-2.5 py-2 text-left">Akses</th>
                </tr>
              </thead>
              <tbody>
                {API_LIST.map((e, i) => (
                  <tr key={e.p + e.m} className={cn("border-t border-slate-100", i % 2 === 1 && "bg-slate-50/60")}>
                    <td className="px-2.5 py-2 font-mono font-bold text-forest">{e.m}</td>
                    <td className="px-2.5 py-2 font-mono text-slate-700">{e.p}</td>
                    <td className="px-2.5 py-2 text-slate-600">{e.r}</td>
                    <td className="px-2.5 py-2"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{e.akses}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "auth" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-800"><KeyRound className="h-4 w-4 text-forest" /> Alur Login & Binding Kebun</h3>
            <ol className="mt-3 space-y-2 text-[11.5px] leading-relaxed text-slate-600">
              <li><b>1.</b> Pengguna hanya memasukkan <b>nama pengguna + kata sandi</b> — tidak ada pemilihan kebun di layar login. Pendaftaran user dilakukan admin (tanpa email); username dibuat otomatis dari nama.</li>
              <li><b>2.</b> Server mencari user, memverifikasi hash <b>bcryptjs</b>, memeriksa status (PENDING ditolak dengan pesan jelas).</li>
              <li><b>3.</b> Sesi <b>JWT HS256</b> (jose) diterbitkan dua saluran: <b>token Bearer</b> disimpan klien (Andal di iframe preview &amp; WebView Capacitor) dan cookie <b>httpOnly, SameSite=Lax, 7 hari</b> sebagai cadangan tab langsung; server memeriksa header Authorization dulu, lalu cookie. Rate-limit 8 percobaan / 5 menit per nama pengguna.</li>
              <li><b>4.</b> Binding <b>User.kebunId</b> (ditetapkan saat pendaftaran oleh admin) menjadi filter wajib seluruh query: perumahan, afdeling, pemeriksaan, temuan, export.</li>
              <li><b>5.</b> ADMIN corporate tidak terikat kebun — dapat memilih kebun pada Rekap & Peta; perubahan tercatat di AksiLog.</li>
            </ol>
            <div className="mt-3 rounded-lg bg-gold-soft p-3 text-[11px] leading-relaxed text-gold-deep">
              Akun demo (database): budi (AUDITOR, Kebun Mandor) • fauzi (AUDITEE, Afdeling I) • hendra (ADMIN) — sandi <b>demo123</b>. User baru dibuat admin: username otomatis dari nama, sandi awal <b>rumahlayak123</b>.
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-800"><Layers className="h-4 w-4 text-forest" /> Menu & Hak Akses per Peran (RBAC UI)</h3>
            <p className="mt-1 text-[11px] text-slate-500">Menu navigasi dihasilkan sesuai peran login — bukan disembunyikan sekadar kosmetik: API server juga menegakkan scope yang sama. Tidak ada menu Beranda; setelah login pengguna langsung dibawa ke layar kerja utamanya.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-[11.5px]">
                <thead>
                  <tr className="bg-forest text-white">
                    <th className="px-2.5 py-2 text-left">Menu</th>
                    <th className="px-2.5 py-2 text-left">AUDITOR (EM) — memeriksa</th>
                    <th className="px-2.5 py-2 text-left">AUDITEE — menindaklanjuti</th>
                    <th className="px-2.5 py-2 text-left">ADMIN — memantau</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { m: "Layar awal setelah login", a: "Peta Blok (langsung siap memeriksa)", b: "Daftar Temuan (tugas saya)", c: "Daftar Temuan (semua kebun)" },
                    { m: "Menu Pemeriksaan (APK — 27 item)", a: "Ya — pintasan utama; draft berjalan otomatis dilanjutkan", b: "Tidak (peran auditor)", c: "Tidak (peran auditor)" },
                    { m: "Peta Blok (APK + web)", a: "Ya — pilih perumahan → mulai inspeksi", b: "Tidak (alat inspeksi auditor)", c: "Tidak (pemantauan via web)" },
                    { m: "Temuan & Tindak Lanjut", a: "Ya — seluruh temuan kebun + verifikasi", b: "Ya — hanya temuan yang ditugaskan kepadanya", c: "Ya — seluruh kebun" },
                    { m: "Riwayat Pemeriksaan", a: "Ya", b: "Ya (kebunnya)", c: "Ya (semua kebun)" },
                    { m: "Data & Sinkronisasi + Ekspor", a: "Ya (XLSX/JSON)", b: "Tidak", c: "Ya" },
                    { m: "Panduan Jalur & Matriks", a: "Ya — Guideline Auditor (3 tab)", b: "Ya — Panduan Tindak Lanjut (2 tab)", c: "Ya — Guideline (3 tab)" },
                    { m: "Dashboard Web", a: "Rekap kinerja kelayakan", b: "Fokus tugas tindak lanjut saya", c: "Rekap kinerja kelayakan" },
                    { m: "Rekap Report / Peta Lokasi (web)", a: "Ya", b: "Rekap saja — tanpa Peta Lokasi", c: "Ya" },
                    { m: "Data Master & Pendaftaran User", a: "Tidak", b: "Tidak", c: "Ya (hanya ADMIN)" },
                  ].map((r, i) => (
                    <tr key={r.m} className={cn("border-t border-slate-100", i % 2 === 1 && "bg-slate-50/60")}>
                      <td className="px-2.5 py-2 font-semibold text-slate-700">{r.m}</td>
                      <td className="px-2.5 py-2 text-slate-600">{r.a}</td>
                      <td className="px-2.5 py-2 text-slate-600">{r.b}</td>
                      <td className="px-2.5 py-2 text-slate-600">{r.c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "deploy" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-800"><Rocket className="h-4 w-4 text-forest" /> GitHub → Neon → Vercel → Capacitor</h3>
            <div className="mt-3 space-y-2">
              {DEPLOY_STEPS.map((s) => (
                <div key={s.judul} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[12.5px] font-bold text-forest">{s.judul}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{s.isi}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="text-[14px] font-bold text-slate-800">Environment Variables</h3>
            <pre className="mt-2 rounded-lg bg-slate-900 p-3 font-mono text-[10.5px] leading-relaxed text-green-300">{ENV_TXT}</pre>
            <p className="mt-2 text-[11px] text-slate-500">Perintah lokal: <code className="rounded bg-slate-100 px-1">bun run db:push</code> → <code className="rounded bg-slate-100 px-1">bun run db:seed</code> → <code className="rounded bg-slate-100 px-1">bun run lint</code> → deploy.</p>
          </div>
        </div>
      )}
    </div>
  );
}
