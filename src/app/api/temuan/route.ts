import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { muatScope } from "@/lib/scope";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const include = {
  tindakLanjut: { include: { fotos: true, oleh: true }, orderBy: { createdAt: "asc" as const } },
};

type Row = Prisma.TemuanGetPayload<{ include: typeof include }>;

function serialize(f: Row) {
  return {
    id: f.id,
    kode: f.kode,
    inspectionId: f.inspeksiId,
    barakId: f.barakId,
    afdelingId: f.afdelingId,
    itemId: f.itemId,
    uraian: f.uraian,
    level: f.level as 1 | 2 | 3 | 4,
    mitigasiDarurat: f.mitigasiDarurat ?? undefined,
    noWO: f.noWO ?? undefined,
    targetSelesai: f.targetSelesai.toISOString().slice(0, 10),
    status: f.status as "OPEN" | "IN_PROGRESS" | "SUBMITTED" | "VERIFIED" | "CLOSED",
    auditeeId: f.auditeeId ?? undefined,
    createdAt: f.createdAt.toISOString(),
    followUps: f.tindakLanjut.map((t) => ({
      id: t.id,
      findingId: f.id,
      tanggal: t.createdAt.toISOString().slice(0, 10),
      uraian: t.uraian,
      fotoUrl: t.fotos[0]?.dataUrl,
      olehId: t.olehId,
      status: t.status as "SUBMITTED" | "VERIFIED",
    })),
  };
}

/** GET: daftar temuan ter-scope peran & binding pengguna. */
export async function GET(req: Request) {
  const me = await getSessionUser();
  if (!me) return unauthorized();

  const url = new URL(req.url);
  const kebunId = url.searchParams.get("kebunId");
  const status = url.searchParams.get("status");

  const scope = await muatScope(me);
  const where: Prisma.TemuanWhereInput = {};
  if (me.role === "AUDITEE") {
    // AUDITEE: temuan yang ditugaskan kepada dirinya
    where.auditeeId = me.id;
  } else if (!scope.semua) {
    // AUDITOR & ADMIN dengan binding: hanya temuan pada perumahan terikat
    where.barak = { id: { in: [...scope.barakIds] } };
    if (kebunId) where.barak = { id: { in: [...scope.barakIds] }, afdeling: { kebunId } };
  } else if (kebunId) {
    where.barak = { afdeling: { kebunId } };
  }
  if (status) where.status = status;

  const rows = await db.temuan.findMany({
    where,
    include,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return Response.json({ temuan: rows.map(serialize) });
}
