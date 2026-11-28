// ============================================================
// RumahLayak — Klien REST offline-first (token Bearer + antrean)
//
// Perilaku:
//   • GET  : sukses → simpan snapshot perangkat; gagal jaringan →
//            pelempar error status 0 (query layer memakai snapshot).
//   • POST/PATCH/DELETE : gagal jaringan pada endpoint yang aman →
//            masuk ANTREAN OFFLINE + respons sintetis "offline",
//            sehingga UI tetap jalan tanpa internet.
//   • Endpoint di luar daftar aman → error ramah "butuh koneksi".
// ============================================================

import {
  bisaAntre,
  idBaru,
  tambahAntrean,
  simpanSnapshot,
} from "./offline";

// Re-ekspor helper server agar impor lama dari "@/lib/api" tetap jalan
export {
  getToken,
  setToken,
  clearToken,
  getServerUrl,
  setServerUrl,
  normalisasiServerUrl,
  apiUrl,
  serverTerpasang,
  alamatAktif,
} from "./server";

import { apiUrl as urlApi, getToken, serverTerpasang } from "./server";

export class ApiError extends Error {
  status: number; // 0 = jaringan offline / server tak terjangkau
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const EROR_JARINGAN = "Tidak dapat menghubungi server — periksa koneksi internet / alamat IP (Set IP).";
export const EROR_SERVER_BELUM_DIATUR =
  "Alamat server belum diatur — buka Pengaturan (ikon gerigi) di layar awal, isi kolom SET IP dengan alamat server perusahaan.";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function proses<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ApiError(res.status, `Respons server tidak valid (${res.status})`);
    }
  }
  if (!res.ok) {
    if (res.status === 401) clearTokenLokal(); // sesi kedaluwarsa — bersihkan token lokal
    throw new ApiError(res.status, (body.error as string) ?? `Kesalahan server (${res.status})`);
  }
  return body as T;
}

function clearTokenLokal() {
  try {
    window.localStorage.removeItem("rl_token");
  } catch {
    /* abaikan */
  }
}

/** Label manusiawi untuk entri antrean. */
function labelOp(metode: string, path: string, body?: unknown): string {
  if (metode === "POST" && /\/api\/inspeksi/.test(path)) return "Pemeriksaan baru";
  if (metode === "DELETE" && /\/api\/inspeksi\//.test(path)) return "Hapus pemeriksaan";
  if (metode === "PATCH" && /\/api\/temuan\//.test(path)) return "Perubahan status temuan";
  if (/tindak-lanjut/.test(path)) return "Tindak lanjut temuan";
  if (/verifikasi/.test(path)) return "Verifikasi temuan";
  return `${metode} ${path}`;
}

/** Respons sintetis agar UI offline tetap berjalan seolah sukses. */
function balasanOffline<T>(metode: string, path: string, body?: unknown): T {
  if (metode === "POST" && /\/api\/inspeksi/.test(path)) {
    const b = (body ?? {}) as {
      results?: { status?: string }[];
      temuan?: unknown[];
    };
    const kode = `OFFLINE-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${idBaru().slice(0, 4).toUpperCase()}`;
    const hasil = {
      offline: true,
      temuanDibuat: Array.isArray(b.temuan) ? b.temuan.length : 0,
      inspeksi: {
        id: idBaru(),
        kode,
        tanggal: new Date().toISOString().slice(0, 10),
        sync: "queued" as const,
        results: b.results ?? [],
      },
    };
    // Masukkan langsung ke snapshot daftar agar terlihat di Riwayat/Rekap offline
    const snap = simpanSnapshotHelper<{ inspeksi: Record<string, unknown>[] }>("inspeksi");
    if (snap && Array.isArray(snap.inspeksi)) {
      snap.inspeksi = [hasil.inspeksi, ...snap.inspeksi];
      simpanSnapshot("inspeksi", snap);
    }
    return hasil as T;
  }
  return { offline: true } as T;
}

function simpanSnapshotHelper<T>(nama: Parameters<typeof simpanSnapshot>[0]): T | null {
  try {
    const raw = window.localStorage.getItem(`rl_snap_${nama}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function request<T>(metode: string, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  if (!serverTerpasang()) throw new ApiError(0, EROR_SERVER_BELUM_DIATUR);

  // ---- OFFLINE-FIRST: SIMPAN PEMERIKSAAN SELALU LOKAL DULU ----
  // Simpan transaksi pemeriksaan TIDAK langsung dikirim ke server: data masuk
  // antrean perangkat (rl_outbox) lalu terkirim lewat tombol "Sinkron Sekarang"
  // di menu Profil (atau otomatis saat login/buka aplikasi). Ini menghilangkan
  // error "kesalahan server (500)" saat menyimpan dan membuat simpan selalu
  // instan walau sinyal lemah. Endpoint aman-antre lain (hapus inspeksi,
  // tindak lanjut, verifikasi) saat OFFLINE tetap lewat jalur di bawah.
  if (metode === "POST" && bisaAntre(metode, path)) {
    const badan = { ...(body as Record<string, unknown>), id: idBaru() }; // ID client → kirim ulang aman (idempotent)
    if (!tambahAntrean({ metode: "POST", path, body: badan, label: labelOp(metode, path, badan) })) {
      throw new ApiError(0, "Penyimpanan perangkat penuh — data BELUM tersimpan. Sinkronkan data yang menunggu (menu Data) atau hapus foto lama, lalu simpan ulang.");
    }
    return balasanOffline<T>(metode, path, badan);
  }

  const batasWaktu = metode === "GET" ? 15_000 : 60_000; // POST foto besar butuh waktu
  const kontrol = new AbortController();
  const timer = setTimeout(() => kontrol.abort(), batasWaktu);

  let res: Response;
  try {
    res = await fetch(urlApi(path), {
      ...init,
      method: metode,
      signal: kontrol.signal,
      // Cookie hanya dipakai portal web satu origin; lintas origin (Set IP) pakai Bearer.
      credentials: urlApi(path).startsWith("http") ? "omit" : "include",
      headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers ?? {}) },
      // WAJIB: kirim isi pesan (POST/PATCH) sebagai JSON — tanpa baris ini
      // server menerima body kosong → "Format permintaan tidak valid".
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    clearTimeout(timer);
    // ---- JARINGAN GAGAL ----
    if (metode !== "GET" && bisaAntre(metode, path)) {
      const badan = metode === "POST" && /\/api\/inspeksi/.test(path)
        ? { ...(body as Record<string, unknown>), id: idBaru() } // ID client → kirim ulang aman (idempotent)
        : body;
      if (!tambahAntrean({ metode: metode as "POST" | "PATCH" | "DELETE", path, body: badan, label: labelOp(metode, path, body) })) {
        throw new ApiError(0, "Penyimpanan perangkat penuh — perubahan BELUM tersimpan. Sinkronkan dulu lalu ulangi.");
      }
      return balasanOffline<T>(metode, path, badan);
    }
    if (metode !== "GET") throw new ApiError(0, `Butuh koneksi server untuk perintah ini. ${EROR_JARINGAN}`);
    throw new ApiError(0, EROR_JARINGAN);
  }
  clearTimeout(timer);
  return proses<T>(res);
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, payload?: unknown) => request<T>("POST", path, payload),
  patch: <T>(path: string, payload?: unknown) => request<T>("PATCH", path, payload),
  del: <T>(path: string) => request<T>("DELETE", path),
  /** POST multipart/form-data (unggah file) — hanya saat online. */
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    if (!serverTerpasang()) throw new ApiError(0, EROR_SERVER_BELUM_DIATUR);
    let res: Response;
    try {
      res = await fetch(urlApi(path), {
        method: "POST",
        credentials: urlApi(path).startsWith("http") ? "omit" : "include",
        headers: authHeaders(),
        body: formData,
        cache: "no-store",
      });
    } catch {
      throw new ApiError(0, `Unggah file butuh koneksi server. ${EROR_JARINGAN}`);
    }
    return proses<T>(res);
  },
};

/** Unduh file dari endpoint export via blob (tetap terautentikasi dengan token). */
export async function unduhExport(path: string, namaFile: string) {
  if (!serverTerpasang()) throw new ApiError(0, EROR_SERVER_BELUM_DIATUR);
  const res = await fetch(urlApi(path), {
    credentials: urlApi(path).startsWith("http") ? "omit" : "include",
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Gagal mengunduh (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
