import { db } from "@/lib/db";
import { badRequest, forbidden, getSessionUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH: perbarui status temuan (auditee menandai sedang dikerjakan). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return unauthorized();

  const { id } = await params;
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Format permintaan tidak valid");
  }

  const temuan = await db.temuan.findUnique({ where: { id } });
  if (!temuan) return badRequest("Temuan tidak ditemukan");

  if (body.status === "IN_PROGRESS") {
    if (me.role !== "AUDITEE" || temuan.auditeeId !== me.id) {
      return forbidden("Hanya auditee PIC temuan ini yang dapat menandai progres");
    }
    if (temuan.status !== "OPEN") return badRequest("Temuan sudah dalam proses/ditutup");
    const updated = await db.temuan.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    await db.aksiLog.create({
      data: { userId: me.id, aktor: me.nama, aksi: `Menandai temuan ${temuan.kode} sedang dikerjakan` },
    });
    return Response.json({ temuan: { id: updated.id, status: updated.status } });
  }

  return badRequest("Aksi status tidak dikenal");
}
