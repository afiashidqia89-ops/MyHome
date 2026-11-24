// ============================================================
// RumahLayak — Ganti kata "barak" → "perumahan" pada data demo
// yang sudah ada di database (SQLite sandbox / Neon produksi).
// Jalankan: bun scripts/ganti-barak-perumahan.ts
// ============================================================
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Pola penggantian 3 varian huruf (kata utuh, aman untuk SQLite REPLACE)
const POLA: [string, string][] = [
  ["Barak", "Perumahan"],
  ["barak", "perumahan"],
  ["BARAK", "PERUMAHAN"],
];

// tabel -> kolom teks yang perlu diperbarui
const TABEL: { tabel: string; kolom: string[] }[] = [
  { tabel: "Barak", kolom: ["nama", "tipe"] },
  { tabel: "ChecklistItem", kolom: ["label", "standar"] },
  { tabel: "MatriksApproval", kolom: ["kategori"] },
  { tabel: "Temuan", kolom: ["uraian", "mitigasiDarurat"] },
  { tabel: "HasilItem", kolom: ["catatan"] },
  { tabel: "TindakLanjut", kolom: ["uraian"] },
  { tabel: "Foto", kolom: ["label"] },
  { tabel: "Inspeksi", kolom: ["kesimpulan"] },
  { tabel: "AksiLog", kolom: ["aksi"] },
];

async function main() {
  console.log("Menghitung baris yang memuat kata 'barak' sebelum update...");
  for (const { tabel, kolom } of TABEL) {
    const where = kolom.map((k) => `${k} LIKE '%arak%'`).join(" OR "); // cocokkan Barak/barak/BARAK
    const sebelum = Number((await db.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) as n FROM "${tabel}" WHERE ${where}`,
    ))[0].n);
    if (!sebelum) {
      console.log(`  ${tabel}: tidak ada`);
      continue;
    }
    let total = 0;
    for (const [dari, ke] of POLA) {
      for (const k of kolom) {
        const r = await db.$executeRawUnsafe(
          `UPDATE "${tabel}" SET "${k}" = REPLACE("${k}", '${dari}', '${ke}') WHERE "${k}" LIKE '%${dari}%'`,
        );
        total += r;
      }
    }
    console.log(`  ${tabel}: ${sebelum} baris diperiksa, ${total} kolom diperbarui`);
  }

  console.log("\nVerifikasi — sisa kemunculan kata barak per tabel:");
  let sisa = 0;
  for (const { tabel, kolom } of TABEL) {
    const where = kolom.map((k) => `${k} LIKE '%arak%'`).join(" OR ");
    const n = Number((await db.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) as n FROM "${tabel}" WHERE ${where}`,
    ))[0].n);
    if (n) {
      sisa += n;
      console.log(`  ${tabel}: MASIH ADA ${n} (periksa manual)`);
    }
  }
  console.log(sisa === 0 ? "  Bersih — semua kata telah diganti." : `  Total sisa: ${sisa}`);

  console.log("\nSampel nama Perumahan:");
  const baraks = await db.barak.findMany({ select: { nama: true, tipe: true }, take: 3 });
  for (const b of baraks) console.log(`  - ${b.nama} (${b.tipe})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
