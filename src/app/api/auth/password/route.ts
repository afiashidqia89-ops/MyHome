import { db } from "@/lib/db";
import { badRequest, hashPassword, getSessionUser, unauthorized, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * PATCH /api/auth/password — ganti kata sandi sendiri (menu Pengaturan portal web).
 * Body: { sandiLama, sandiBaru } — sandi lama diverifikasi bcrypt sebelum diubah.
 */
export async function PATCH(req: Request) {
  const me = await getSessionUser();
  if (!me) return unauthorized();

  let body: { sandiLama?: string; sandiBaru?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Format permintaan tidak valid");
  }

  const sandiLama = body.sandiLama ?? "";
  const sandiBaru = body.sandiBaru ?? "";
  if (!sandiLama || !sandiBaru) return badRequest("Sandi lama dan sandi baru wajib diisi");
  if (sandiBaru.length < 6) return badRequest("Sandi baru minimal 6 karakter");
  if (sandiBaru === sandiLama) return badRequest("Sandi baru harus berbeda dari sandi lama");

  const user = await db.user.findUnique({ where: { id: me.id } });
  if (!user || !(await verifyPassword(sandiLama, user.passwordHash))) {
    return badRequest("Sandi lama salah");
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(sandiBaru) } });
    await tx.aksiLog.create({
      data: { userId: me.id, aktor: me.nama, aksi: "Ganti kata sandi (Pengaturan Portal Web)" },
    });
  });

  return Response.json({ ok: true });
}
