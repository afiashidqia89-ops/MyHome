import { db } from "@/lib/db";
import { badRequest, forbidden, getSessionUser, unauthorized } from "@/lib/auth";
import type { BindingInput } from "../route";

export const runtime = "nodejs";

/** PATCH: admin menyetujui / menolak / mengubah data & binding pendaftaran user. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role !== "ADMIN") return forbidden("Manajemen pengguna hanya untuk ADMIN");

  const { id } = await params;
  let body: { status?: string; role?: string; jabatan?: string; kebunId?: string | null; afdelingId?: string | null; bindings?: BindingInput[] };
  try {
    body = await req.json();
  } catch {
    return badRequest("Format permintaan tidak valid");
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return badRequest("User tidak ditemukan");

  const data: Record<string, unknown> = {};
  if (body.status && ["ACTIVE", "PENDING", "REJECTED"].includes(body.status)) {
    data.status = body.status;
  }
  if (body.role && ["AUDITOR", "AUDITEE", "ADMIN"].includes(body.role)) {
    data.role = body.role;
    if (body.role === "ADMIN") {
      data.kebunId = null;
      data.afdelingId = null;
      await db.userBinding.deleteMany({ where: { userId: id } });
    }
  }
  if (body.jabatan !== undefined) data.jabatan = body.jabatan.trim() || null;

  // Binding multi-level: hapus semua lalu tanam ulang (checkbox pendaftaran)
  if (Array.isArray(body.bindings)) {
    const bindings = body.bindings
      .map((b) => ({
        estateId: b?.estateId?.trim() || null,
        kebunId: b?.kebunId?.trim() || null,
        afdelingId: b?.afdelingId?.trim() || null,
        barakId: b?.barakId?.trim() || null,
      }))
      .filter((b) => b.estateId || b.kebunId || b.afdelingId || b.barakId);
    if (data.role !== "ADMIN" && target.role !== "ADMIN" && bindings.length === 0) {
      return badRequest("User lapangan minimal punya satu binding unit");
    }
    await db.userBinding.deleteMany({ where: { userId: id } });
    if (bindings.length) await db.userBinding.createMany({ data: bindings.map((b) => ({ userId: id, ...b })) });
    const pertamaKebun = bindings.find((b) => b.kebunId)?.kebunId ?? null;
    const pertamaAfd = bindings.find((b) => b.afdelingId)?.afdelingId ?? null;
    data.kebunId = pertamaKebun;
    data.afdelingId = pertamaAfd;
  } else if (body.kebunId !== undefined) {
    data.kebunId = body.kebunId;
  }
  if (body.afdelingId !== undefined && !Array.isArray(body.bindings)) data.afdelingId = body.afdelingId;

  if (Object.keys(data).length === 0) return badRequest("Tidak ada perubahan");

  const user = await db.user.update({ where: { id }, data });
  await db.aksiLog.create({
    data: {
      userId: me.id, aktor: me.nama,
      aksi: body.status === "ACTIVE"
        ? `Pendaftaran ${user.nama} disetujui — akun aktif sesuai binding unitnya`
        : body.status === "REJECTED"
          ? `Pendaftaran ${user.nama} ditolak oleh admin`
          : Array.isArray(body.bindings)
            ? `Binding unit ${user.nama} diperbarui admin (${Array.isArray(body.bindings) ? body.bindings.length : 0} unit)`
            : `Data akun ${user.nama} diperbarui admin`,
    },
  });

  return Response.json({ user: { id: user.id, status: user.status, role: user.role } });
}
