// ============================================================
// RumahLayak — Porting data: SQLite sandbox -> Neon PostgreSQL
// Menyalin SELURUH isi db/custom.db (ID dipertahankan) ke database
// Neon sehingga data di Vercel persis sama dengan pratinjau demo:
// struktur organisasi, 9 pengguna (+hash sandi), binding multi-level,
// kartu & 27 item checklist, matriks approval, inspeksi (PRM-W#-##),
// hasil item, foto (dataUrl GPS), temuan (TND-###), tindak lanjut, log.
//
// Jalankan SETELAH scripts/deploy/prepare-postgres.sh (client harus
// sudah di-generate untuk PostgreSQL). Runtime: bun (bun:sqlite).
//
//   bun scripts/deploy/port-sqlite-to-neon.ts            # porting
//   bun scripts/deploy/port-sqlite-to-neon.ts --dry-run  # hitung saja
// ============================================================
import { Database } from "bun:sqlite";
import { PrismaClient } from "@prisma/client";

const DRY = process.argv.includes("--dry-run");
const root = new URL("../..", import.meta.url).pathname;
const db = new Database(`${root}db/custom.db`, { readonly: true });

// ---- Konverter nilai SQLite -> Prisma ------------------------------------
const s = (v) => (v === null || v === undefined ? null : String(v));
const sn = (v) => (v === null || v === undefined ? null : s(v)); // string nullable
const i = (v) => (v === null || v === undefined ? null : Number(v));
const f = (v) => (v === null || v === undefined ? null : Number(v));
const dt = (v) => new Date(Number(v)); // epoch ms -> Date
const bo = (v) => v === null || v === undefined ? null : Boolean(Number(v));

// ---- Definisi tabel (urutan = urutan aman foreign key) --------------------
// del : urutan DELETE di Neon (balik dari insert)
// cols: [namaKolom, konverter]
const TABLES = {
  Estate: { cols: [["id", s], ["nama", s]] },
  Kebun: { cols: [["id", s], ["estateId", s], ["nama", s]] },
  Afdeling: { cols: [["id", s], ["kebunId", s], ["nama", s], ["lat", f], ["lng", f]] },
  Barak: {
    cols: [["id", s], ["afdelingId", s], ["nama", s], ["tipe", s], ["kapasitas", i], ["lat", f], ["lng", f]],
  },
  User: {
    cols: [
      ["id", s], ["username", s], ["nama", s], ["passwordHash", s], ["role", s],
      ["jabatan", sn], ["kebunId", sn], ["afdelingId", sn], ["status", s],
      ["createdAt", dt], ["updatedAt", dt],
    ],
  },
  UserBinding: {
    cols: [["id", s], ["userId", s], ["estateId", sn], ["kebunId", sn], ["afdelingId", sn], ["barakId", sn]],
  },
  Kartu: { cols: [["id", s], ["nama", s], ["singkat", s], ["warna", s]] },
  ChecklistItem: { cols: [["id", s], ["kartuId", s], ["nomor", i], ["label", s], ["standar", s]] },
  MatriksApproval: {
    cols: [["id", i], ["jalur", s], ["sumberDana", s], ["kategori", s], ["pengaju", s], ["verifikator", s], ["final", s], ["sla", s]],
  },
  Inspeksi: {
    cols: [
      ["id", s], ["kode", s], ["tanggal", dt], ["minggu", i], ["periode", s],
      ["barakId", s], ["auditorId", s], ["picLabel", s], ["kesimpulan", sn],
      ["status", s], ["lat", f], ["lng", f], ["createdAt", dt], ["updatedAt", dt],
    ],
  },
  HasilItem: { cols: [["id", s], ["inspeksiId", s], ["itemId", s], ["status", sn], ["catatan", sn]] },
  Foto: {
    cols: [["id", s], ["hasilId", sn], ["tindakId", sn], ["dataUrl", s], ["lat", f], ["lng", f], ["label", s], ["createdAt", dt]],
  },
  Temuan: {
    cols: [
      ["id", s], ["kode", s], ["inspeksiId", s], ["barakId", s], ["afdelingId", s],
      ["itemId", s], ["uraian", s], ["level", i], ["mitigasiDarurat", sn], ["noWO", sn],
      ["targetSelesai", dt], ["status", s], ["auditeeId", sn], ["createdAt", dt], ["updatedAt", dt],
    ],
  },
  TindakLanjut: {
    cols: [["id", s], ["temuanId", s], ["uraian", s], ["olehId", s], ["status", s], ["createdAt", dt]],
  },
  AksiLog: { cols: [["id", s], ["userId", sn], ["aktor", s], ["aksi", s], ["createdAt", dt]] },
};

// Urutan INSERT (parent dulu); DELETE = kebalikannya.
// Foto menunjuk DUA parent (HasilItem.hasilId & TindakLanjut.tindakId),
// jadi Temuan + TindakLanjut wajib ditulis sebelum Foto.
const INSERT_ORDER = [
  "Estate", "Kebun", "Afdeling", "Barak", "User", "UserBinding",
  "Kartu", "ChecklistItem", "MatriksApproval",
  "Inspeksi", "Temuan", "TindakLanjut", "HasilItem", "Foto", "AksiLog",
];

function readTable(table, cols) {
  const names = cols.map(([c]) => `"${c}"`).join(", ");
  return db.query(`SELECT ${names} FROM "${table}"`).all().map((row) => {
    const data = {};
    for (const [c, conv] of cols) data[c] = conv(row[c]);
    return data;
  });
}

const data = {};
let total = 0;
console.log("Membaca db/custom.db (SQLite sandbox)...");
for (const t of INSERT_ORDER) {
  data[t] = readTable(t, TABLES[t].cols);
  total += data[t].length;
  console.log(`  ${t.padEnd(16)} ${String(data[t].length).padStart(4)} baris`);
}
console.log(`Total ${total} baris siap dipindahkan.\n`);

if (DRY) {
  console.log("--dry-run — tidak ada penulisan ke Neon. Keluar.");
  process.exit(0);
}

const neon = new PrismaClient();
const DELETE_ORDER = [...INSERT_ORDER].reverse();
const DELETE_LABEL = { Estate: "estate", Kebun: "kebun", Afdeling: "afdeling", Barak: "barak", User: "user", UserBinding: "userBinding", Kartu: "kartu", ChecklistItem: "checklistItem", MatriksApproval: "matriksApproval", Inspeksi: "inspeksi", HasilItem: "hasilItem", Foto: "foto", Temuan: "temuan", TindakLanjut: "tindakLanjut", AksiLog: "aksiLog" };

async function main() {
  console.log("Mengosongkan tabel Neon (urutan aman foreign key)...");
  for (const t of DELETE_ORDER) {
    await neon[DELETE_LABEL[t]].deleteMany();
    console.log(`  delete ${DELETE_LABEL[t]}`);
  }

  console.log("\nMenulis data ke Neon (ID asli dipertahankan)...");
  for (const t of INSERT_ORDER) {
    for (const row of data[t]) {
      await neon[DELETE_LABEL[t]].create({ data: row });
    }
    console.log(`  ${t.padEnd(16)} ${String(data[t].length).padStart(4)} baris ditulis`);
  }

  // ---- Verifikasi -----------------------------------------------------------
  const cek = {};
  for (const t of INSERT_ORDER) cek[t] = await neon[DELETE_LABEL[t]].count();
  console.log("\nVerifikasi jumlah baris Neon vs SQLite:");
  let beda = 0;
  for (const t of INSERT_ORDER) {
    const ok = cek[t] === data[t].length;
    if (!ok) beda += 1;
    console.log(`  ${t.padEnd(16)} neon=${String(cek[t]).padStart(4)}  sqlite=${String(data[t].length).padStart(4)} ${ok ? "OK" : "BEDA!"}`);
  }
  if (beda > 0) throw new Error(`${beda} tabel tidak cocok — periksa log di atas.`);
  console.log("\nPorting selesai — data Neon identik dengan sandbox demo.");
}

main()
  .catch((e) => {
    console.error("PORTING GAGAL:", e);
    process.exit(1);
  })
  .finally(() => neon.$disconnect());
