#!/usr/bin/env bash
# ============================================================
# RumahLayak — Siapkan schema & client Prisma untuk PostgreSQL
# Wajib dijalankan dengan DATABASE_URL menunjuk ke Neon/Postgres.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ -z "${DATABASE_URL:-}" ] || [[ "${DATABASE_URL}" == file:* ]]; then
  echo "ERROR: DATABASE_URL belum berisi connection string PostgreSQL/Neon." >&2
  echo "" >&2
  echo "Pemakaian:" >&2
  echo "  DATABASE_URL='postgresql://user:pass@ep-xxx...neon.tech/rumahlayak?sslmode=require' $0" >&2
  exit 1
fi

case "${DATABASE_URL}" in
  postgresql://*|postgres://*) ;;
  *) echo "ERROR: DATABASE_URL tidak diawali postgresql:// — ini bukan URL Neon." >&2; exit 1 ;;
esac

echo "[1/3] Generate prisma/schema.postgres.prisma dari schema.prisma..."
node scripts/deploy/make-postgres-schema.mjs

echo "[2/3] prisma db push ke Neon (buat/selaraskan semua tabel)..."
npx --no-install prisma db push --schema prisma/schema.postgres.prisma --accept-data-loss

echo "[3/3] prisma generate (client PostgreSQL untuk skrip seed/port)..."
npx --no-install prisma generate --schema prisma/schema.postgres.prisma

echo "Selesai — schema Neon siap, client Prisma sekarang untuk PostgreSQL."
