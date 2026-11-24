#!/usr/bin/env bash
# ============================================================
# RumahLayak — Isi database Neon: PORTING atau SEED
#
#   Pilihan A — PORTING (disarankan): salin PERSIS data demo yang
#   sekarang tampil di pratinjau sandbox (12 inspeksi PRM-W, 7 temuan,
#   22 foto GPS, 9 pengguna + binding) ke Neon:
#       scripts/deploy/neon-sync.sh "postgresql://...neon.tech/rumahlayak?sslmode=require"
#
#   Pilihan B — SEED: tanam ulang data demo segar dari prisma/seed.ts:
#       scripts/deploy/neon-sync.sh "postgresql://...neon.tech/rumahlayak?sslmode=require" --seed
#       (PERINGATAN: seed MENGHAPUS semua data lama di Neon)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ $# -lt 1 ]; then
  sed -n '3,16p' "$0"
  exit 1
fi

NEON_URL="$1"
MODE="${2:---port}"

case "$MODE" in
  --port|--seed) ;;
  *) echo "Argumen kedua harus --port atau --seed"; exit 1 ;;
esac

echo "==> [1/4] Siapkan schema & client PostgreSQL (DATABASE_URL = Neon)"
DATABASE_URL="$NEON_URL" bash scripts/deploy/prepare-postgres.sh

if [ "$MODE" = "--seed" ]; then
  echo ""
  echo "==> [2/4] Seed data demo (prisma/seed.ts) — data lama di Neon dihapus!"
  DATABASE_URL="$NEON_URL" bun prisma/seed.ts
  SELESAI="Seed selesai — Neon berisi data demo segar (per November 2026)."
else
  echo ""
  echo "==> [2/4] Porting data SQLite sandbox -> Neon (ID dipertahankan)"
  DATABASE_URL="$NEON_URL" bun scripts/deploy/port-sqlite-to-neon.ts
  SELESAI="Porting selesai — Neon identik dengan data pratinjau sandbox."
fi

echo ""
echo "==> [3/4] Kembalikan client Prisma ke SQLite untuk pengembangan sandbox"
npx --no-install prisma generate >/dev/null 2>&1 || bunx prisma generate

echo "==> [4/4] $SELESAI"
echo ""
echo "Langkah berikutnya: pasang DATABASE_URL=$NEON_URL di Vercel (lihat DEPLOY.md)."
