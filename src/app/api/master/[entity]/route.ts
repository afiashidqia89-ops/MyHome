import { db } from "@/lib/db";
import { badRequest, forbidden, getSessionUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

// ============================================================
// POST /api/master/{entity} — tambah data master (khusus ADMIN)
// entity: estate | kebun | afdeling | barak
// Hierarki: Estate -> Kebun -> Afdeling -> Perumahan (model DB: Barak)
// ============================================================

const ENTITAS = ["estate", "kebun", "afdeling", "barak"] as const;
type Entity = (typeof ENTITAS)[number];

const PUSAT_DEFAULT = { lat: -0.052, lng: 109.322 }; // pusat Kebun Mandor (fallback koordinat)

function idBaru(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function angka(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role !== "ADMIN") return forbidden("Manajemen data master hanya untuk ADMIN");

  const { entity } = await params;
  if (!ENTITAS.includes(entity as Entity)) return badRequest("Entitas tidak dikenal (estate/kebun/afdeling/barak)");

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Format permintaan tidak valid");
  }

  const nama = String(body.nama ?? "").trim();
  if (!nama) return badRequest("Nama wajib diisi");

  let created: { id: string; nama: string };
  let labelAksi = nama;

  if (entity === "estate") {
    created = await db.estate.create({ data: { id: idBaru("EST"), nama } });
  } else if (entity === "kebun") {
    const estateId = String(body.estateId ?? "").trim();
    if (!estateId) return badRequest("Estate induk wajib dipilih");
    const estate = await db.estate.findUnique({ where: { id: estateId } });
    if (!estate) return badRequest("Estate tidak ditemukan");
    created = await db.kebun.create({ data: { id: idBaru("KB"), estateId, nama } });
    labelAksi = `${nama} (${estate.nama})`;
  } else if (entity === "afdeling") {
    const kebunId = String(body.kebunId ?? "").trim();
    if (!kebunId) return badRequest("Kebun induk wajib dipilih");
    const kebun = await db.kebun.findUnique({ where: { id: kebunId } });
    if (!kebun) return badRequest("Kebun tidak ditemukan");
    created = await db.afdeling.create({
      data: { id: idBaru("AF"), kebunId, nama, lat: angka(body.lat, PUSAT_DEFAULT.lat), lng: angka(body.lng, PUSAT_DEFAULT.lng) },
    });
    labelAksi = `${nama} (${kebun.nama})`;
  } else {
    const afdelingId = String(body.afdelingId ?? "").trim();
    if (!afdelingId) return badRequest("Afdeling induk wajib dipilih");
    const afd = await db.afdeling.findUnique({ where: { id: afdelingId } });
    if (!afd) return badRequest("Afdeling tidak ditemukan");
    const kapasitas = Math.max(1, Math.round(angka(body.kapasitas, 16)));
    created = await db.barak.create({
      data: {
        id: idBaru("B"),
        afdelingId,
        nama,
        tipe: String(body.tipe ?? "").trim() || "Perumahan",
        kapasitas,
        lat: angka(body.lat, PUSAT_DEFAULT.lat),
        lng: angka(body.lng, PUSAT_DEFAULT.lng),
      },
    });
    labelAksi = `${nama} (${afd.nama})`;
  }

  await db.aksiLog.create({
    data: { userId: me.id, aktor: me.nama, aksi: `Menambahkan ${entity.toUpperCase()} "${labelAksi}" pada data master` },
  });

  return Response.json({ item: created }, { status: 201 });
}
