import { db } from "@/lib/db";
import { badRequest, forbidden, getSessionUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST: auditor memverifikasi penutupan temuan (Langkah 4 Guideline).
 * Semua tindak lanjut menjadi TERVERIFIKASI, kartu Kamishibai kembali HIJAU.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role !== "AUDITOR" && me.role !== "ADMIN") {
    return forbidden("Hanya auditor yang dapat memverifikasi penutupan temuan");
  }

  const { id } = await params;
  const temuan = await db.temuan.findUnique({ where: { id } });
  if (!temuan) return badRequest("Temuan tidak ditemukan");
  if (me.role === "AUDITOR" && me.kebunId && temuan.barakId) {
    const barak = await db.barak.findUnique({ where: { id: temuan.barakId }, include: { afdeling: true } });
    if (barak && barak.afdeling.kebunId !== me.kebunId) {
      return forbidden("Temuan berada di luar kebun tempat Anda terdaftar");
    }
  }
  if (temuan.status !== "SUBMITTED" && temuan.status !== "VERIFIED") {
    return badRequest("Temuan belum memiliki bukti perbaikan untuk diverifikasi");
  }

  await db.$transaction(async (tx) => {
    await tx.temuan.update({ where: { id: temuan.id }, data: { status: "CLOSED" } });
    await tx.tindakLanjut.updateMany({ where: { temuanId: temuan.id }, data: { status: "VERIFIED" } });
    await tx.aksiLog.create({
      data: { userId: me.id, aktor: me.nama, aksi: `Verifikasi penutupan ${temuan.kode} — kartu Kamishibai kembali HIJAU` },
    });
  });

  return Response.json({ ok: true, status: "CLOSED" });
}
