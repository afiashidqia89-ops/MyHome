// ============================================================
// RumahLayak — Generator skema PostgreSQL (Neon) untuk Vercel
// Dipanggil otomatis oleh buildCommand di vercel.json dan oleh
// scripts/deploy/neon-sync.sh. Satu-satunya perbedaan dengan
// prisma/schema.prisma adalah baris provider — semua model bebas
// fitur spesifik provider (lihat header schema.prisma).
// Pemakaian: node scripts/deploy/make-postgres-schema.mjs
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = join(root, "prisma", "schema.prisma");
const dst = join(root, "prisma", "schema.postgres.prisma");

const original = readFileSync(src, "utf8");
const SQLITE_PROVIDER = 'provider = "sqlite"';
const POSTGRES_PROVIDER = 'provider = "postgresql"';

const hits = original.split(SQLITE_PROVIDER).length - 1;
if (hits !== 1) {
  console.error(
    `ERROR: schema.prisma harus memuat tepat satu baris ${SQLITE_PROVIDER} (ditemukan ${hits}).`
  );
  process.exit(1);
}

const converted = original.replace(SQLITE_PROVIDER, POSTGRES_PROVIDER);
writeFileSync(dst, converted, "utf8");
console.log(`OK — ${dst} digenerate (provider postgresql) dari schema.prisma.`);
