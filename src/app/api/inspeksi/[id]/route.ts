import { db } from "@/lib/db";
import { badRequest, forbidden, getSessionUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * DELETE /api/inspeksi/{id} — hapus pemeriksaan (khusus ADMIN).
 * Dipakai tombol "Hapus" (multi-centang) pada menu Rekap Report portal web.
 * Hapus berantai manual (transaksi): foto bukti → tindak lanjut → temuan
 * → hasil item → pemeriksaan, lalu catat audit trail.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role !== "ADMIN") {
    return forbidden("Hanya ADMIN yang dapat menghapus data pemeriksaan");
  }

  const { id } = await params;
  const insp = await db.inspeksi.findUnique({ where: { id } });
  if (!insp) return badRequest("Pemeriksaan tidak ditemukan");

  await db.$transaction(async (tx) => {
    // Foto bukti perbaikan (melekat pada tindak lanjut milik temuan inspeksi ini)
    await tx.foto.deleteMany({ where: { tindak: { temuan: { inspeksiId: id } } } });
    // Tindak lanjut seluruh temuan inspeksi ini
    await tx.tindakLanjut.deleteMany({ where: { temuan: { inspeksiId: id } } });
    // Temuan milik inspeksi ini
    await tx.temuan.deleteMany({ where: { inspeksiId: id } });
    // Foto hasil pemeriksaan + hasil item
    await tx.foto.deleteMany({ where: { hasil: { inspeksiId: id } } });
    await tx.hasilItem.deleteMany({ where: { inspeksiId: id } });
    // Terakhir: pemeriksaan itu sendiri
    await tx.inspeksi.delete({ where: { id } });
    await tx.aksiLog.create({
      data: { userId: me.id, aktor: me.nama, aksi: `Hapus pemeriksaan ${insp.kode} (Rekap Report) beserta temuan & tindak lanjutnya` },
    });
  });

  return Response.json({ ok: true, kode: insp.kode });
}
