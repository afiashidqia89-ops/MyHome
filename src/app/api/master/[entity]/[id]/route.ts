import { db } from "@/lib/db";
import { badRequest, forbidden, getSessionUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

// ============================================================
// PATCH  /api/master/{entity}/{id} — ubah data master (ADMIN)
// DELETE /api/master/{entity}/{id} — hapus data master (ADMIN)
// Hapus ditolak (409) bila data masih dipakai entitas lain.
// ============================================================

const ENTITAS = ["estate", "kebun", "afdeling", "barak"] as const;
type Entity = (typeof ENTITAS)[number];

const PUSAT_DEFAULT = { lat: -0.052, lng: 109.322 };

function angka(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function ambil(entity: Entity, id: string) {
  switch (entity) {
    case "estate": return db.estate.findUnique({ where: { id } });
    case "kebun": return db.kebun.findUnique({ where: { id } });
    case "afdeling": return db.afdeling.findUnique({ where: { id } });
    case "barak": return db.barak.findUnique({ where: { id } });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role !== "ADMIN") return forbidden("Manajemen data master hanya untuk ADMIN");

  const { entity, id } = await params;
  if (!ENTITAS.includes(entity as Entity)) return badRequest("Entitas tidak dikenal");

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Format permintaan tidak valid");
  }

  const lama = await ambil(entity as Entity, id);
  if (!lama) return badRequest("Data tidak ditemukan");

  const nama = String(body.nama ?? lama.nama).trim();
  if (!nama) return badRequest("Nama wajib diisi");

  let updated: { id: string; nama: string };
  let labelAksi = nama;

  if (entity === "estate") {
    updated = await db.estate.update({ where: { id }, data: { nama } });
  } else if (entity === "kebun") {
    const estateId = String(body.estateId ?? (lama as { estateId: string }).estateId).trim();
    if (!(await db.estate.findUnique({ where: { id: estateId } }))) return badRequest("Estate tidak ditemukan");
    updated = await db.kebun.update({ where: { id }, data: { nama, estateId } });
  } else if (entity === "afdeling") {
    const cur = lama as { kebunId: string; lat: number; lng: number };
    const kebunId = String(body.kebunId ?? cur.kebunId).trim();
    if (!(await db.kebun.findUnique({ where: { id: kebunId } }))) return badRequest("Kebun tidak ditemukan");
    updated = await db.afdeling.update({
      where: { id },
      data: { nama, kebunId, lat: angka(body.lat, cur.lat), lng: angka(body.lng, cur.lng) },
    });
  } else {
    const cur = lama as { afdelingId: string; tipe: string; kapasitas: number; lat: number; lng: number };
    const afdelingId = String(body.afdelingId ?? cur.afdelingId).trim();
    if (!(await db.afdeling.findUnique({ where: { id: afdelingId } }))) return badRequest("Afdeling tidak ditemukan");
    updated = await db.barak.update({
      where: { id },
      data: {
        nama,
        afdelingId,
        tipe: String(body.tipe ?? cur.tipe).trim() || cur.tipe,
        kapasitas: Math.max(1, Math.round(angka(body.kapasitas, cur.kapasitas))),
        lat: angka(body.lat, cur.lat),
        lng: angka(body.lng, cur.lng),
      },
    });
  }

  await db.aksiLog.create({
    data: { userId: me.id, aktor: me.nama, aksi: `Mengubah ${entity.toUpperCase()} "${labelAksi}" pada data master` },
  });
  return Response.json({ item: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role !== "ADMIN") return forbidden("Manajemen data master hanya untuk ADMIN");

  const { entity, id } = await params;
  if (!ENTITAS.includes(entity as Entity)) return badRequest("Entitas tidak dikenal");

  const lama = await ambil(entity as Entity, id);
  if (!lama) return badRequest("Data tidak ditemukan");

  // Proteksi referensi: jangan biarkan data induk terhapus bila masih dipakai.
  const blokir = async (pesan: string) => Response.json({ error: pesan }, { status: 409 });

  if (entity === "estate") {
    const kebun = await db.kebun.count({ where: { estateId: id } });
    if (kebun > 0) return blokir(`Tidak dapat dihapus — masih ada ${kebun} kebun pada estate ini`);
  } else if (entity === "kebun") {
    const [afd, usr] = await Promise.all([
      db.afdeling.count({ where: { kebunId: id } }),
      db.user.count({ where: { kebunId: id } }),
    ]);
    if (afd > 0 || usr > 0) return blokir(`Tidak dapat dihapus — masih ada ${afd} afdeling & ${usr} user terikat kebun ini`);
  } else if (entity === "afdeling") {
    const [brk, usr] = await Promise.all([
      db.barak.count({ where: { afdelingId: id } }),
      db.user.count({ where: { afdelingId: id } }),
    ]);
    if (brk > 0 || usr > 0) return blokir(`Tidak dapat dihapus — masih ada ${brk} perumahan & ${usr} user pada afdeling ini`);
  } else {
    const [ins, tnd] = await Promise.all([
      db.inspeksi.count({ where: { barakId: id } }),
      db.temuan.count({ where: { barakId: id } }),
    ]);
    if (ins > 0 || tnd > 0) return blokir(`Tidak dapat dihapus — perumahan ini punya ${ins} riwayat pemeriksaan & ${tnd} temuan`);
  }

  switch (entity as Entity) {
    case "estate": await db.estate.delete({ where: { id } }); break;
    case "kebun": await db.kebun.delete({ where: { id } }); break;
    case "afdeling": await db.afdeling.delete({ where: { id } }); break;
    case "barak": await db.barak.delete({ where: { id } }); break;
  }

  await db.aksiLog.create({
    data: { userId: me.id, aktor: me.nama, aksi: `Menghapus ${entity.toUpperCase()} "${lama.nama}" dari data master` },
  });
  return Response.json({ ok: true });
}
