// ============================================================
// RumahLayak — Cache data master offline per perangkat (localStorage)
// Diunduh pra-login dari tombol gear (endpoint publik) atau otomatis
// saat master data berhasil diambil setelah login.
// ============================================================

import type { MasterData } from "./types";

const KEY = "rl_master_cache";

export interface MasterCache {
  diunduh: string; // ISO waktu unduh terakhir
  sumber: string; // alamat server sumber
  data: Omit<MasterData, "users"> & { users?: MasterData["users"] };
}

export function bacaMasterCache(): MasterCache | null {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MasterCache;
    return parsed && parsed.data && Array.isArray(parsed.data.baraks) ? parsed : null;
  } catch {
    return null;
  }
}

/** Simpan cache; kembalikan ukuran JSON dalam byte (0 = gagal, mis. kuota penuh). */
export function simpanMasterCache(
  data: MasterData | (Omit<MasterData, "users"> & { users?: MasterData["users"] }),
  sumber = "(server bawaan)",
): number {
  const payload: MasterCache = { diunduh: new Date().toISOString(), sumber, data };
  try {
    const json = JSON.stringify(payload);
    window.localStorage.setItem(KEY, json);
    return json.length;
  } catch {
    return 0;
  }
}

export function hapusMasterCache() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* abaikan */
  }
}

/** Cache pra-login tidak memuat daftar users (privasi) — lengkapi agar cocok tipe MasterData. */
export function cacheKeMasterData(c: MasterCache): MasterData {
  return { ...(c.data as MasterData), users: c.data.users ?? [] };
}
