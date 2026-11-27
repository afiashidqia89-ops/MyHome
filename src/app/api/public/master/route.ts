import { db } from "@/lib/db";
import { koordinatKeluar } from "@/lib/koordinat";

export const runtime = "nodejs";

/**
 * Master data PUBLIK (pra-login) untuk cache offline APK.
 * Diunduh dari tombol gear di layar login ("Unduh Data Master").
 * Sengaja TANPA daftar pengguna — data personal hanya lewat endpoint
 * terautentikasi /api/master-data sesuai binding kebun masing-masing.
 */
export async function GET() {
  const [estates, kebuns, afdelings, baraks, kartu, checklist, matriks] = await Promise.all([
    db.estate.findMany({ orderBy: { nama: "asc" } }),
    db.kebun.findMany({ orderBy: { nama: "asc" } }),
    db.afdeling.findMany({ orderBy: { nama: "asc" } }),
    db.barak.findMany({ orderBy: { nama: "asc" } }),
    db.kartu.findMany({ orderBy: { id: "asc" } }),
    db.checklistItem.findMany({ orderBy: { id: "asc" } }),
    db.matriksApproval.findMany({ orderBy: { id: "asc" } }),
  ]);

  return Response.json({
    scopeKebunId: null,
    periodeAktif: `${["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][new Date().getMonth()]} ${new Date().getFullYear()}`,
    estates: estates.map((e) => ({ id: e.id, nama: e.nama, koordinat: koordinatKeluar(e.lat, e.lng) })),
    kebuns: kebuns.map((k) => ({ id: k.id, estateId: k.estateId, nama: k.nama, koordinat: koordinatKeluar(k.lat, k.lng) })),
    afdelings: afdelings.map((a) => ({ id: a.id, kebunId: a.kebunId, nama: a.nama, koordinat: koordinatKeluar(a.lat, a.lng) })),
    baraks: baraks.map((b) => ({ id: b.id, afdelingId: b.afdelingId, nama: b.nama, tipe: b.tipe, kapasitas: b.kapasitas, koordinat: koordinatKeluar(b.lat, b.lng) })),
    kartu: kartu.map((k) => ({ id: k.id, nama: k.nama, singkat: k.singkat, warna: k.warna })),
    checklist: checklist.map((c) => ({ id: c.id, kartu: c.kartuId, nomor: c.nomor, label: c.label, standar: c.standar })),
    matriks: matriks.map((m) => ({
      level: m.id as 1 | 2 | 3 | 4, jalur: m.jalur, sumberDana: m.sumberDana, kategori: m.kategori,
      pengaju: m.pengaju, verifikator: m.verifikator, final: m.final, sla: m.sla,
    })),
  });
}
