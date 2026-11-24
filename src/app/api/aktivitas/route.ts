import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

/** GET: audit trail aktivitas terbaru (30 terakhir). */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return unauthorized();

  const rows = await db.aksiLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  return Response.json({
    aktivitas: rows.map((a) => ({
      id: a.id,
      waktu: a.createdAt.toISOString(),
      aktor: a.aktor,
      aksi: a.aksi,
    })),
  });
}
