"use client";
import type { Finding, Inspection, StatusNilai } from "./types";
import { KARTU } from "./data";

// ---------- Format ----------
export function fmtTanggal(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00+07:00` : iso);
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(d);
}
export function fmtTanggalWaktu(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(d).replace(".", ":");
}
export function fmtKoor(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// ---------- Nama perumahan singkat (tanpa prefix afdeling) ----------
// Setelah afdeling dipilih, "Perumahan III-1" cukup tampil "Perumahan 1".
export function namaBarakSingkat(namaBarak: string, namaAfdeling?: string | null): string {
  const roman = namaAfdeling?.match(/Afdeling\s+([IVXLCDM]+)/i)?.[1];
  let out = namaBarak;
  if (roman) {
    out = out.replace(new RegExp(`\\b${roman}\\s*-\\s*`, "i"), "");
  } else {
    out = out.replace(/\b[IVXLCDM]{1,4}\s*-\s*/, "");
  }
  return out.trim() || namaBarak;
}

// ---------- Ringkasan binding user (bisa lebih dari satu unit) ----------
// "Estate Kalbar 1 / Kebun Mandor / Afdeling I" tampil ringkas "Kebun Mandor / Afdeling I".
export function ringkasBinding(bindings: string[] | undefined | null, fallback = "Corporate"): string {
  if (!bindings || bindings.length === 0) return fallback;
  return bindings.map((b) => b.split(" / ").slice(-2).join(" / ")).join(" • ");
}

// ---------- Status kartu ----------
const kartuPrefix: Record<string, string> = { "KMS-01": "A", "KMS-02": "B", "KMS-03": "C", "KMS-04": "D" };
export function kartuStatus(insp: Inspection, kartuId: string): StatusNilai | "-" {
  const prefix = kartuPrefix[kartuId] ?? "A";
  const items = insp.results.filter((r) => r.itemId.startsWith(prefix));
  if (!items.length || items.every((r) => r.status === null)) return "-";
  return items.some((r) => r.status === "M") ? "M" : "H";
}
const kartuIdByPrefix: Record<string, string> = { A: "KMS-01", B: "KMS-02", C: "KMS-03", D: "KMS-04" };
export function prefixKartu(itemId: string) {
  return kartuIdByPrefix[itemId[0]] ?? "KMS-01";
}

// ---------- Papan Kamishibai ----------
export interface PapanRow {
  id: string;
  kode: string;
  minggu: number;
  pic: string;
  auditor: string;
  barak: string;
  afdeling: string;
  status: Record<string, StatusNilai | "-">;
  h: number;
  m: number;
  pct: number | null;
  fokus: string;
}

export function hitungPapan(inspections: Inspection[], namaAuditor: (id: string) => string, namaBarak: (id: string) => string, namaAfd: (id: string) => string, periode = "November 2026"): PapanRow[] {
  return inspections
    .filter((i) => i.periode === periode)
    .sort((a, b) => a.minggu - b.minggu || a.kode.localeCompare(b.kode))
    .map((i) => {
      const status: Record<string, StatusNilai | "-"> = {};
      let h = 0;
      let m = 0;
      let kosong = 0;
      KARTU.forEach((k) => {
        const st = kartuStatus(i, k.id);
        status[k.id] = st;
        if (st === "H") h++;
        else if (st === "M") m++;
        else kosong++;
      });
      const dinilai = h + m;
      return {
        id: i.id,
        kode: i.kode,
        minggu: i.minggu,
        pic: i.picLabel,
        auditor: namaAuditor(i.auditorId),
        barak: namaBarak(i.barakId),
        afdeling: namaAfd(i.afdelingId),
        status,
        h,
        m,
        pct: dinilai ? Math.round((h / dinilai) * 1000) / 10 : null,
        fokus: kosong > 0 ? "Terjadwal" : "Perumahan, Air Bersih & MCK, Listrik, Dapur, K3 & Fasilitas Pendukung",
      };
    });
}

export function tingkatPemenuhan(rows: PapanRow[]) {
  const perKartu: Record<string, { h: number; m: number }> = {};
  KARTU.forEach((k) => (perKartu[k.id] = { h: 0, m: 0 }));
  rows.forEach((r) => {
    KARTU.forEach((k) => {
      const st = r.status[k.id];
      if (st === "H") perKartu[k.id].h++;
      else if (st === "M") perKartu[k.id].m++;
    });
  });
  const totalH = Object.values(perKartu).reduce((a, v) => a + v.h, 0);
  const totalM = Object.values(perKartu).reduce((a, v) => a + v.m, 0);
  const total = totalH + totalM;
  return {
    perKartu,
    totalH,
    totalM,
    pct: total ? Math.round((totalH / total) * 1000) / 10 : 0,
  };
}

// ---------- Statistik dashboard ----------
export function statDashboard(inspections: Inspection[], findings: Finding[]) {
  const rows = inspections.filter((i) => i.results.some((r) => r.status !== null));
  // Level kartu (persis Papan Rekap Kamishibai Excel: H/M per kartu per minggu)
  let kartuH = 0;
  let kartuM = 0;
  rows.forEach((i) => {
    KARTU.forEach((k) => {
      const st = kartuStatus(i, k.id);
      if (st === "H") kartuH++;
      else if (st === "M") kartuM++;
    });
  });
  // Level item (27 item per pemeriksaan)
  let h = 0;
  let m = 0;
  rows.forEach((i) => {
    i.results.forEach((r) => {
      if (r.status === "H") h++;
      if (r.status === "M") m++;
    });
  });
  const dinilai = h + m;
  const terbuka = findings.filter((f) => f.status === "OPEN" || f.status === "IN_PROGRESS" || f.status === "SUBMITTED");
  const today = new Date();
  const overdue = terbuka.filter((f) => new Date(`${f.targetSelesai}T00:00:00+07:00`) < today);
  const byLevel = [1, 2, 3, 4].map((lv) => ({ level: lv, jumlah: findings.filter((f) => f.level === lv).length }));
  const tren = [1, 2, 3, 4].map((w) => {
    const wk = rows.filter((i) => i.minggu === w);
    let kh = 0;
    let km = 0;
    wk.forEach((i) =>
      KARTU.forEach((k) => {
        const st = kartuStatus(i, k.id);
        if (st === "H") kh++;
        else if (st === "M") km++;
      }),
    );
    const t = kh + km;
    return { minggu: `W${w}`, pct: t ? Math.round((kh / t) * 100) : 0, temuan: km };
  });
  const perAfd = [...new Set(rows.map((i) => i.afdelingId))].map((af) => {
    const list = rows.filter((i) => i.afdelingId === af);
    let ah = 0;
    let am = 0;
    list.forEach((i) => i.results.forEach((r) => (r.status === "H" ? ah++ : r.status === "M" ? am++ : null)));
    const t = ah + am;
    return { afdeling: af, pct: t ? Math.round((ah / t) * 100) : 0, temuan: am };
  });
  return {
    pctKelayakan: kartuH + kartuM ? Math.round((kartuH / (kartuH + kartuM)) * 1000) / 10 : 0,
    kartuH,
    kartuM,
    itemH: h,
    itemM: m,
    totalInspeksi: inspections.length,
    selesai: rows.length,
    temuanTerbuka: terbuka.length,
    temuanOverdue: overdue.length,
    temuanClosed: findings.filter((f) => f.status === "CLOSED").length,
    byLevel,
    tren,
    perAfd,
  };
}

// ---------- Foto simulasi (canvas) ----------
export function generateFotoCanvas(judul: string, sub: string): string {
  const W = 640;
  const H = 420;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#6f9e88");
  sky.addColorStop(0.5, "#3e6d55");
  sky.addColorStop(1, "#1d3a2b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // matahari
  ctx.beginPath();
  ctx.arc(W - 110, 80, 36, 0, Math.PI * 2);
  ctx.fillStyle = "#d4af37";
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
  // bangunan perumahan
  ctx.fillStyle = "#132a1f";
  ctx.beginPath();
  ctx.moveTo(150, 240);
  ctx.lineTo(320, 130);
  ctx.lineTo(490, 240);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0b1f16";
  ctx.fillRect(170, 240, 300, 110);
  ctx.fillStyle = "#8fb996";
  ctx.globalAlpha = 0.5;
  ctx.fillRect(205, 262, 52, 44);
  ctx.fillRect(382, 262, 52, 44);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#d4af37";
  ctx.globalAlpha = 0.5;
  ctx.fillRect(308, 262, 26, 88);
  ctx.globalAlpha = 1;
  // band bawah (watermark)
  ctx.fillStyle = "rgba(6, 20, 13, 0.88)";
  ctx.fillRect(0, H - 74, W, 74);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 19px Arial";
  ctx.fillText("RUMAHLAYAK  •  FOTO AUDIT TERGEOTAG", 20, H - 46);
  ctx.fillStyle = "#d4af37";
  ctx.font = "14px Arial";
  ctx.fillText(`${judul}  |  ${sub}`, 20, H - 20);
  return c.toDataURL("image/jpeg", 0.72);
}

// ---------- Ekspor ----------
export async function exportXlsx(rows: PapanRow[], inspections: Inspection[], findings: Finding[], users: { nama: string; username: string; role: string; jabatan: string; status: string }[], namaAuditor: (id: string) => string, namaBarak: (id: string) => string, namaAfd: (id: string) => string, labelItem: (id: string) => string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Sheet 1: Papan Kamishibai
  const papan: (string | number)[][] = [
    ["PAPAN REKAP KAMISHIBAI — EMPLASEMEN PERUMAHAN (November 2026)"],
    ["Kode", "Minggu", "PIC", "Auditor", "Afdeling", "Perumahan", "Hunian", "Air & Sanitasi", "Listrik & Dapur", "K3 & Pendukung", "Total H", "Total M", "% Kelayakan", "Fokus"],
    ...rows.map((r) => [r.kode, `W${r.minggu}`, r.pic, r.auditor, r.afdeling, r.barak, r.status["KMS-01"], r.status["KMS-02"], r.status["KMS-03"], r.status["KMS-04"], r.h, r.m, r.pct === null ? "-" : `${r.pct}%`, r.fokus]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(papan), "Papan Kamishibai");

  // Sheet 2: Riwayat pemeriksaan item
  const riwayat: (string)[][] = [
    ["Tanggal", "Kode Pemeriksaan", "Minggu", "Afdeling", "Perumahan", "Auditor", "Item Periksa", "Kartu", "Status (H/M)", "Catatan", "Jumlah Foto", "Sync"],
    ...inspections.flatMap((i) =>
      i.results
        .filter((r) => r.status !== null)
        .map((r) => [
          fmtTanggal(i.tanggal),
          i.kode,
          `W${i.minggu}`,
          namaAfd(i.afdelingId),
          namaBarak(i.barakId),
          namaAuditor(i.auditorId),
          labelItem(r.itemId),
          prefixKartu(r.itemId),
          r.status ?? "-",
          r.catatan ?? "",
          String(r.fotos.length),
          i.sync.toUpperCase(),
        ]),
    ),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(riwayat), "Riwayat Pemeriksaan");

  // Sheet 3: Temuan & tindak lanjut
  const temuan: (string)[][] = [
    ["Kode", "Tanggal", "Afdeling", "Perumahan", "Item", "Uraian Temuan", "Level Approval", "Jalur", "Target Selesai (SLA)", "Status", "Mitigasi Darurat", "No. WO", "Jumlah Follow-up"],
    ...findings.map((f) => [
      f.kode,
      fmtTanggal(f.createdAt),
      namaAfd(f.afdelingId),
      namaBarak(f.barakId),
      labelItem(f.itemId),
      f.uraian,
      `Level ${f.level}`,
      f.level <= 2 ? "A - Swakelola Kebun" : "B - GS Project/Corporate",
      fmtTanggal(f.targetSelesai),
      f.status,
      f.mitigasiDarurat ?? "",
      f.noWO ?? "",
      String(f.followUps.length),
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(temuan), "Temuan & Follow-up");

  // Sheet 4: Pengguna
  const usr: string[][] = [
    ["Nama", "Nama Pengguna", "Role", "Jabatan", "Status"],
    ...users.map((u) => [u.nama, u.username, u.role, u.jabatan, u.status]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(usr), "Pengguna");

  XLSX.writeFile(wb, `RumahLayak_Kamishibai_Nov2026.xlsx`);
}

export function exportJson(payload: unknown, filename = "RumahLayak_data_Nov2026.json") {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function unduhFile(blobUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
}
