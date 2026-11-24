import { db } from "@/lib/db";
import { forbidden, getSessionUser, unauthorized } from "@/lib/auth";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const PREFIX_KARTU: Record<string, string> = { A: "KMS-01", B: "KMS-02", C: "KMS-03", D: "KMS-04" };

function fmtTanggal(d: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(d);
}

/** GET /api/export/xlsx?kebunId= — buku kerja 4 sheet (server-side). */
export async function GET(req: Request) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role === "AUDITEE") return forbidden("Ekspor hanya untuk auditor & admin");

  const url = new URL(req.url);
  const kebunId = me.role === "ADMIN" ? url.searchParams.get("kebunId") : me.kebunId;

  const inspRows = await db.inspeksi.findMany({
    where: kebunId ? { barak: { afdeling: { kebunId } } } : undefined,
    include: { barak: { include: { afdeling: true } }, auditor: true, hasil: { include: { fotos: true } } },
    orderBy: [{ minggu: "asc" }, { kode: "asc" }],
  });
  const temuanRows = await db.temuan.findMany({
    where: kebunId ? { barak: { afdeling: { kebunId } } } : undefined,
    include: { barak: { include: { afdeling: true } }, tindakLanjut: true },
    orderBy: { kode: "asc" },
  });
  const usersRows = await db.user.findMany({ include: { kebun: true }, orderBy: { nama: "asc" } });

  // Sheet 1 — Papan Rekap Kamishibai (H/M per kartu per baris audit)
  const papan: (string | number)[][] = [
    [`PAPAN REKAP KAMISHIBAI — EMPLASEMEN PERUMAHAN (${BULAN[new Date().getMonth()]} ${new Date().getFullYear()})`],
    ["Kode", "Minggu", "PIC", "Auditor", "Afdeling", "Perumahan", "Hunian", "Air & Sanitasi", "Listrik & Dapur", "K3 & Pendukung", "Total H", "Total M", "% Kelayakan", "Sync"],
  ];
  for (const i of inspRows) {
    const st = (prefix: string) => {
      const items = i.hasil.filter((h) => h.itemId.startsWith(prefix));
      if (!items.length || items.every((h) => h.status === null)) return "-";
      return items.some((h) => h.status === "M") ? "M" : "H";
    };
    const h = (["A", "B", "C", "D"] as const).filter((p) => st(p) === "H").length;
    const m = (["A", "B", "C", "D"] as const).filter((p) => st(p) === "M").length;
    papan.push([
      i.kode, `W${i.minggu}`, i.picLabel, i.auditor.nama, i.barak.afdeling.nama, i.barak.nama,
      st("A"), st("B"), st("C"), st("D"), h, m,
      h + m ? `${Math.round((h / (h + m)) * 1000) / 10}%` : "-",
      i.status === "DRAFT" ? "DRAFT" : "TERKIRIM",
    ]);
  }

  // Sheet 2 — Riwayat pemeriksaan per item
  const riwayat: (string | number)[][] = [
    ["Tanggal", "Kode Pemeriksaan", "Minggu", "Afdeling", "Perumahan", "Auditor", "Item", "Kartu", "Status", "Catatan", "Jumlah Foto", "Sync"],
  ];
  for (const i of inspRows) {
    for (const r of i.hasil.filter((x) => x.status !== null)) {
      riwayat.push([
        fmtTanggal(i.tanggal), i.kode, `W${i.minggu}`, i.barak.afdeling.nama, i.barak.nama, i.auditor.nama,
        r.itemId, PREFIX_KARTU[r.itemId[0]] ?? "-", r.status ?? "-", r.catatan ?? "", r.fotos.length,
        i.status === "DRAFT" ? "DRAFT" : "TERKIRIM",
      ]);
    }
  }

  // Sheet 3 — Temuan & tindak lanjut
  const tnd: (string | number)[][] = [
    ["Kode", "Tanggal", "Afdeling", "Perumahan", "Item", "Uraian Temuan", "Level", "Jalur", "Target (SLA)", "Status", "Mitigasi Darurat", "No. WO", "Jumlah Follow-up"],
  ];
  for (const f of temuanRows) {
    tnd.push([
      f.kode, fmtTanggal(f.createdAt), f.barak.afdeling.nama, f.barak.nama, f.itemId, f.uraian,
      `Level ${f.level}`, f.level <= 2 ? "A - Swakelola Kebun" : "B - GS Project/Corporate",
      fmtTanggal(f.targetSelesai), f.status, f.mitigasiDarurat ?? "", f.noWO ?? "", f.tindakLanjut.length,
    ]);
  }

  // Sheet 4 — Pengguna
  const usr: (string | number)[][] = [
    ["Nama", "Nama Pengguna", "Role", "Jabatan", "Kebun (binding)", "Status"],
    ...usersRows.map((u) => [u.nama, u.username, u.role, u.jabatan ?? "", u.kebun?.nama ?? "—", u.status]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(papan), "Papan Kamishibai");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(riwayat), "Riwayat Pemeriksaan");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tnd), "Temuan & Follow-up");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(usr), "Pengguna");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const periode = `${BULAN[new Date().getMonth()]}${new Date().getFullYear()}`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="RumahLayak_Kamishibai_${periode}.xlsx"`,
    },
  });
}
