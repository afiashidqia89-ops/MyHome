import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/export/json — dump data lengkap (berformat "paket sync":
 * dipakai APK untuk backup / integrasi ke sistem lain).
 */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return unauthorized();

  const kebunFilter = me.role === "ADMIN" ? undefined : { barak: { afdeling: { kebunId: me.kebunId ?? "__none__" } } };

  const [inspeksi, temuan, aksiLog] = await Promise.all([
    db.inspeksi.findMany({
      where: kebunFilter,
      include: { barak: { include: { afdeling: true } }, auditor: true, hasil: true },
      orderBy: { kode: "asc" },
    }),
    db.temuan.findMany({
      where: kebunFilter,
      include: { barak: { include: { afdeling: true } }, tindakLanjut: { include: { oleh: true } } },
      orderBy: { kode: "asc" },
    }),
    db.aksiLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    dihasilkanOleh: { nama: me.nama, role: me.role, kebun: me.kebun?.nama ?? "corporate" },
    periode: `${["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][new Date().getMonth()]} ${new Date().getFullYear()}`,
    inspeksi: inspeksi.map((i) => ({
      kode: i.kode, tanggal: i.tanggal, minggu: i.minggu, periode: i.periode,
      afdeling: i.barak.afdeling.nama, barak: i.barak.nama, auditor: i.auditor.nama,
      pic: i.picLabel, status: i.status, kesimpulan: i.kesimpulan,
      hasil: i.hasil.map((h) => ({ item: h.itemId, status: h.status, catatan: h.catatan })),
    })),
    temuan: temuan.map((t) => ({
      kode: t.kode, barak: t.barak.nama, afdeling: t.barak.afdeling.nama, item: t.itemId,
      uraian: t.uraian, level: t.level, status: t.status, target: t.targetSelesai,
      mitigasi: t.mitigasiDarurat, noWO: t.noWO,
      tindakLanjut: t.tindakLanjut.map((tl) => ({ oleh: tl.oleh.nama, uraian: tl.uraian, status: tl.status, waktu: tl.createdAt })),
    })),
    auditTrail: aksiLog.map((a) => ({ waktu: a.createdAt, aktor: a.aktor, aksi: a.aksi })),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="RumahLayak_data_${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
