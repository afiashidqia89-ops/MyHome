import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Health check: dipakai APK uji koneksi server sebelum login. */
export async function GET() {
  try {
    const [users, inspeksi, temuan] = await Promise.all([
      db.user.count(), db.inspeksi.count(), db.temuan.count(),
    ]);
    return Response.json({
      status: "ok",
      server: "RumahLayak API v1 (produksi)",
      database: "terhubung",
      waktu: new Date().toISOString(),
      ringkas: { users, inspeksi, temuan },
    });
  } catch {
    return Response.json({ status: "error", database: "gagal terhubung" }, { status: 500 });
  }
}
