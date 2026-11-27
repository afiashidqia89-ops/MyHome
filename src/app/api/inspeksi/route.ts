import { db } from "@/lib/db";
import { badRequest, forbidden, getSessionUser, unauthorized } from "@/lib/auth";
import { muatScope } from "@/lib/scope";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const includeBarak = {
  barak: { include: { afdeling: true } },
  auditor: true,
  hasil: { include: { fotos: true }, orderBy: { itemId: "asc" as const } },
};

type Row = Prisma.InspeksiGetPayload<{ include: typeof includeBarak }>;

function serialize(i: Row) {
  return {
    id: i.id,
    kode: i.kode,
    tanggal: i.tanggal.toISOString().slice(0, 10),
    minggu: i.minggu,
    periode: i.periode,
    afdelingId: i.barak.afdelingId,
    barakId: i.barakId,
    auditorId: i.auditorId,
    picLabel: i.picLabel,
    kesimpulan: i.kesimpulan ?? undefined,
    sync: (i.status === "DRAFT" ? "draft" : "synced") as "draft" | "synced",
    statusDb: i.status,
    createdAt: i.createdAt.toISOString(),
    results: i.hasil.map((h) => ({
      itemId: h.itemId,
      status: (h.status as "H" | "M" | null) ?? null,
      catatan: h.catatan ?? undefined,
      fotos: h.fotos.map((f) => ({
        id: f.id, dataUrl: f.dataUrl, lat: f.lat, lng: f.lng,
        timestamp: f.createdAt.toISOString(), label: f.label,
      })),
    })),
  };
}

/** GET: daftar pemeriksaan (ter-scope binding pengguna). */
export async function GET(req: Request) {
  const me = await getSessionUser();
  if (!me) return unauthorized();

  const url = new URL(req.url);
  const kebunId = url.searchParams.get("kebunId");
  const scope = await muatScope(me);
  const where: Prisma.InspeksiWhereInput = scope.semua
    ? kebunId ? { barak: { afdeling: { kebunId } } } : {}
    : { barak: { id: { in: [...scope.barakIds] } } };

  const rows = await db.inspeksi.findMany({
    where,
    include: includeBarak,
    orderBy: [{ tanggal: "desc" }, { kode: "desc" }],
    take: 120,
  });
  return Response.json({ inspeksi: rows.map(serialize) });
}

/** POST: simpan pemeriksaan (auditor) — atomik via transaksi. */
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role !== "AUDITOR") return forbidden("Hanya auditor yang dapat menyimpan pemeriksaan");

  let body: {
    id?: string; // ID buatan perangkat saat offline → agar kirim-ulang antrean tidak menduplikasi
    barakId?: string;
    picLabel?: string;
    kesimpulan?: string;
    lat?: number;
    lng?: number;
    results?: { itemId: string; status: "H" | "M" | null; catatan?: string; fotos?: { dataUrl: string; lat: number; lng: number; label: string }[] }[];
    temuan?: { itemId: string; uraian: string; level: number; mitigasiDarurat?: string; noWO?: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Format permintaan tidak valid");
  }

  // --- IDEMPOTEN (sinkron offline): bila pemeriksaan dengan ID client
  // sudah pernah diterima, jangan buat lagi — balas data yang sudah ada.
  if (body.id) {
    const ada = await db.inspeksi.findUnique({
      where: { id: body.id },
      include: includeBarak,
    });
    if (ada) return Response.json({ inspeksi: serialize(ada), temuanDibuat: 0, sudahTersinkron: true });
  }

  const barakId = body.barakId;
  const picLabel = body.picLabel === "GM" ? "GM" : "EM";
  if (!barakId) return badRequest("Perumahan wajib dipilih");
  const barak = await db.barak.findUnique({ where: { id: barakId }, include: { afdeling: true } });
  if (!barak) return badRequest("Perumahan tidak ditemukan");
  // Binding pengguna: auditor hanya bisa memeriksa perumahan yang terikat dengannya
  const scope = await muatScope(me);
  if (!scope.semua && !scope.barakIds.has(barakId)) {
    return forbidden("Perumahan berada di luar unit tempat Anda terdaftar");
  }

  const results = Array.isArray(body.results) ? body.results : [];
  if (results.length === 0) return badRequest("Belum ada penilaian item yang disimpan");

  const now = new Date();
  const periode = `${BULAN[now.getMonth()]} ${now.getFullYear()}`;
  const minggu = Math.ceil(now.getDate() / 7);

  // Nomor urut pemeriksaan minggu ini (dipakai untuk kode PRM-W#-##)
  const seq = (await db.inspeksi.count({ where: { periode, minggu } })) + 1;
  let kode = `PRM-W${minggu}-${String(seq).padStart(2, "0")}`;
  if (await db.inspeksi.findUnique({ where: { kode } })) {
    kode = `PRM-W${minggu}-${String(seq).padStart(2, "0")}-${now.getSeconds()}`;
  }

  const temuanList = Array.isArray(body.temuan) ? body.temuan : [];
  const jumlahMerah = results.filter((r) => r.status === "M").length;

  // Penugasan PIC auditee: afdeling sama (kolom/binding) -> KTU kebun -> auditee kebun mana pun
  const auditee =
    (await db.user.findFirst({ where: { role: "AUDITEE", status: "ACTIVE", afdelingId: barak.afdelingId } }))
    ?? (await db.user.findFirst({
        where: { role: "AUDITEE", status: "ACTIVE", bindings: { some: { afdelingId: barak.afdelingId } } },
      }))
    ?? (await db.user.findFirst({
        where: { role: "AUDITEE", status: "ACTIVE", bindings: { some: { kebunId: barak.afdeling.kebunId } } },
      }))
    ?? (await db.user.findFirst({ where: { role: "AUDITEE", status: "ACTIVE", kebunId: barak.afdeling.kebunId, jabatan: { contains: "KTU" } } }))
    ?? (await db.user.findFirst({ where: { role: "AUDITEE", status: "ACTIVE", kebunId: barak.afdeling.kebunId } }));

  const countTemuan = await db.temuan.count();

  const created = await db.$transaction(async (tx) => {
    const insp = await tx.inspeksi.create({
      data: {
        ...(body.id && body.id.length <= 36 ? { id: body.id } : {}), // ID client (offline) bila ada
        kode, tanggal: now, minggu, periode,
        barakId, auditorId: me.id, picLabel,
        kesimpulan: body.kesimpulan?.trim() || null,
        status: "TERKIRIM",
        // Koordinat hasil TAGGING auditor di lokasi (1x per pemeriksaan),
        // bukan koordinat foto — fallback ke titik perumahan bila ada (bisa kosong/NULL).
        lat: Number.isFinite(body.lat) ? (body.lat as number) : barak.lat,
        lng: Number.isFinite(body.lng) ? (body.lng as number) : barak.lng,
      },
    });
    for (const r of results) {
      const item = await tx.checklistItem.findUnique({ where: { id: r.itemId } });
      if (!item) continue;
      const h = await tx.hasilItem.create({
        data: { inspeksiId: insp.id, itemId: r.itemId, status: r.status, catatan: r.catatan?.trim() || null },
      });
      for (const f of r.fotos ?? []) {
        if (!f.dataUrl || f.dataUrl.length > 3_000_000) continue;
        await tx.foto.create({
          data: { hasilId: h.id, dataUrl: f.dataUrl, lat: f.lat ?? barak.lat ?? 0, lng: f.lng ?? barak.lng ?? 0, label: (f.label ?? "Foto audit").slice(0, 120) },
        });
      }
    }
    for (const t of temuanList) {
      if (!t.itemId || !t.uraian?.trim()) continue;
      const level = [1, 2, 3, 4].includes(t.level) ? t.level : 1;
      const target = new Date(now);
      target.setDate(target.getDate() + (level <= 2 ? 7 : 14));
      await tx.temuan.create({
        data: {
          kode: `TND-${String(countTemuan + 1 + temuanList.indexOf(t)).padStart(3, "0")}`,
          inspeksiId: insp.id, barakId, afdelingId: barak.afdelingId, itemId: t.itemId,
          uraian: t.uraian.trim().slice(0, 2000), level,
          mitigasiDarurat: level >= 3 ? t.mitigasiDarurat?.trim() || null : null,
          noWO: t.noWO?.trim() || null,
          targetSelesai: target, status: "OPEN",
          auditeeId: auditee?.id ?? null,
        },
      });
    }
    await tx.aksiLog.create({
      data: {
        userId: me.id, aktor: me.nama,
        aksi: `Pemeriksaan ${kode} di ${barak.nama} (Minggu ${minggu}) — ${jumlahMerah} item MERAH${temuanList.length ? `, ${temuanList.length} temuan dicatat` : ""}`,
      },
    });
    return tx.inspeksi.findUniqueOrThrow({ where: { id: insp.id }, include: includeBarak });
  });

  return Response.json({ inspeksi: serialize(created), temuanDibuat: temuanList.length }, { status: 201 });
}
