import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { muatScope } from "@/lib/scope";
import { koordinatKeluar } from "@/lib/koordinat";

export const runtime = "nodejs";

/**
 * Master data untuk cache offline APK + portal web.
 * HANYA data yang terkait dengan binding pengguna yang dikirim:
 * user bisa terikat pada lebih dari satu estate/kebun/afdeling/perumahan
 * (checkbox pendaftaran admin). ADMIN tanpa binding menerima seluruh data.
 */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return unauthorized();

  const scope = await muatScope(me);

  const [estates, kebunsRaw, afdelingsRaw, baraksRaw, kartu, checklist, matriks, usersRaw] = await Promise.all([
    db.estate.findMany({ orderBy: { nama: "asc" }, where: scope.semua ? undefined : { id: { in: [...scope.estateIds] } } }),
    db.kebun.findMany({ orderBy: { nama: "asc" }, where: scope.semua ? undefined : { id: { in: [...scope.kebunIds] } } }),
    db.afdeling.findMany({ orderBy: { nama: "asc" }, where: scope.semua ? undefined : { id: { in: [...scope.afdelingIds] } } }),
    db.barak.findMany({ orderBy: { nama: "asc" }, where: scope.semua ? undefined : { id: { in: [...scope.barakIds] } } }),
    db.kartu.findMany({ orderBy: { id: "asc" } }),
    db.checklistItem.findMany({ orderBy: { id: "asc" } }),
    db.matriksApproval.findMany({ orderBy: { id: "asc" } }),
    db.user.findMany({
      where: scope.semua ? { status: "ACTIVE" } : { kebunId: { in: [...scope.kebunIds] }, status: "ACTIVE" },
      select: { id: true, nama: true, username: true, role: true, jabatan: true, kebunId: true, afdelingId: true, status: true, createdAt: true },
      orderBy: { nama: "asc" },
    }),
  ]);

  return Response.json({
    scopeKebunId: scope.semua ? null : [...scope.kebunIds][0] ?? null,
    scopeBinding: scope.semua ? null : [...scope.barakIds].length,
    periodeAktif: `${["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][new Date().getMonth()]} ${new Date().getFullYear()}`,
    estates: estates.map((e) => ({ id: e.id, nama: e.nama, koordinat: koordinatKeluar(e.lat, e.lng) })),
    kebuns: kebunsRaw.map((k) => ({ id: k.id, estateId: k.estateId, nama: k.nama, koordinat: koordinatKeluar(k.lat, k.lng) })),
    afdelings: afdelingsRaw.map((a) => ({ id: a.id, kebunId: a.kebunId, nama: a.nama, koordinat: koordinatKeluar(a.lat, a.lng) })),
    baraks: baraksRaw.map((b) => ({ id: b.id, afdelingId: b.afdelingId, nama: b.nama, tipe: b.tipe, kapasitas: b.kapasitas, koordinat: koordinatKeluar(b.lat, b.lng) })),
    kartu: kartu.map((k) => ({ id: k.id, nama: k.nama, singkat: k.singkat, warna: k.warna })),
    checklist: checklist.map((c) => ({ id: c.id, kartu: c.kartuId, nomor: c.nomor, label: c.label, standar: c.standar })),
    matriks: matriks.map((m) => ({
      level: m.id as 1 | 2 | 3 | 4, jalur: m.jalur, sumberDana: m.sumberDana, kategori: m.kategori,
      pengaju: m.pengaju, verifikator: m.verifikator, final: m.final, sla: m.sla,
    })),
    users: usersRaw.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
  });
}
