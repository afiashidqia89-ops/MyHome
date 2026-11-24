// ============================================================
// RumahLayak — Seed database produksi
// Menanam master data + data demo (periode November 2026)
// Jalankan: bun run db:seed
// ============================================================
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  AFDELINGS, BARAKS, CHECKLIST, ESTATES, KARTU, KEBUNS,
  APPROVAL_LEVELS, USERS, USER_BINDINGS, buildAksiLog, buildFindings, buildInspections,
} from "../src/lib/data";

const db = new PrismaClient();

async function main() {
  console.log("Mengosongkan tabel transaksi & master...");
  await db.foto.deleteMany();
  await db.tindakLanjut.deleteMany();
  await db.temuan.deleteMany();
  await db.hasilItem.deleteMany();
  await db.inspeksi.deleteMany();
  await db.aksiLog.deleteMany();
  await db.user.deleteMany();
  await db.barak.deleteMany();
  await db.afdeling.deleteMany();
  await db.kebun.deleteMany();
  await db.estate.deleteMany();
  await db.checklistItem.deleteMany();
  await db.kartu.deleteMany();
  await db.matriksApproval.deleteMany();

  console.log("Menanam struktur organisasi...");
  for (const e of ESTATES) await db.estate.create({ data: { id: e.id, nama: e.nama } });
  for (const k of KEBUNS) await db.kebun.create({ data: { id: k.id, estateId: k.estateId, nama: k.nama } });
  for (const a of AFDELINGS) await db.afdeling.create({ data: { id: a.id, kebunId: a.kebunId, nama: a.nama, lat: a.koordinat.lat, lng: a.koordinat.lng } });
  for (const b of BARAKS) await db.barak.create({ data: { id: b.id, afdelingId: b.afdelingId, nama: b.nama, tipe: b.tipe, kapasitas: b.kapasitas, lat: b.koordinat.lat, lng: b.koordinat.lng } });

  console.log("Menanam kartu Kamishibai & 27 item checklist...");
  for (const k of KARTU) {
    await db.kartu.create({ data: { id: k.id, nama: k.nama, singkat: k.singkat, warna: k.warna } });
  }
  for (const c of CHECKLIST) {
    await db.checklistItem.create({
      data: { id: c.id, kartuId: c.kartu, nomor: c.nomor, label: c.label, standar: (c as { standar: string }).standar },
    });
  }
  for (const m of APPROVAL_LEVELS) {
    await db.matriksApproval.create({
      data: { id: m.level, jalur: m.jalur, sumberDana: m.sumberDana, kategori: m.kategori, pengaju: m.pengaju, verifikator: m.verifikator, final: m.final, sla: m.sla },
    });
  }

  console.log("Menanam pengguna (sandi demo: demo123, bcrypt hashed)...");
  const pw = await bcrypt.hash("demo123", 10);
  const idUserByUsername = new Map<string, string>();
  for (const u of USERS) {
    const dibuat = await db.user.create({
      data: {
        id: u.id, username: u.username, nama: u.nama, passwordHash: pw, role: u.role,
        jabatan: u.jabatan ?? null, kebunId: u.kebunId ?? null, afdelingId: u.afdelingId ?? null,
        status: u.status, createdAt: new Date(`${u.createdAt}Z`),
      },
    });
    idUserByUsername.set(u.username, dibuat.id);
  }

  console.log("Menanam binding multi-level user (estate/kebun/afdeling/perumahan)...");
  for (const b of USER_BINDINGS) {
    const userId = idUserByUsername.get(b.username);
    if (!userId) continue;
    await db.userBinding.create({
      data: { userId, estateId: b.estateId ?? null, kebunId: b.kebunId ?? null, afdelingId: b.afdelingId ?? null, barakId: b.barakId ?? null },
    });
  }

  console.log("Menanam pemeriksaan (10 kartu, periode November 2026)...");
  const inspList = buildInspections();
  for (const i of inspList) {
    const created = await db.inspeksi.create({
      data: {
        id: i.id, kode: i.kode, tanggal: new Date(`${i.tanggal}T09:00:00Z`),
        minggu: i.minggu, periode: i.periode, barakId: i.barakId, auditorId: i.auditorId,
        picLabel: i.picLabel, kesimpulan: i.kesimpulan ?? null,
        status: i.sync === "draft" ? "DRAFT" : "TERKIRIM",
        lat: BARAKS.find((b) => b.id === i.barakId)?.koordinat.lat ?? null,
        lng: BARAKS.find((b) => b.id === i.barakId)?.koordinat.lng ?? null,
      },
    });
    for (const r of i.results) {
      const h = await db.hasilItem.create({
        data: { inspeksiId: created.id, itemId: r.itemId, status: r.status ?? null, catatan: r.catatan ?? null },
      });
      for (const f of r.fotos) {
        await db.foto.create({ data: { hasilId: h.id, dataUrl: f.dataUrl, lat: f.lat, lng: f.lng, label: f.label } });
      }
    }
  }

  console.log("Menanam temuan TND-001..007 + tindak lanjut...");
  const tndList = buildFindings();
  for (const t of tndList) {
    const created = await db.temuan.create({
      data: {
        id: t.id, kode: t.kode, inspeksiId: t.inspectionId, barakId: t.barakId,
        afdelingId: t.afdelingId, itemId: t.itemId, uraian: t.uraian, level: t.level,
        mitigasiDarurat: t.mitigasiDarurat ?? null, noWO: t.noWO ?? null,
        targetSelesai: new Date(`${t.targetSelesai}T00:00:00Z`), status: t.status,
        auditeeId: t.auditeeId ?? null, createdAt: new Date(`${t.createdAt}Z`),
      },
    });
    for (const fu of t.followUps) {
      const f = await db.tindakLanjut.create({
        data: {
          id: fu.id, temuanId: created.id, uraian: fu.uraian, olehId: fu.olehId,
          status: fu.status, createdAt: new Date(`${fu.tanggal}T10:00:00Z`),
        },
      });
      if (fu.fotoUrl) {
        await db.foto.create({ data: { tindakId: f.id, dataUrl: fu.fotoUrl, lat: 0, lng: 0, label: `Bukti ${t.kode}` } });
      }
    }
  }

  console.log("Menanam log aktivitas...");
  for (const a of buildAksiLog()) {
    await db.aksiLog.create({
      data: { id: a.id, userId: null, aktor: a.aktor, aksi: a.aksi, createdAt: new Date(`${a.waktu}Z`) },
    });
  }

  const ringkas = {
    estate: await db.estate.count(), kebun: await db.kebun.count(),
    afdeling: await db.afdeling.count(), barak: await db.barak.count(),
    kartu: await db.kartu.count(), item: await db.checklistItem.count(),
    user: await db.user.count(), inspeksi: await db.inspeksi.count(),
    temuan: await db.temuan.count(), foto: await db.foto.count(),
  };
  console.log("Seed selesai:", ringkas);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
