import { db } from "@/lib/db";
import { badRequest, forbidden, getSessionUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/inspeksi/{id}/foto — tambah foto ke pemeriksaan yang SUDAH tersimpan.
 * Dipakai sinkron offline bila isi pemeriksaan + foto terlalu besar untuk satu
 * permintaan (batas ~4,5 MB hosting): foto dikirim satu per satu di sini.
 * IDEMPOTEN: foto ber-ID sama dilewati, jadi kirim ulang tidak menggandakan.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role !== "AUDITOR" && me.role !== "ADMIN") return forbidden("Hanya auditor yang dapat mengunggah foto pemeriksaan");

  const { id } = await params;
  const insp = await db.inspeksi.findUnique({ where: { id } });
  if (!insp) return badRequest("Pemeriksaan tidak ditemukan");
  if (me.role === "AUDITOR" && insp.auditorId !== me.id) return forbidden("Pemeriksaan ini milik auditor lain");

  let body: { itemId?: string; fotos?: { id?: string; dataUrl?: string; lat?: number; lng?: number; label?: string }[] };
  try {
    body = await req.json();
  } catch {
    return badRequest("Format permintaan tidak valid");
  }
  if (!body.itemId) return badRequest("Item wajib diisi");
  const fotos = Array.isArray(body.fotos) ? body.fotos : [];

  let hasil = await db.hasilItem.findUnique({ where: { inspeksiId_itemId: { inspeksiId: id, itemId: body.itemId } } });
  if (!hasil) {
    const item = await db.checklistItem.findUnique({ where: { id: body.itemId } });
    if (!item) return badRequest("Item tidak ditemukan");
    hasil = await db.hasilItem.create({ data: { inspeksiId: id, itemId: body.itemId, status: null } });
  }

  let ditambah = 0;
  for (const f of fotos) {
    if (!f.dataUrl || f.dataUrl.length > 3_000_000) continue;
    const fid = f.id ? `${id}:${body.itemId}:${f.id}`.slice(0, 190) : undefined;
    if (fid && (await db.foto.findUnique({ where: { id: fid } }))) continue; // sudah ada
    await db.foto.create({
      data: {
        ...(fid ? { id: fid } : {}),
        hasilId: hasil.id, dataUrl: f.dataUrl,
        lat: Number.isFinite(f.lat) ? (f.lat as number) : insp.lat ?? 0,
        lng: Number.isFinite(f.lng) ? (f.lng as number) : insp.lng ?? 0,
        label: (f.label ?? "Foto audit").slice(0, 120),
      },
    });
    ditambah++;
  }
  return Response.json({ ok: true, ditambah });
}
