import { db } from "@/lib/db";
import { badRequest, forbidden, getSessionUser, hashPassword, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

export interface BindingInput {
  estateId?: string | null;
  kebunId?: string | null;
  afdelingId?: string | null;
  barakId?: string | null;
}

/** Ambil semua binding user lalu kelompokkan per user + label tampilan. */
async function ambilBinding(userId?: string) {
  const rows = await db.userBinding.findMany({
    where: userId ? { userId } : undefined,
    include: { estate: true, kebun: true, afdeling: true, barak: true },
  });
  const perUser = new Map<string, { estateId: string | null; kebunId: string | null; afdelingId: string | null; barakId: string | null; label: string }[]>();
  for (const r of rows) {
    const list = perUser.get(r.userId) ?? [];
    const label = [r.estate?.nama, r.kebun?.nama, r.afdeling?.nama, r.barak?.nama].filter(Boolean).join(" / ") || "-";
    list.push({ estateId: r.estateId, kebunId: r.kebunId, afdelingId: r.afdelingId, barakId: r.barakId, label });
    perUser.set(r.userId, list);
  }
  return perUser;
}

/** Validasi binding input & sinkronkan kolom binding tunggal (kompatibilitas). */
function validasiBinding(bindings: BindingInput[]): BindingInput[] {
  return bindings
    .filter((b) => b && typeof b === "object")
    .map((b) => ({
      estateId: b.estateId?.trim() || null,
      kebunId: b.kebunId?.trim() || null,
      afdelingId: b.afdelingId?.trim() || null,
      barakId: b.barakId?.trim() || null,
    }))
    .filter((b) => b.estateId || b.kebunId || b.afdelingId || b.barakId);
}

async function simpanBinding(userId: string, bindings: BindingInput[]) {
  await db.userBinding.deleteMany({ where: { userId } });
  if (bindings.length) {
    await db.userBinding.createMany({ data: bindings.map((b) => ({ userId, ...b })) });
  }
  // Sinkronkan kolom binding tunggal (dipakai tampilan & penugasan auditee)
  const pertamaKebun = bindings.find((b) => b.kebunId)?.kebunId ?? null;
  const pertamaAfd = bindings.find((b) => b.afdelingId)?.afdelingId ?? null;
  await db.user.update({
    where: { id: userId },
    data: { kebunId: pertamaKebun, afdelingId: pertamaAfd },
  });
}

/** GET: daftar seluruh pengguna (khusus ADMIN) + binding masing-masing. */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role !== "ADMIN") return forbidden("Manajemen pengguna hanya untuk ADMIN");

  const rows = await db.user.findMany({
    include: { kebun: true, afdeling: true },
    orderBy: { createdAt: "desc" },
  });
  const petaBinding = await ambilBinding();
  return Response.json({
    users: rows.map((u) => ({
      id: u.id, nama: u.nama, username: u.username, role: u.role, jabatan: u.jabatan ?? "",
      kebunId: u.kebunId, afdelingId: u.afdelingId,
      kebunNama: u.kebun?.nama ?? null, afdelingNama: u.afdeling?.nama ?? null,
      bindings: (petaBinding.get(u.id) ?? []).map((b) => b.label),
      bindingIds: (petaBinding.get(u.id) ?? []).map((b) => ({ estateId: b.estateId, kebunId: b.kebunId, afdelingId: b.afdelingId, barakId: b.barakId })),
      status: u.status, createdAt: u.createdAt.toISOString(),
    })),
  });
}

/**
 * POST: admin mendaftarkan user baru — TANPA EMAIL.
 * Nama pengguna (username) dibuat otomatis dari nama;
 * binding MULTI (estate/kebun/afdeling/perumahan) via checkbox ditetapkan DI SINI.
 */
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role !== "ADMIN") return forbidden("Manajemen pengguna hanya untuk ADMIN");

  let body: { nama?: string; jabatan?: string; role?: string; kebunId?: string; afdelingId?: string; password?: string; bindings?: BindingInput[] };
  try {
    body = await req.json();
  } catch {
    return badRequest("Format permintaan tidak valid");
  }

  const nama = (body.nama ?? "").trim();
  const jabatan = (body.jabatan ?? "").trim();
  const role = body.role ?? "AUDITEE";
  if (!nama || !jabatan) return badRequest("Nama dan jabatan wajib diisi");
  if (!["AUDITOR", "AUDITEE", "ADMIN"].includes(role)) return badRequest("Peran tidak dikenal");

  // Binding: checkbox multi level; fallback ke kolom tunggal bila ada
  const bindings = validasiBinding(body.bindings ?? []);
  if (!bindings.length && (body.kebunId?.trim() || body.afdelingId?.trim())) {
    bindings.push({ estateId: null, kebunId: body.kebunId?.trim() || null, afdelingId: body.afdelingId?.trim() || null, barakId: null });
  }
  if (role === "ADMIN") bindings.length = 0; // ADMIN corporate — tanpa binding
  if (role !== "ADMIN" && bindings.length === 0) {
    return badRequest("User lapangan wajib terikat minimal satu estate/kebun/afdeling/perumahan (centang pada form)");
  }

  // Username otomatis dari nama — unik, huruf kecil, dedupe dengan angka
  const dasar = nama.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "user";
  let username = dasar;
  let n = 2;
  while (await db.user.findUnique({ where: { username } })) {
    username = `${dasar}${n++}`;
  }

  const pw = await hashPassword(body.password?.trim() || "rumahlayak123");
  const user = await db.user.create({
    data: { nama, username, jabatan, role, kebunId: null, afdelingId: null, passwordHash: pw, status: "ACTIVE" },
  });
  await simpanBinding(user.id, bindings);
  await db.aksiLog.create({
    data: {
      userId: me.id, aktor: me.nama,
      aksi: `Mendaftarkan user baru ${nama} (${role}) sebagai "${username}"${bindings.length ? ` — ${bindings.length} binding unit` : ""}`,
    },
  });

  const sandiAwal = body.password?.trim() || "rumahlayak123";
  return Response.json({ user: { id: user.id, nama: user.nama, username: user.username, status: user.status }, sandiAwal }, { status: 201 });
}
