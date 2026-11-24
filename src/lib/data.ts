// ============================================================
// RumahLayak — Data seed prototipe
// Sumber: file "Projek aplikasi cek perumahan.xlsx"
// (Papan Rekap Kamishibai, Menu Pemeriksaan, Riwayat, Guideline Auditor)
// ============================================================
import type {
  ApprovalLevel,
  AppUser,
  AksiLog,
  Barak,
  ChecklistItem,
  Finding,
  FollowUp,
  Inspection,
  ItemResult,
  Kartu,
  Kebun,
  Afdeling,
  Estate,
  StatusNilai,
} from "./types";

// ---------- Kartu Kamishibai ----------
export const KARTU: Kartu[] = [
  { id: "KMS-01", nama: "A. Kelayakan Hunian", singkat: "Hunian", warna: "#14532D" },
  { id: "KMS-02", nama: "B. Ketersediaan Air Bersih & Sanitasi", singkat: "Air & Sanitasi", warna: "#0E7490" },
  { id: "KMS-03", nama: "C. Kelistrikan, Penerangan & Area Dapur", singkat: "Listrik & Dapur", warna: "#B45309" },
  { id: "KMS-04", nama: "D. Kesehatan (P3K), Pendapatan & Fasilitas Pendukung", singkat: "K3 & Pendukung", warna: "#6D28D9" },
];

export const FOKUS_EMPLASEMEN =
  "Perumahan, Air Bersih & MCK, Listrik, Dapur, K3 & Fasilitas Pendukung";

// ---------- Checklist pemeriksaan (27 item dari Excel) ----------
export const CHECKLIST: ChecklistItem[] = [
  { id: "A1", kartu: "KMS-01", nomor: 1, label: "Kondisi atap", standar: "Atap utuh, tidak bocor, rangka tidak lapuk, penutup rapat." },
  { id: "A2", kartu: "KMS-01", nomor: 2, label: "Kondisi dinding", standar: "Dinding tidak retak/lapuk, tidak bocor, cat terawat." },
  { id: "A3", kartu: "KMS-01", nomor: 3, label: "Kondisi lantai", standar: "Lantai utuh, kering, tidak berlubang, tidak licin." },
  { id: "A4", kartu: "KMS-01", nomor: 4, label: "Pintu", standar: "Pintu utuh, engsel & kunci berfungsi, dapat dikunci." },
  { id: "A5", kartu: "KMS-01", nomor: 5, label: "Jendela", standar: "Jendela utuh, kaca lengkap, buka-tutup lancar." },
  { id: "A6", kartu: "KMS-01", nomor: 6, label: "Ventilasi", standar: "Ventilasi cukup (min. 10% luas lantai), aliran udara baik." },
  { id: "A7", kartu: "KMS-01", nomor: 7, label: "Kapasitas & kepadatan kamar", standar: "Maks. 4 orang/kamar (min. 4 m² per orang), tidak over kapasitas." },
  { id: "A8", kartu: "KMS-01", nomor: 8, label: "Ketersediaan fasilitas penerangan", standar: "Penerangan kamar & area umum berfungsi 100%." },
  { id: "B1", kartu: "KMS-02", nomor: 1, label: "Pasokan & kualitas air bersih", standar: "Air bersih mengalir 24 jam, jernih, tidak berbau." },
  { id: "B2", kartu: "KMS-02", nomor: 2, label: "Kecukupan air minum penghuni", standar: "Air minum tersedia setiap hari (min. 2 L/orang/hari)." },
  { id: "B3", kartu: "KMS-02", nomor: 3, label: "Rasio & kondisi kamar mandi/WC", standar: "Rasio maks. 10 orang/kamar mandi, bersih, tidak berbau." },
  { id: "B4", kartu: "KMS-02", nomor: 4, label: "Saluran pembuangan", standar: "Saluran mengalir, tidak tersumbat, tidak menggenang." },
  { id: "B5", kartu: "KMS-02", nomor: 5, label: "Septic tank", standar: "Septic tank berfungsi, tidak bocor, jarak aman dari sumur/dapur." },
  { id: "C1", kartu: "KMS-03", nomor: 1, label: "Jam nyala", standar: "Listrik menyala min. 18 jam/hari (24 jam bila PLN/genset)." },
  { id: "C2", kartu: "KMS-03", nomor: 2, label: "Kestabilan listrik", standar: "Tegangan stabil, tidak sering padam, genset cadangan siap." },
  { id: "C3", kartu: "KMS-03", nomor: 3, label: "Keamanan instalasi dan stop kontak", standar: "Instalasi tertata, stop kontak aman, kabel tidak menjuntai." },
  { id: "C4", kartu: "KMS-03", nomor: 4, label: "Penerangan jalan & area MCK", standar: "Lampu jalan & area MCK menyala malam hari 100%." },
  { id: "C5", kartu: "KMS-03", nomor: 5, label: "Kelayakan area dapur & tempat masak", standar: "Dapur layak, berventilasi, terpisah dari kamar tidur." },
  { id: "C6", kartu: "KMS-03", nomor: 6, label: "Ketersediaan sembako", standar: "Sembako tersedia (lapak/koperasi) & harga terjangkau." },
  { id: "D1", kartu: "KMS-04", nomor: 1, label: "Ketersediaan obat (P3K)", standar: "Kotak P3K terisi lengkap & dicek bulanan." },
  { id: "D2", kartu: "KMS-04", nomor: 2, label: "APAR emplacement", standar: "APAR tersedia, tekanan normal, diperiksa rutin." },
  { id: "D3", kartu: "KMS-04", nomor: 3, label: "Pendapatan pemanen setiap bulan", standar: "Pendapatan dibayar setiap bulan, slip pembayaran jelas." },
  { id: "D4", kartu: "KMS-04", nomor: 4, label: "Tempat penitipan anak", standar: "TPA tersedia, bersih, diawasi pengasuh." },
  { id: "D5", kartu: "KMS-04", nomor: 5, label: "Ketersediaan AJK pemanen", standar: "AJK pemanen terbentuk & aktif berfungsi." },
  { id: "D6", kartu: "KMS-04", nomor: 6, label: "Ketersediaan AJK anak sekolah", standar: "AJK anak sekolah terbentuk & aktif berfungsi." },
  { id: "D7", kartu: "KMS-04", nomor: 7, label: "Sarana ibadah", standar: "Sarana ibadah tersedia, bersih, terawat." },
  { id: "D8", kartu: "KMS-04", nomor: 8, label: "Pos keamanan", standar: "Pos keamanan berfungsi 24 jam, kartu pengawalan terisi." },
];

// ---------- Matriks approval (Guideline Auditor, Level 1-4) ----------
export const APPROVAL_LEVELS: ApprovalLevel[] = [
  {
    level: 1,
    jalur: "Swakelola Internal",
    sumberDana: "Tanpa biaya / stok gudang kebun",
    kategori: "Perawatan rutin, pembersihan parit/sampah, perapihan kabel, perbaikan ringan dengan material stok gudang kebun.",
    pengaju: "Mandor / Asisten Afdeling",
    verifikator: "KTU / Askep",
    final: "Estate Manager (EM)",
    sla: "1–3 hari kalender (langsung dikerjakan)",
  },
  {
    level: 2,
    jalur: "Swakelola Internal",
    sumberDana: "Budget Opex Kebun",
    kategori: "Perbaikan ringan dengan pembelian material lokal (seng, semen, keran, lampu, kunci, obat P3K) sesuai plafon Opex kebun.",
    pengaju: "Asisten Afdeling / KTU",
    verifikator: "Askep / Bengkel Kebun",
    final: "EM (sesuai limit) / GM Kebun",
    sla: "Maks. 7 hari kalender (tuntas sebelum audit minggu berikutnya)",
  },
  {
    level: 3,
    jalur: "GS Project Pontianak (POU)",
    sumberDana: "Special Opex / R&M",
    kategori: "Perbaikan menengah utilitas & bangunan: ganti rangka atap blok, pompa air utama/tower air, rewiring listrik emplasemen.",
    pengaju: "EM & GM Kebun",
    verifikator: "GS Project / Engineering",
    final: "Region Controller (RC) sesuai limit / Managing Director (MD)",
    sla: "Pengajuan WO/RAB: 3 hari • Eksekusi: 14–30 hari kalender",
  },
  {
    level: 4,
    jalur: "GS Project / Pusat (Corporate)",
    sumberDana: "Budget Capex",
    kategori: "Rehabilitasi berat & pembangunan aset baru: perumahan baru, MCK komunal baru, sumur bor dalam, genset utama, renovasi TPA.",
    pengaju: "GM Kebun & GS Facility",
    verifikator: "Region Controller (RC) & Head of GS Facility",
    final: "Managing Director (MD) / CEO",
    sla: "Pengajuan Capex: 7 hari • Eksekusi: sesuai jadwal proyek (+ wajib mitigasi darurat kebun)",
  },
];

// ---------- Klasifikasi jalur A vs B ----------
export const JALUR_KRITERIA: { aspek: string; jalurA: string; jalurB: string }[] = [
  {
    aspek: "Jenis & skala pekerjaan",
    jalurA: "Perbaikan ringan (minor repair), perawatan rutin, pembersihan lingkungan, penggantian suku cadang standar.",
    jalurB: "Rehabilitasi berat (major repair), pembangunan fasilitas baru, instalasi sistem utilitas utama berkapasitas besar.",
  },
  {
    aspek: "Tenaga kerja & peralatan",
    jalurA: "Tukang kayu/batu kebun, teknisi traksi/bengkel kebun, tim perawatan umum (general worker).",
    jalurB: "Tenaga ahli bersertifikat khusus (MEP/Sipil), kontraktor eksternal, alat berat konstruksi.",
  },
  {
    aspek: "Material & sumber dana",
    jalurA: "Material stok gudang kebun atau beli langsung via Petty Cash / PO lokal (Opex Kebun).",
    jalurB: "Pengadaan barang modal (Capex), tender vendor pusat, pengiriman material khusus dari Kantor Pusat.",
  },
  {
    aspek: "Estimasi waktu (SLA)",
    jalurA: "Cepat: 1–7 hari kalender (wajib tuntas sebelum audit Kamishibai minggu berikutnya).",
    jalurB: "Menengah/panjang: > 7 hari (14–30+ hari) karena perlu survei teknis, RAB, dan pengadaan.",
  },
];

export const JALUR_CONTOH = {
  jalurA: [
    "Tambal atap seng bocor ringan, ganti engsel/kunci pintu & jendela",
    "Ganti keran air, pipa PVC bocor lokal, atau kloset tersumbat",
    "Ganti lampu jalan/MCK putus & rapikan kabel menjuntai",
    "Pembersihan drainase/semak sekitar perumahan & isi ulang kotak P3K",
  ],
  jalurB: [
    "Renovasi total rangka/atap perumahan lapuk atau bangun perumahan baru",
    "Pembuatan sumur bor dalam, instalasi WTP, atau bangun MCK komunal baru",
    "Overhaul/pengadaan genset utama & rewiring jaringan listrik emplasemen",
    "Pengadaan unit APAR baru skala besar atau renovasi total gedung TPA",
  ],
};

export const LANGKAH_AUDITOR = [
  {
    judul: "Langkah 1 — Klasifikasi Jalur & Level",
    isi: "Saat menemukan ketidaksesuaian pada kartu pemeriksaan 1 s.d. 4, auditor langsung menetapkan klasifikasi temuan: Level 1–2 (Swakelola Kebun) atau Level 3–4 (Eskalasi GS Project/Corporate).",
  },
  {
    judul: "Langkah 2 — Instruksi Mitigasi Darurat",
    isi: "Jika temuan masuk Level 3–4 (butuh waktu > 7 hari) namun menyangkut kebutuhan mendesak penghuni (air mati, atap bocor parah, listrik padam), auditor WAJIB menginstruksikan tindakan sementara oleh tim kebun hari itu juga (suplai air tangki, pasang terpal, genset cadangan).",
  },
  {
    judul: "Langkah 3 — Pencatatan di Kartu & Papan",
    isi: "Balik kartu Kamishibai ke posisi MERAH. Catat kode level, PIC penanggung jawab, dan batas waktu penyelesaian di kolom belakang kartu (contoh: \"Lv.2 - Swakelola - App: GM - Target: 25 Nov\" atau \"Lv.3 - GS Project - App: RC - No.WO: 012\").",
  },
  {
    judul: "Langkah 4 — Verifikasi Penutupan (Closing)",
    isi: "Status di Papan Rekap Kamishibai tetap MERAH (M) hingga auditor memverifikasi langsung di lapangan bahwa perbaikan selesai tuntas dan berfungsi normal. Setelah itu kartu boleh dibalik kembali ke HIJAU (H).",
  },
];

// ---------- Master data ----------
export const ESTATES: Estate[] = [{ id: "EST1", nama: "Estate Kalbar 1" }];

export const KEBUNS: Kebun[] = [
  { id: "KB1", estateId: "EST1", nama: "Kebun Mandor" },
  { id: "KB2", estateId: "EST1", nama: "Kebun Sungai Raya" },
];

export const AFDELINGS: Afdeling[] = [
  { id: "AF1", kebunId: "KB1", nama: "Afdeling I", koordinat: { lat: -0.0512, lng: 109.321 } },
  { id: "AF2", kebunId: "KB1", nama: "Afdeling II", koordinat: { lat: -0.0455, lng: 109.3312 } },
  { id: "AF3", kebunId: "KB1", nama: "Afdeling III", koordinat: { lat: -0.0577, lng: 109.3125 } },
  { id: "AF4", kebunId: "KB2", nama: "Afdeling IV", koordinat: { lat: -0.0489, lng: 109.2905 } },
];

export const BARAKS: Barak[] = [
  { id: "B-I1", afdelingId: "AF1", nama: "Perumahan I-1", tipe: "Perumahan", kapasitas: 24, koordinat: { lat: -0.0508, lng: 109.3202 } },
  { id: "B-I2", afdelingId: "AF1", nama: "Perumahan I-2", tipe: "Perumahan", kapasitas: 16, koordinat: { lat: -0.0519, lng: 109.3221 } },
  { id: "B-I3", afdelingId: "AF1", nama: "Perumahan I-3", tipe: "Perumahan", kapasitas: 20, koordinat: { lat: -0.0501, lng: 109.3224 } },
  { id: "B-II1", afdelingId: "AF2", nama: "Perumahan II-1", tipe: "Perumahan", kapasitas: 20, koordinat: { lat: -0.0451, lng: 109.3306 } },
  { id: "B-II2", afdelingId: "AF2", nama: "Perumahan II-2", tipe: "Perumahan", kapasitas: 18, koordinat: { lat: -0.0461, lng: 109.3319 } },
  { id: "B-III1", afdelingId: "AF3", nama: "Perumahan III-1", tipe: "Perumahan", kapasitas: 22, koordinat: { lat: -0.0571, lng: 109.3119 } },
  { id: "B-III2", afdelingId: "AF3", nama: "Perumahan III-2", tipe: "Perumahan", kapasitas: 18, koordinat: { lat: -0.0583, lng: 109.3131 } },
  { id: "B-III3", afdelingId: "AF3", nama: "Perumahan III-3", tipe: "Perumahan", kapasitas: 16, koordinat: { lat: -0.0566, lng: 109.3138 } },
  { id: "B-IV1", afdelingId: "AF4", nama: "Perumahan IV-1", tipe: "Perumahan", kapasitas: 20, koordinat: { lat: -0.0485, lng: 109.2898 } },
];

// ---------- Pengguna ----------
export const USERS: AppUser[] = [
  { id: "u1", nama: "Budi Santoso", username: "budi", role: "AUDITOR", jabatan: "Estate Manager (EM)", kebunId: "KB1", status: "ACTIVE", createdAt: "2026-10-01T08:00:00" },
  { id: "u2", nama: "Rina Kartika", username: "rina", role: "AUDITOR", jabatan: "General Manager (GM) Kebun", kebunId: "KB1", status: "ACTIVE", createdAt: "2026-10-01T08:05:00" },
  { id: "u3", nama: "Ahmad Fauzi", username: "fauzi", role: "AUDITEE", jabatan: "Asisten Afdeling I", kebunId: "KB1", afdelingId: "AF1", status: "ACTIVE", createdAt: "2026-10-02T09:00:00" },
  { id: "u4", nama: "Siti Rahma", username: "siti", role: "AUDITEE", jabatan: "KTU Kebun Mandor", kebunId: "KB1", status: "ACTIVE", createdAt: "2026-10-02T09:10:00" },
  { id: "u5", nama: "Hendra Wijaya", username: "hendra", role: "ADMIN", jabatan: "IT Corporate", status: "ACTIVE", createdAt: "2026-09-28T10:00:00" },
  { id: "u6", nama: "Dewi Lestari", username: "dewi", role: "AUDITEE", jabatan: "Asisten Afdeling II", kebunId: "KB1", afdelingId: "AF2", status: "PENDING", createdAt: "2026-11-21T14:00:00" },
  { id: "u7", nama: "Joko Pramono", username: "joko", role: "AUDITOR", jabatan: "Asisten Afdeling III (auditor pendamping)", kebunId: "KB1", afdelingId: "AF3", status: "PENDING", createdAt: "2026-11-22T09:30:00" },
  { id: "u8", nama: "Maria Ulfa", username: "maria", role: "AUDITEE", jabatan: "Mandor Afdeling I", kebunId: "KB1", afdelingId: "AF1", status: "PENDING", createdAt: "2026-11-22T16:45:00" },
];

// ---------- Binding multi-level user (checkbox pendaftaran admin) ----------
// Boleh lebih dari satu baris per user — contoh "dewi" terikat 2 unit.
// Resolusi hierarki ada di src/lib/scope.ts (estate -> kebun -> afdeling -> perumahan).
export const USER_BINDINGS: { username: string; estateId?: string; kebunId?: string; afdelingId?: string; barakId?: string }[] = [
  { username: "budi", kebunId: "KB1" }, // auditor EM — seluruh afdeling Kebun Mandor
  { username: "rina", kebunId: "KB1" },
  { username: "fauzi", kebunId: "KB1", afdelingId: "AF1" },
  { username: "siti", kebunId: "KB1" },
  { username: "dewi", kebunId: "KB1", afdelingId: "AF2" },
  { username: "dewi", kebunId: "KB2", afdelingId: "AF4" }, // contoh multi binding
  { username: "joko", kebunId: "KB1", afdelingId: "AF3" },
  { username: "maria", kebunId: "KB1", afdelingId: "AF1" },
  // hendra (ADMIN corporate) — sengaja tanpa binding
];

// ---------- Placeholder foto (SVG) ----------
export function fotoSvg(judul: string, sub: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="360" viewBox="0 0 560 360">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#35594a"/><stop offset="0.55" stop-color="#1e3d2e"/><stop offset="1" stop-color="#132a1f"/>
  </linearGradient></defs>
  <rect width="560" height="360" fill="url(#g)"/>
  <circle cx="470" cy="70" r="34" fill="#d4af37" opacity="0.85"/>
  <rect x="150" y="150" width="260" height="120" fill="#0b1f16" opacity="0.8"/>
  <path d="M138 152 L280 78 L422 152 Z" fill="#132a1f" opacity="0.9"/>
  <rect x="264" y="196" width="34" height="74" fill="#d4af37" opacity="0.55"/>
  <rect x="188" y="180" width="46" height="46" fill="#8fb996" opacity="0.35"/>
  <rect x="330" y="180" width="46" height="46" fill="#8fb996" opacity="0.35"/>
  <text x="280" y="318" text-anchor="middle" font-family="Arial" font-size="17" font-weight="bold" fill="#ffffff">RUMAHLAYAK • FOTO AUDIT</text>
  <text x="280" y="340" text-anchor="middle" font-family="Arial" font-size="12" fill="#d4af37">${judul} • ${sub}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ---------- Pemeriksaan (replikasi Papan Rekap Kamishibai Excel) ----------
const PERIODE = "November 2026";

function resultsFor(spesial: Record<string, { status: StatusNilai; catatan?: string; foto?: string }>): ItemResult[] {
  return CHECKLIST.map((it) => {
    const o = spesial[it.id];
    return {
      itemId: it.id,
      status: o ? o.status : "H",
      catatan: o?.catatan,
      fotos: o?.foto ? [{ id: `${it.id}-f1`, dataUrl: o.foto, lat: 0, lng: 0, timestamp: "", label: `Foto temuan ${it.id}` }] : [],
    };
  });
}

export function buildInspections(): Inspection[] {
  const f1 = fotoSvg("A1 Atap", "Perumahan I-1 • -0.0508, 109.3202 • 02 Nov 2026");
  const f2 = fotoSvg("B1 Air", "Perumahan I-2 • -0.0519, 109.3221 • 02 Nov 2026");
  const f3 = fotoSvg("C3 Instalasi", "Perumahan II-1 • -0.0451, 109.3306 • 09 Nov 2026");
  const f4 = fotoSvg("C4 Lampu MCK", "Perumahan I-3 • -0.0501, 109.3224 • 16 Nov 2026");
  const f5 = fotoSvg("A4 Pintu", "Perumahan III-1 • -0.0571, 109.3119 • 16 Nov 2026");
  const f6 = fotoSvg("B2 Air Minum", "Perumahan III-2 • -0.0583, 109.3131 • 23 Nov 2026");
  const f7 = fotoSvg("D1 P3K", "Perumahan I-1 • -0.0508, 109.3202 • 23 Nov 2026");

  const base: Omit<Inspection, "results" | "sync">[] = [
    { id: "i1", kode: "PRM-W1-01", tanggal: "2026-11-02", minggu: 1, periode: PERIODE, afdelingId: "AF1", barakId: "B-I1", auditorId: "u1", picLabel: "EM", kesimpulan: "Atap blok tengah perlu eskalasi GS Project. Aspek lain baik." },
    { id: "i2", kode: "PRM-W1-02", tanggal: "2026-11-02", minggu: 1, periode: PERIODE, afdelingId: "AF1", barakId: "B-I2", auditorId: "u2", picLabel: "GM", kesimpulan: "Air bersih kurang stabil pagi hari; perbaikan swakelola Lv.2." },
    { id: "i3", kode: "PRM-W2-01", tanggal: "2026-11-09", minggu: 2, periode: PERIODE, afdelingId: "AF2", barakId: "B-II1", auditorId: "u1", picLabel: "EM", kesimpulan: "Instalasi listrik tidak aman pada 3 kamar; sudah disubmit auditee." },
    { id: "i4", kode: "PRM-W2-02", tanggal: "2026-11-09", minggu: 2, periode: PERIODE, afdelingId: "AF2", barakId: "B-II2", auditorId: "u2", picLabel: "GM", kesimpulan: "Semua aspek baik. Perumahan model terbaru, sanitasi memadai." },
    { id: "i5", kode: "PRM-W3-01", tanggal: "2026-11-16", minggu: 3, periode: PERIODE, afdelingId: "AF1", barakId: "B-I3", auditorId: "u1", picLabel: "EM", kesimpulan: "Penerangan area MCK mati; perbaikan swakelola Lv.1 berjalan." },
    { id: "i6", kode: "PRM-W3-02", tanggal: "2026-11-16", minggu: 3, periode: PERIODE, afdelingId: "AF3", barakId: "B-III1", auditorId: "u2", picLabel: "GM", kesimpulan: "Pintu kamar rusak; belum ada tindak lanjut auditee." },
    { id: "i7", kode: "PRM-W4-01", tanggal: "2026-11-23", minggu: 4, periode: PERIODE, afdelingId: "AF3", barakId: "B-III2", auditorId: "u1", picLabel: "EM", kesimpulan: "Air minum penghuni kosong 2 hari — mitigasi darurat diinstruksikan." },
    { id: "i8", kode: "PRM-W4-02", tanggal: "2026-11-23", minggu: 4, periode: PERIODE, afdelingId: "AF1", barakId: "B-I1", auditorId: "u2", picLabel: "GM", kesimpulan: "Re-audit W4: hunian kembali hijau, P3K kosong perlu pengisian." },
  ];

  const map: Record<string, Record<string, { status: StatusNilai; catatan?: string; foto?: string }>> = {
    i1: {
      A1: { status: "M", catatan: "Rangka atap blok tengah lapuk, bocor pada 4 titik saat hujan.", foto: f1 },
      A2: { status: "H", catatan: "Dinding bagian belakang mulai pudar, masih layak." },
    },
    i2: {
      B1: { status: "M", catatan: "Keran tangki utama bocor, tekanan air rendah pagi hari.", foto: f2 },
      B2: { status: "H", catatan: "Air minum tersedia via galon lapak." },
    },
    i3: {
      C3: { status: "M", catatan: "Kabel instalasi kamar 3–5 menjuntai tanpa pelindung, stop kontak longgar.", foto: f3 },
    },
    i4: {},
    i5: {
      C4: { status: "M", catatan: "Lampu jalan area MCK mati, area gelap total malam hari.", foto: f4 },
    },
    i6: {
      A4: { status: "M", catatan: "Pintu kamar 2 rusak: engsel lepas, daun pintu menyentuh lantai.", foto: f5 },
      A5: { status: "H", catatan: "Jendela kamar 2 kaca retak tipis, masih aman." },
    },
    i7: {
      B2: { status: "M", catatan: "Tangki air minum kering 2 hari, penghuni tanpa air minum.", foto: f6 },
      B1: { status: "H", catatan: "Air bersih keran masih mengalir normal." },
    },
    i8: {
      D1: { status: "M", catatan: "Kotak P3K perumahan kosong, tidak ada obat cadangan.", foto: f7 },
      A1: { status: "H", catatan: "Perbaikan atap (TND-001) sudah selesai, tidak ada bocor baru." },
    },
  };

  const insp: Inspection[] = base.map((b) => ({
    ...b,
    results: resultsFor(map[b.id] ?? {}),
    sync: "synced",
  }));

  // Kartu terjadwal (baris kosong pada papan Excel): belum diperiksa
  const kosong = CHECKLIST.map((it) => ({ itemId: it.id, status: null, fotos: [] }));
  insp.push(
    { id: "i9", kode: "PRM-W4-03", tanggal: "2026-11-23", minggu: 4, periode: PERIODE, afdelingId: "AF3", barakId: "B-III3", auditorId: "u1", picLabel: "EM", results: kosong.map((r) => ({ ...r })), sync: "draft", kesimpulan: undefined },
    { id: "i10", kode: "PRM-W4-04", tanggal: "2026-11-23", minggu: 4, periode: PERIODE, afdelingId: "AF2", barakId: "B-II1", auditorId: "u2", picLabel: "GM", results: kosong.map((r) => ({ ...r })), sync: "draft", kesimpulan: undefined },
  );
  return insp;
}

// ---------- Temuan & follow-up ----------
export function buildFindings(): Finding[] {
  const fu1: FollowUp[] = [
    { id: "fu1", findingId: "tnd1", tanggal: "2026-11-13", uraian: "Perbaikan rangka & penutup atap blok tengah selesai oleh tim GS Project Pontianak. WO-012 dikerjakan 3 hari, cek bocor saat hujan tidak ada rembes.", fotoUrl: fotoSvg("BUKTI PERBAIKAN • TND-001", "Atap blok tengah • 13 Nov 2026 • Ahmad Fauzi"), olehId: "u3", status: "SUBMITTED" },
    { id: "fu2", findingId: "tnd1", tanggal: "2026-11-16", uraian: "Verifikasi langsung di lapangan: atap rapat, tidak ada titik bocor. Kartu Perumahan I-1 dibalik kembali ke HIJAU.", fotoUrl: fotoSvg("VERIFIKASI LAPANGAN • TND-001", "Perumahan I-1 • 16 Nov 2026 • Budi Santoso"), olehId: "u1", status: "VERIFIED" },
  ];
  const fu2: FollowUp[] = [
    { id: "fu3", findingId: "tnd2", tanggal: "2026-11-06", uraian: "Keran tangki utama diganti baru (stok gudang kebun) + seal flensa. Tekanan air pagi normal kembali.", fotoUrl: fotoSvg("BUKTI PERBAIKAN • TND-002", "Tangki utama Perumahan I-2 • 06 Nov 2026 • Ahmad Fauzi"), olehId: "u3", status: "VERIFIED" },
  ];
  const fu4: FollowUp[] = [
    { id: "fu4", findingId: "tnd3", tanggal: "2026-11-21", uraian: "Kabel dipasang dalam pipa conduit, stop kontak kamar 3–5 diganti + dipasang grounding. Bukti sebelum/sesudah dilampirkan.", fotoUrl: fotoSvg("BUKTI PERBAIKAN • TND-003", "Instalasi Perumahan II-1 • 21 Nov 2026 • Siti Rahma"), olehId: "u4", status: "SUBMITTED" },
  ];

  return [
    { id: "tnd1", kode: "TND-001", inspectionId: "i1", barakId: "B-I1", afdelingId: "AF1", itemId: "A1", uraian: "Rangka atap blok tengah lapuk, bocor pada 4 titik saat hujan. Perlu penggantian rangka blok oleh tim teknis.", level: 3, noWO: "WO-012", targetSelesai: "2026-11-30", status: "CLOSED", auditeeId: "u3", createdAt: "2026-11-02T10:30:00", followUps: fu1 },
    { id: "tnd2", kode: "TND-002", inspectionId: "i2", barakId: "B-I2", afdelingId: "AF1", itemId: "B1", uraian: "Keran tangki utama bocor, tekanan air rendah pada pagi hari.", level: 2, targetSelesai: "2026-11-09", status: "VERIFIED", auditeeId: "u3", createdAt: "2026-11-02T11:15:00", followUps: fu2 },
    { id: "tnd3", kode: "TND-003", inspectionId: "i3", barakId: "B-II1", afdelingId: "AF2", itemId: "C3", uraian: "Kabel instalasi kamar 3–5 menjuntai tanpa pelindung, stop kontak longgar — risiko sengatan listrik.", level: 2, targetSelesai: "2026-11-16", status: "SUBMITTED", auditeeId: "u4", createdAt: "2026-11-09T09:20:00", followUps: fu4 },
    { id: "tnd4", kode: "TND-004", inspectionId: "i5", barakId: "B-I3", afdelingId: "AF1", itemId: "C4", uraian: "Lampu jalan area MCK mati, area gelap total pada malam hari.", level: 1, targetSelesai: "2026-11-19", status: "IN_PROGRESS", auditeeId: "u3", createdAt: "2026-11-16T10:05:00", followUps: [] },
    { id: "tnd5", kode: "TND-005", inspectionId: "i6", barakId: "B-III1", afdelingId: "AF3", itemId: "A4", uraian: "Pintu kamar 2 rusak: engsel lepas, daun pintu menyentuh lantai.", level: 1, targetSelesai: "2026-11-19", status: "OPEN", auditeeId: "u4", createdAt: "2026-11-16T11:40:00", followUps: [] },
    { id: "tnd6", kode: "TND-006", inspectionId: "i7", barakId: "B-III2", afdelingId: "AF3", itemId: "B2", uraian: "Tangki air minum kering 2 hari — penghuni tidak memiliki air minum. Butuh sumur bor/tangki besar (eskalasi).", level: 3, mitigasiDarurat: "Suplai air tangki mobil 2.000 L hari itu juga + larangan memakai air keran untuk konsumsi sampai tangki terisi.", targetSelesai: "2026-12-07", status: "OPEN", auditeeId: "u4", createdAt: "2026-11-23T08:40:00", followUps: [] },
    { id: "tnd7", kode: "TND-007", inspectionId: "i8", barakId: "B-I1", afdelingId: "AF1", itemId: "D1", uraian: "Kotak P3K perumahan kosong, tidak ada obat cadangan sejak audit terakhir.", level: 2, targetSelesai: "2026-11-30", status: "OPEN", auditeeId: "u3", createdAt: "2026-11-23T09:10:00", followUps: [] },
  ];
}

// ---------- Log aktivitas ----------
export function buildAksiLog(): AksiLog[] {
  return [
    { id: "a1", waktu: "2026-11-23T09:12:00", aktor: "Siti Rahma", aksi: "Melampirkan bukti perbaikan TND-003 (instalasi listrik Perumahan II-1)" },
    { id: "a2", waktu: "2026-11-23T08:05:00", aktor: "Budi Santoso", aksi: "Pemeriksaan PRM-W4-01 Perumahan III-2 (Minggu 4) — 1 kartu MERAH" },
    { id: "a3", waktu: "2026-11-22T16:45:00", aktor: "Maria Ulfa", aksi: "Mendaftar sebagai AUDITEE — menunggu persetujuan admin" },
    { id: "a4", waktu: "2026-11-16T11:30:00", aktor: "Budi Santoso", aksi: "Verifikasi lapangan TND-001 — kartu Hunian Perumahan I-1 kembali HIJAU" },
    { id: "a5", waktu: "2026-11-09T10:15:00", aktor: "Rina Kartika", aksi: "Menetapkan jalur Swakelola Lv.2 untuk temuan TND-002" },
  ];
}

export const SEED_SYNC_LOG = [
  "Menghubungkan ke server (Vercel API → Neon Postgres)...",
  "Memverifikasi konfigurasi & kredensial perangkat...",
  "Mengunggah 1 pemeriksaan baru + 2 foto tergeotag...",
  "Mengunggah 1 follow-up auditee...",
  "Mengunduh master data terbaru (perumahan, checklist, user)...",
  "Sinkronisasi selesai — data lokal & server identik.",
];
