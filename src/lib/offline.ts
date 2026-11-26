"use client";
// ============================================================
// RumahLayak — Lapisan OFFLINE-FIRST (inti sinkronisasi)
//
// Prinsip kerja (sama seperti aplikasi Cek Blok):
//   1. APK membawa aplikasi + data terakhir di dalam perangkat,
//      jadi selalu bisa dibuka & dipakai TANPA internet.
//   2. Setiap data yang berhasil diambil dari server disimpan
//      sebagai "snapshot" perangkat (localStorage) — dipakai
//      otomatis saat sinyal hilang.
//   3. Setiap data yang DISIMPAN saat offline (pemeriksaan,
//      temuan, tindak lanjut, verifikasi) masuk ANTREAN KIRIM.
//   4. Saat online (login / tombol Sinkron / buka aplikasi),
//      antrean dikirim berurutan ke server, lalu data terbaru
//      ditarik untuk menggantikan snapshot.
// ============================================================

import { apiUrl, getToken } from "./server";

// ---------------- ANTREAN KIRIM (OUTBOX) ----------------

const KEY_OUTBOX = "rl_outbox";

export interface OpAntrean {
  id: string;
  metode: "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  label: string; // deskripsi manusiawi untuk daftar antrean
  dibuat: string; // ISO
}

/** Endpoint yang AMAN diantrekan offline (idempotent / ber-ID client). */
export function bisaAntre(metode: string, path: string): boolean {
  if (metode === "POST" && /^\/api\/inspeksi\/?$/.test(path)) return true;
  if (metode === "DELETE" && /^\/api\/inspeksi\/[^/]+$/.test(path)) return true;
  if (metode === "PATCH" && /^\/api\/temuan\/[^/]+$/.test(path)) return true;
  if (metode === "POST" && /^\/api\/temuan\/[^/]+\/(tindak-lanjut|verifikasi)$/.test(path)) return true;
  return false;
}

export function bacaAntrean(): OpAntrean[] {
  try {
    const raw = window.localStorage.getItem(KEY_OUTBOX);
    const arr = raw ? (JSON.parse(raw) as OpAntrean[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function simpanAntrean(list: OpAntrean[]) {
  try {
    window.localStorage.setItem(KEY_OUTBOX, JSON.stringify(list));
  } catch {
    /* kuota penuh — antrean lama dipertahankan */
  }
}

export function tambahAntrean(op: Omit<OpAntrean, "id" | "dibuat">) {
  const list = bacaAntrean();
  list.push({ ...op, id: idBaru(), dibuat: new Date().toISOString() });
  simpanAntrean(list);
}

export function hitungAntrean(): number {
  return bacaAntrean().length;
}

export function labelAntrean(): string {
  const n = hitungAntrean();
  if (!n) return "Tidak ada data yang menunggu dikirim";
  return `${n} data menunggu dikirim saat online`;
}

/** ID unik perangkat (UUID v4) — dipakai ID pemeriksaan buatan offline. */
export function idBaru(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* webview lama — fallback di bawah */
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------- SNAPSHOT DATA (cache baca offline) ----------------

const PREFIK_SNAP = "rl_snap_";

export type NamaSnap = "session" | "master" | "inspeksi" | "temuan" | "users" | "aktivitas";

/** Buang isi foto (dataUrl besar) agar snapshot muat di kuota localStorage. */
function potongFoto(data: unknown): unknown {
  if (typeof data === "string") return data.length > 120_000 ? "" : data;
  if (Array.isArray(data)) return data.map(potongFoto);
  if (data && typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) out[k] = potongFoto(v);
    return out;
  }
  return data;
}

export function simpanSnapshot(nama: NamaSnap, data: unknown) {
  if (typeof window === "undefined") return;
  const tulis = (d: unknown) => window.localStorage.setItem(PREFIK_SNAP + nama, JSON.stringify(d));
  try {
    tulis(data);
  } catch {
    // Kuota penuh → coba lagi tanpa foto (peta/list tetap tampil, foto kosong)
    try {
      tulis(potongFoto(data));
    } catch {
      /* kuota tetap penuh — snapshot lama dipertahankan */
    }
  }
}

export function bacaSnapshot<T>(nama: NamaSnap): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIK_SNAP + nama);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function hapusSnapshot(nama: NamaSnap) {
  try {
    window.localStorage.removeItem(PREFIK_SNAP + nama);
  } catch {
    /* abaikan */
  }
}

// ---------------- AKUN CACHE (login offline) ----------------

const KEY_AKUN = "rl_akun";

export interface AkunCache {
  username: string;
  hashPw: string; // SHA-256(password) — hanya untuk cocokkan login offline lokal
  user: import("./types").SessionUser;
  waktu: string;
}

async function sha256Hex(teks: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(teks));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Simpan akun terakhir yang BERHASIL login online (untuk login offline). */
export async function simpanAkun(user: import("./types").SessionUser, password: string) {
  try {
    const hashPw = await sha256Hex(password);
    const akun: AkunCache = { username: user.username, hashPw, user, waktu: new Date().toISOString() };
    window.localStorage.setItem(KEY_AKUN, JSON.stringify(akun));
  } catch {
    /* crypto tidak tersedia — login offline tidak aktif, login online tetap normal */
  }
}

export function hapusAkun() {
  try {
    window.localStorage.removeItem(KEY_AKUN);
  } catch {
    /* abaikan */
  }
}

/** Cocokkan username+sandi terhadap akun cache perangkat. Return user atau null. */
export async function verifikasiAkunOffline(username: string, password: string): Promise<import("./types").SessionUser | null> {
  try {
    const raw = window.localStorage.getItem(KEY_AKUN);
    if (!raw) return null;
    const akun = JSON.parse(raw) as AkunCache;
    if (akun.username !== username.trim().toLowerCase()) return null;
    const hash = await sha256Hex(password);
    if (hash !== akun.hashPw) return null;
    return akun.user;
  } catch {
    return null;
  }
}

/** Sesi fallback saat /api/auth/me tidak terjangkau: hanya jika ada token di perangkat. */
export function sesiFallback(): { authenticated: true; user: import("./types").SessionUser } | null {
  if (!getToken()) return null;
  const snap = bacaSnapshot<{ authenticated: true; user: import("./types").SessionUser }>("session");
  return snap && snap.user ? snap : null;
}

// ---------------- SINKRONISASI ----------------

const KEY_SINKRON = "rl_sinkron_terakhir";

export interface HasilSinkron {
  waktu: string;
  kirim: number; // berhasil dikirim
  gagal: number; // ditolak server (tidak diulang)
  sisa: number; // masih mengantre (jaringan putus di tengah jalan)
  catatan: string[];
}

export function bacaSinkronTerakhir(): HasilSinkron | null {
  try {
    const raw = window.localStorage.getItem(KEY_SINKRON);
    return raw ? (JSON.parse(raw) as HasilSinkron) : null;
  } catch {
    return null;
  }
}

function catatSinkron(h: HasilSinkron) {
  try {
    window.localStorage.setItem(KEY_SINKRON, JSON.stringify(h));
  } catch {
    /* abaikan */
  }
}

interface KlienQuery {
  invalidateQueries: (o: { queryKey: readonly unknown[] }) => Promise<void>;
}

/** Kirim seluruh antrean ke server, berurutan. Aman dipanggil berkali-kali. */
export async function sinkronAntrean(): Promise<HasilSinkron> {
  const hasil: HasilSinkron = { waktu: new Date().toISOString(), kirim: 0, gagal: 0, sisa: 0, catatan: [] };
  const token = getToken();
  if (!token) {
    hasil.catatan.push("Belum login — data antrean dikirim setelah login.");
    catatSinkron(hasil);
    return hasil;
  }
  const antreanAwal = bacaAntrean();
  const awalIds = new Set(antreanAwal.map((o) => o.id));
  const masih: OpAntrean[] = [];

  for (const op of antreanAwal) {
    let res: Response;
    try {
      res = await fetch(apiUrl(op.path), {
        method: op.metode,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: op.body === undefined ? undefined : JSON.stringify(op.body),
        cache: "no-store",
      });
    } catch {
      masih.push(op); // jaringan putus — sisanya menunggu
      break;
    }
    if (res.ok) {
      hasil.kirim++;
      continue;
    }
    if (res.status === 401) {
      masih.push(op);
      hasil.catatan.push("Sesi berakhir — login ulang untuk melanjutkan pengiriman.");
      break;
    }
    if (res.status >= 500) {
      // 5xx = KESALAHAN SERVER (sementara) — JANGAN buang data:
      // tetap di antrean dan dicoba lagi saat Sinkron berikutnya.
      masih.push(op);
      hasil.catatan.push(`${op.label}: server sedang bermasalah (${res.status}) — data tetap AMAN di perangkat, coba sinkron lagi nanti.`);
      break; // server bermasalah — op berikutnya kemungkinan juga gagal, hentikan loop
    }
    // 4xx lain: server menolak PERMANEN (validasi/konflik) — tidak diulang
    // agar antrean tidak macet; datanya masih ada di balasan server bila
    // bentrok (idempotent POST inspeksi menahan duplikasi).
    hasil.gagal++;
    const pesan = await res.json().catch(() => ({}) as { error?: string });
    hasil.catatan.push(`${op.label}: ${pesan.error ?? `ditolak server (${res.status})`}`);
  }

  // Pertahankan: op yang masih mengantre (jaringan putus) + op BARU yang muncul selama proses
  const antreanKini = bacaAntrean();
  const masihIds = new Set(masih.map((o) => o.id));
  simpanAntrean(antreanKini.filter((op) => masihIds.has(op.id) || !awalIds.has(op.id)));
  hasil.sisa = hitungAntrean();
  // Penyegaran data dilakukan pemanggil (autoSinkron) lewat invalidateQueries
  // → React Query menarik data terbaru dari server.
  catatSinkron(hasil);
  return hasil;
}

/** Sinkron senyap + segarkan data — dipanggil setelah login / buka aplikasi. */
export async function autoSinkron(qc: KlienQuery): Promise<HasilSinkron | null> {
  if (!hitungAntrean()) return null;
  const hasil = await sinkronAntrean();
  if (hasil.kirim > 0) {
    await qc.invalidateQueries({ queryKey: ["inspeksi"] });
    await qc.invalidateQueries({ queryKey: ["temuan"] });
    await qc.invalidateQueries({ queryKey: ["aktivitas"] });
    await qc.invalidateQueries({ queryKey: ["users"] });
    await qc.invalidateQueries({ queryKey: ["master"] });
  }
  return hasil;
}
