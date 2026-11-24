// ============================================================
// RumahLayak — Resolusi scope data per pengguna (server)
// User bisa diberi LEBIH DARI SATU binding (estate / kebun /
// afdeling / perumahan) via checkbox pendaftaran admin.
// Hierarki binding:
//   estate   -> semua kebun di bawahnya
//   kebun    -> semua afdeling di bawahnya
//   afdeling -> semua perumahan di bawahnya
//   perumahan-> titik tunggal (induk hanya untuk tampilan)
// ============================================================
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export interface Scope {
  /** true = tanpa batasan (ADMIN corporate tanpa binding) */
  semua: boolean;
  estateIds: Set<string>;
  kebunIds: Set<string>;
  afdelingIds: Set<string>;
  barakIds: Set<string>;
  /** Daftar label binding untuk tampilan ("Kebun Mandor / Afdeling I") */
  labels: string[];
}

function labelBinding(
  e: { nama: string } | null,
  k: { nama: string } | null,
  a: { nama: string } | null,
  b: { nama: string } | null,
): string {
  const bagian = [e?.nama, k?.nama, a?.nama, b?.nama].filter(Boolean);
  return bagian.join(" / ") || "-";
}

/** Muat & resolusi binding pengguna menjadi himpunan id yang diizinkan. */
export async function muatScope(me: SessionUser): Promise<Scope> {
  const rows = await db.userBinding.findMany({
    where: { userId: me.id },
    include: { estate: true, kebun: true, afdeling: true, barak: true },
  });

  const kosong: Scope = { semua: false, estateIds: new Set(), kebunIds: new Set(), afdelingIds: new Set(), barakIds: new Set(), labels: [] };

  // ADMIN tanpa binding -> seluruh data (corporate)
  if (rows.length === 0) {
    if (me.role === "ADMIN") {
      return { semua: true, estateIds: new Set(), kebunIds: new Set(), afdelingIds: new Set(), barakIds: new Set(), labels: ["Corporate — seluruh kebun"] };
    }
    // Kompatibilitas akun lama: fallback ke kolom binding tunggal
    if (me.kebunId) {
      const kebun = await db.kebun.findUnique({ where: { id: me.kebunId } });
      const afdelings = await db.afdeling.findMany({ where: { kebunId: me.kebunId } });
      const baraks = await db.barak.findMany({ where: { afdelingId: { in: afdelings.map((a) => a.id) } } });
      const estate = kebun ? await db.estate.findUnique({ where: { id: kebun.estateId } }) : null;
      const afd = me.afdelingId ? afdelings.find((a) => a.id === me.afdelingId) ?? null : null;
      return {
        semua: false,
        estateIds: new Set(kebun ? [kebun.estateId] : []),
        kebunIds: new Set([me.kebunId]),
        afdelingIds: new Set(afdelings.map((a) => a.id)),
        barakIds: new Set(baraks.map((b) => b.id)),
        labels: [labelBinding(estate, kebun, afd, null)],
      };
    }
    return kosong;
  }

  // Resolusi top-down: estate -> kebun -> afdeling -> barak
  const estateEksplisit = new Set(rows.map((r) => r.estateId).filter(Boolean) as string[]);
  const kebunEksplisit = new Set(rows.map((r) => r.kebunId).filter(Boolean) as string[]);
  const afdEksplisit = new Set(rows.map((r) => r.afdelingId).filter(Boolean) as string[]);
  const barakEksplisit = new Set(rows.map((r) => r.barakId).filter(Boolean) as string[]);

  const kebunIds = new Set(kebunEksplisit);
  if (estateEksplisit.size) {
    const bawah = await db.kebun.findMany({ where: { estateId: { in: [...estateEksplisit] } } });
    bawah.forEach((k) => kebunIds.add(k.id));
  }

  const afdelingIds = new Set(afdEksplisit);
  if (kebunIds.size) {
    const bawah = await db.afdeling.findMany({ where: { kebunId: { in: [...kebunIds] } } });
    bawah.forEach((a) => afdelingIds.add(a.id));
  }

  const barakIds = new Set(barakEksplisit);
  if (afdelingIds.size) {
    const bawah = await db.barak.findMany({ where: { afdelingId: { in: [...afdelingIds] } } });
    bawah.forEach((b) => barakIds.add(b.id));
  }

  // Konteks tampilan ke atas: induk dari perumahan tunggal tetap muncul di form
  if (barakEksplisit.size) {
    const induk = await db.barak.findMany({ where: { id: { in: [...barakEksplisit] } }, include: { afdeling: true } });
    induk.forEach((b) => afdelingIds.add(b.afdelingId));
    if (afdelingIds.size) {
      const ks = await db.afdeling.findMany({ where: { id: { in: [...afdelingIds] } } });
      ks.forEach((a) => kebunIds.add(a.kebunId));
    }
  }
  const estateIds = new Set(estateEksplisit);
  if (kebunIds.size) {
    const ks = await db.kebun.findMany({ where: { id: { in: [...kebunIds] } } });
    ks.forEach((k) => estateIds.add(k.estateId));
  }

  const labels = rows.map((r) => labelBinding(r.estate, r.kebun, r.afdeling, r.barak));
  return { semua: false, estateIds, kebunIds, afdelingIds, barakIds, labels: [...new Set(labels)] };
}

/** Util: `where` Prisma untuk membatasi Barak/Inspeksi/Temuan pada scope. */
export function barakWhere(scope: Scope): { id?: { in: string[] } } | undefined {
  if (scope.semua) return undefined;
  return { id: { in: [...scope.barakIds] } };
}
