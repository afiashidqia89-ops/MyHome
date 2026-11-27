// ============================================================
// RumahLayak — Koordinat OPSIONAL data master
// Estate, Kebun, Afdeling & Perumahan memakai aturan yang sama:
//   • lat & lng keduanya kosong  → disimpan NULL (tidak ada koordinat bawaan)
//   • lat & lng keduanya terisi  → harus angka dalam rentang valid
//   • hanya salah satu terisi    → ditolak (koordinat setengah jadi)
// Catatan: Number("") == 0, jadi nilai kosong WAJIB dicek lebih dulu agar
// tidak tersimpan sebagai titik 0,0.
// ============================================================

export type Koordinat = { lat: number; lng: number } | null;

export type HasilKoordinat =
  | { ok: true; lat: number | null; lng: number | null }
  | { ok: false; error: string };

function kosong(v: unknown): boolean {
  return v === undefined || v === null || String(v).trim() === "";
}

function keAngka(v: unknown): number | null {
  const n = Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function bacaKoordinat(lat: unknown, lng: unknown): HasilKoordinat {
  const latKosong = kosong(lat);
  const lngKosong = kosong(lng);
  if (latKosong && lngKosong) return { ok: true, lat: null, lng: null };
  if (latKosong !== lngKosong) {
    return { ok: false, error: "Latitude dan longitude harus diisi keduanya, atau dikosongkan keduanya" };
  }
  const la = keAngka(lat);
  const lo = keAngka(lng);
  if (la === null || lo === null) return { ok: false, error: "Latitude dan longitude harus berupa angka" };
  if (la < -90 || la > 90) return { ok: false, error: "Latitude harus di antara -90 dan 90" };
  if (lo < -180 || lo > 180) return { ok: false, error: "Longitude harus di antara -180 dan 180" };
  return { ok: true, lat: la, lng: lo };
}

/** Bentuk keluaran API: objek {lat,lng} bila lengkap, selain itu null. */
export function koordinatKeluar(lat: number | null | undefined, lng: number | null | undefined): Koordinat {
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
}
