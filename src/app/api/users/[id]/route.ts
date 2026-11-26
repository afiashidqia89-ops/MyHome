import { db } from "@/lib/db";
import { badRequest, forbidden, getSessionUser, hashPassword, unauthorized } from "@/lib/auth";
import type { BindingInput } from "../route";

export const runtime = "nodejs";

/** DELETE: admin menghapus PERMANEN akun user dari sistem (tombol "Hapus" di
 *  halaman Pendaftaran User portal web). Proteksi integritas data:
 *   • hanya ADMIN yang boleh;
 *   • tidak bisa menghapus akunnya sendiri;
 *   • akun yang masih TERKAIT DATA transaksional (pemeriksaan dibuat, temuan
 *     yang dipicu, tindak lanjut yang ditulis) ditolak — gunakan status
 *     REJECTED (nonaktif) agar riwayat papan/audit trail tetap utuh;
 *   • bila bersih: binding ikut terhapus (onDelete Cascade) dan log audit
 *     lama menjadi anonim (userId SetNull), lalu penghapusan dicatat di log. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role !== "ADMIN") return forbidden("Manajemen pengguna hanya untuk ADMIN");

  const { id } = await params;
  if (id === me.id) return badRequest("Tidak dapat menghapus akun Anda sendiri");

  const target = await db.user.findUnique({
    where: { id },
    include: {
      _count: { select: { inspeksi: true, temuanPic: true, tindakLanjut: true } },
    },
  });
  if (!target) return badRequest("User tidak ditemukan");

  const { inspeksi, temuanPic, tindakLanjut } = target._count;
  if (inspeksi > 0 || temuanPic > 0 || tindakLanjut > 0) {
    return badRequest(
      `Akun ${target.nama} masih terkait data (${inspeksi} pemeriksaan, ${temuanPic} temuan, ${tindakLanjut} tindak lanjut) — nonaktifkan dengan status DITOLAK, jangan dihapus, agar riwayat tetap utuh.`,
    );
  }

  await db.user.delete({ where: { id } });
  await db.aksiLog.create({
    data: {
      userId: me.id,
      aktor: me.nama,
      aksi: `Akun ${target.nama} (@${target.username}) dihapus permanen oleh admin`,
    },
  });
  return Response.json({ hapus: true });
}

/** PATCH: admin menyetujui / menolak / MENGUBAH DATA pendaftaran user
 *  (nama, jabatan, role, kata sandi baru, binding) — tombol "Ubah" di
 *  halaman Pendaftaran User portal web. Proteksi: admin tidak bisa
 *  mengubah role/status akunnya sendiri (mencegah terkunci dari portal). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role !== "ADMIN") return forbidden("Manajemen pengguna hanya untuk ADMIN");

  const { id } = await params;
  let body: { status?: string; role?: string; nama?: string; jabatan?: string; password?: string; kebunId?: string | null; afdelingId?: string | null; bindings?: BindingInput[] };
  try {
    body = await req.json();
  } catch {
    return badRequest("Format permintaan tidak valid");
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return badRequest("User tidak ditemukan");

  // Proteksi akun sendiri: role & status akun admin yang sedang login
  // tidak boleh diubah dari sini (mencegah terkunci dari portal web).
  const ubahRole = body.role !== undefined && body.role !== target.role;
  const ubahStatus = body.status !== undefined && body.status !== target.status;
  if (id === me.id && (ubahRole || ubahStatus)) {
    return badRequest("Tidak dapat mengubah role/status akun Anda sendiri — gunakan akun admin lain");
  }

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
  if (body.nama !== undefined) {
    const nm = body.nama.trim();
    if (!nm) return badRequest("Nama tidak boleh kosong");
    data.nama = nm;
  }
  if (body.jabatan !== undefined) data.jabatan = body.jabatan.trim() || null;
  if (body.password !== undefined && body.password.trim() !== "") {
    const sandi = body.password.trim();
    if (sandi.length < 6) return badRequest("Kata sandi minimal 6 karakter");
    data.passwordHash = await hashPassword(sandi);
  }

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
  const catatanUbah: string[] = [];
  if (data.nama) catatanUbah.push("nama");
  if (body.jabatan !== undefined) catatanUbah.push("jabatan");
  if (data.role) catatanUbah.push(`role → ${data.role}`);
  if (data.passwordHash) catatanUbah.push("kata sandi");
  const bagian: string[] = [];
  if (catatanUbah.length) bagian.push(catatanUbah.join(", "));
  if (Array.isArray(body.bindings)) bagian.push(`binding ${body.bindings.length} unit`);
  await db.aksiLog.create({
    data: {
      userId: me.id, aktor: me.nama,
      aksi: body.status === "ACTIVE"
        ? `Pendaftaran ${user.nama} disetujui — akun aktif sesuai binding unitnya`
        : body.status === "REJECTED"
          ? `Pendaftaran ${user.nama} ditolak oleh admin`
          : bagian.length
            ? `Data akun ${user.nama} diperbarui admin (${bagian.join("; ")})`
            : `Data akun ${user.nama} diperbarui admin`,
    },
  });

  return Response.json({ user: { id: user.id, nama: user.nama, status: user.status, role: user.role } });
}
