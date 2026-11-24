import { db } from "@/lib/db";
import { badRequest, forbidden, getSessionUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST: auditee mengirim tindak lanjut + bukti foto perbaikan
 * (foto tergeotag hasil kamera APK, disimpan di database server).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return unauthorized();

  const { id } = await params;
  let body: { uraian?: string; foto?: { dataUrl: string; lat: number; lng: number; label?: string } };
  try {
    body = await req.json();
  } catch {
    return badRequest("Format permintaan tidak valid");
  }
  const uraian = (body.uraian ?? "").trim();
  if (!uraian) return badRequest("Uraian tindak lanjut wajib diisi");

  const temuan = await db.temuan.findUnique({ where: { id } });
  if (!temuan) return badRequest("Temuan tidak ditemukan");
  if (me.role !== "AUDITEE" || temuan.auditeeId !== me.id) {
    return forbidden("Hanya auditee PIC temuan ini yang dapat mengirim bukti perbaikan");
  }
  if (temuan.status === "CLOSED" || temuan.status === "VERIFIED") {
    return badRequest("Temuan sudah terverifikasi/ditutup");
  }

  const updated = await db.$transaction(async (tx) => {
    const tl = await tx.tindakLanjut.create({
      data: { temuanId: temuan.id, uraian: uraian.slice(0, 2000), olehId: me.id, status: "SUBMITTED" },
    });
    const foto = body.foto;
    if (foto?.dataUrl && foto.dataUrl.length <= 3_000_000) {
      await tx.foto.create({
        data: { tindakId: tl.id, dataUrl: foto.dataUrl, lat: foto.lat ?? 0, lng: foto.lng ?? 0, label: (foto.label ?? `Bukti ${temuan.kode}`).slice(0, 120) },
      });
    }
    await tx.temuan.update({ where: { id: temuan.id }, data: { status: "SUBMITTED" } });
    await tx.aksiLog.create({
      data: { userId: me.id, aktor: me.nama, aksi: `Melampirkan bukti perbaikan temuan ${temuan.kode}${foto ? " (foto tergeotag)" : ""}` },
    });
    return tl;
  });

  return Response.json({ tindakLanjut: { id: updated.id }, temuanStatus: "SUBMITTED" }, { status: 201 });
}
