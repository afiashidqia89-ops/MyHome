import { db } from "@/lib/db";
import { badRequest, forbidden, getSessionUser, unauthorized } from "@/lib/auth";
import { bacaKoordinat } from "@/lib/koordinat";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

// ============================================================
// POST /api/master/import — unggah XLSX data master (ADMIN)
// Kolom wajib : ESTATE, KEBUN, AFDELING, PERUMAHAN
// Kolom opsional: TIPE, KAPASITAS, LAT, LNG (koordinat Perumahan; kosong = tanpa koordinat)
// Semantik    : upsert per hierarki — baris dengan nama yang
//               sudah ada dilewati, sehingga impor boleh diulang.
// Hierarki    : Estate -> Kebun -> Afdeling -> Perumahan (tabel: Barak)
// ============================================================

const TIPE_DEFAULT = "Perumahan";
const KOLOM_WAJIB = ["ESTATE", "KEBUN", "AFDELING", "PERUMAHAN"] as const;

function idBaru(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function bersih(v: unknown): string {
  return String(v ?? "").trim();
}

/** Angka toleran: terima "-0,05" (koma desimal) maupun "-0.05". */
function angka(v: unknown): number | null {
  if (v === undefined || v === null || bersih(v) === "") return null;
  const n = Number(bersih(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Ambil nilai kolom dari baris tanpa memedulikan huruf besar/kecil & spasi header. */
function ambil(row: Record<string, unknown>, kolom: string): unknown {
  const kunci = Object.keys(row).find((k) => k.trim().toUpperCase() === kolom);
  return kunci === undefined ? undefined : row[kunci];
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.role !== "ADMIN") return forbidden("Impor data master hanya untuk ADMIN");

  let file: unknown;
  try {
    const form = await req.formData();
    file = form.get("file");
  } catch {
    return badRequest("Kirim file XLSX sebagai multipart/form-data pada field 'file'");
  }
  if (!(file instanceof File)) return badRequest("Lampirkan file XLSX pada field 'file'");
  if (file.size === 0) return badRequest("File kosong (0 KB) — pilih file XLSX yang benar");
  if (file.size > 10 * 1024 * 1024) return badRequest("File terlalu besar (maks. 10 MB)");
  if (!/\.(xlsx|xls)$/i.test(file.name)) return badRequest("Format file harus .xlsx atau .xls");

  let wb: XLSX.WorkBook;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    wb = XLSX.read(buf, { type: "buffer" });
  } catch {
    return badRequest("File tidak dapat dibaca — pastikan berformat XLSX/XLS yang valid");
  }

  const namaSheet = wb.SheetNames[0];
  const sheet = wb.Sheets[namaSheet];
  if (!sheet) return badRequest("File Excel tidak memiliki sheet apa pun");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!rows.length) return badRequest(`Sheet "${namaSheet}" kosong — tidak ada baris data untuk diimpor`);

  // Validasi header: baris pertama harus memuat keempat kolom wajib
  const headerAda = KOLOM_WAJIB.filter((k) => Object.keys(rows[0]).some((rk) => rk.trim().toUpperCase() === k));
  if (headerAda.length < KOLOM_WAJIB.length) {
    const kurang = KOLOM_WAJIB.filter((k) => !headerAda.includes(k));
    return badRequest(`Kolom wajib tidak lengkap: ${kurang.join(", ")}. Header yang diharapkan: ${KOLOM_WAJIB.join(", ")}`);
  }

  // Muat data existing ke memori (kunci: indukId + nama lowercase) agar impor cepat & idempoten
  const [estates, kebuns, afdelings, baraks] = await Promise.all([
    db.estate.findMany(),
    db.kebun.findMany(),
    db.afdeling.findMany(),
    db.barak.findMany(),
  ]);
  const petaEstate = new Map(estates.map((e) => [e.nama.toLowerCase(), e]));
  const petaKebun = new Map(kebuns.map((k) => [`${k.estateId}|${k.nama.toLowerCase()}`, k]));
  const petaAfdeling = new Map(afdelings.map((a) => [`${a.kebunId}|${a.nama.toLowerCase()}`, a]));
  const petaBarak = new Map(baraks.map((b) => [`${b.afdelingId}|${b.nama.toLowerCase()}`, b]));

  const hasil = {
    ok: true as const,
    namaFile: file.name,
    sheet: namaSheet,
    barisTerbaca: rows.length,
    berhasil: 0,
    estateBaru: 0,
    kebunBaru: 0,
    afdelingBaru: 0,
    perumahanBaru: 0,
    dilewati: 0,
    gagal: 0,
    errors: [] as { baris: number; pesan: string }[],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const barisKe = i + 2; // baris 1 = header
    const estateNama = bersih(ambil(row, "ESTATE"));
    const kebunNama = bersih(ambil(row, "KEBUN"));
    const afdNama = bersih(ambil(row, "AFDELING"));
    const perumNama = bersih(ambil(row, "PERUMAHAN"));

    // Baris kosong total → lewati diam-diam
    if (!estateNama && !kebunNama && !afdNama && !perumNama) continue;

    const kurang = [
      !estateNama && "ESTATE", !kebunNama && "KEBUN",
      !afdNama && "AFDELING", !perumNama && "PERUMAHAN",
    ].filter(Boolean) as string[];
    if (kurang.length) {
      hasil.gagal++;
      hasil.errors.push({ baris: barisKe, pesan: `Kolom wajib kosong: ${kurang.join(", ")}` });
      continue;
    }

    try {
      // 1) Estate
      let estate = petaEstate.get(estateNama.toLowerCase());
      if (!estate) {
        estate = await db.estate.create({ data: { id: idBaru("EST"), nama: estateNama } });
        petaEstate.set(estateNama.toLowerCase(), estate);
        hasil.estateBaru++;
      }

      // 2) Kebun
      let kebun = petaKebun.get(`${estate.id}|${kebunNama.toLowerCase()}`);
      if (!kebun) {
        kebun = await db.kebun.create({ data: { id: idBaru("KB"), estateId: estate.id, nama: kebunNama } });
        petaKebun.set(`${estate.id}|${kebunNama.toLowerCase()}`, kebun);
        hasil.kebunBaru++;
      }

      // 3) Afdeling — dibuat tanpa koordinat (koordinat file berlaku untuk Perumahan)
      let afd = petaAfdeling.get(`${kebun.id}|${afdNama.toLowerCase()}`);
      if (!afd) {
        afd = await db.afdeling.create({ data: { id: idBaru("AF"), kebunId: kebun.id, nama: afdNama } });
        petaAfdeling.set(`${kebun.id}|${afdNama.toLowerCase()}`, afd);
        hasil.afdelingBaru++;
      }

      // 4) Perumahan (Barak) — sudah ada → dilewati
      if (petaBarak.has(`${afd.id}|${perumNama.toLowerCase()}`)) {
        hasil.dilewati++;
        continue;
      }
      const kap = angka(ambil(row, "KAPASITAS"));
      // Koordinat opsional: kosong → NULL (tidak lagi meminjam koordinat afdeling)
      const koor = bacaKoordinat(ambil(row, "LAT"), ambil(row, "LNG"));
      if (!koor.ok) {
        hasil.gagal++;
        hasil.errors.push({ baris: barisKe, pesan: koor.error });
        continue;
      }
      const { lat, lng } = koor;
      const dibuat = await db.barak.create({
        data: {
          id: idBaru("B"),
          afdelingId: afd.id,
          nama: perumNama,
          tipe: bersih(ambil(row, "TIPE")) || TIPE_DEFAULT,
          kapasitas: kap && kap >= 1 ? Math.round(kap) : 16,
          lat,
          lng,
        },
      });
      petaBarak.set(`${afd.id}|${perumNama.toLowerCase()}`, dibuat);
      hasil.perumahanBaru++;
      hasil.berhasil++;
    } catch (e) {
      hasil.gagal++;
      hasil.errors.push({ baris: barisKe, pesan: `Gagal memproses: ${(e as Error).message}` });
    }
  }

  if (hasil.errors.length > 10) {
    hasil.errors = [...hasil.errors.slice(0, 10), { baris: 0, pesan: `…dan ${hasil.errors.length - 10} error lainnya` }];
  }

  await db.aksiLog.create({
    data: {
      userId: me.id,
      aktor: me.nama,
      aksi: `Impor XLSX data master "${file.name}": ${hasil.barisTerbaca} baris — ${hasil.perumahanBaru} perumahan, ${hasil.afdelingBaru} afdeling, ${hasil.kebunBaru} kebun, ${hasil.estateBaru} estate baru${hasil.dilewati ? `, ${hasil.dilewati} dilewati` : ""}${hasil.gagal ? `, ${hasil.gagal} gagal` : ""}`,
    },
  });

  return Response.json(hasil);
}
