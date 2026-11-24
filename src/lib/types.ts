// ============================================================
// RumahLayak — Tipe data (skema mengikuti tabel Neon/Postgres)
// ============================================================

export type Mode = "mobile" | "web";

export type MobileScreen =
  | "login"
  | "peta"
  | "inspect-new"
  | "inspect"
  | "inspect-item"
  | "findings"
  | "finding-detail"
  | "history"
  | "data"
  | "guideline"
  | "profile";

export type WebPage = "dashboard" | "rekap" | "peta" | "master" | "users" | "docs";

export type StatusNilai = "H" | "M"; // Hijau (Layak) / Merah (Tidak Layak)

export type SyncStatus = "draft" | "queued" | "synced";

export type Role = "AUDITOR" | "AUDITEE" | "ADMIN";

export type UserStatus = "ACTIVE" | "PENDING" | "REJECTED";

export interface Kartu {
  id: "KMS-01" | "KMS-02" | "KMS-03" | "KMS-04";
  nama: string;
  singkat: string;
  warna: string;
}

export interface ChecklistItem {
  id: string; // contoh: A1, B3, C2, D5
  kartu: Kartu["id"];
  nomor: number;
  label: string;
  standar: string;
}

export interface ApprovalLevel {
  level: 1 | 2 | 3 | 4;
  jalur: string;
  sumberDana: string;
  kategori: string;
  pengaju: string;
  verifikator: string;
  final: string;
  sla: string;
}

export interface Estate {
  id: string;
  nama: string;
}
export interface Kebun {
  id: string;
  estateId: string;
  nama: string;
}
export interface Afdeling {
  id: string;
  kebunId: string;
  nama: string;
  koordinat: { lat: number; lng: number };
}
export interface Barak {
  id: string;
  afdelingId: string;
  nama: string;
  tipe: string;
  kapasitas: number;
  koordinat: { lat: number; lng: number };
}

export interface Foto {
  id: string;
  dataUrl: string;
  lat: number;
  lng: number;
  timestamp: string;
  label: string;
}

export interface ItemResult {
  itemId: string;
  status: StatusNilai | null;
  catatan?: string;
  fotos: Foto[];
}

export interface Inspection {
  id: string;
  kode: string;
  tanggal: string; // ISO date
  minggu: number; // W1..W4
  periode: string; // "November 2026"
  afdelingId: string;
  barakId: string;
  auditorId: string;
  picLabel: string; // EM / GM
  results: ItemResult[];
  sync: SyncStatus;
  kesimpulan?: string;
}

export type FindingStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "VERIFIED"
  | "CLOSED";

export interface FollowUp {
  id: string;
  findingId: string;
  tanggal: string;
  uraian: string;
  fotoUrl?: string;
  olehId: string;
  status: "SUBMITTED" | "VERIFIED";
}

export interface Finding {
  id: string;
  kode: string; // contoh: TND-001
  inspectionId: string;
  barakId: string;
  afdelingId: string;
  itemId: string;
  uraian: string;
  level: 1 | 2 | 3 | 4;
  mitigasiDarurat?: string;
  noWO?: string;
  targetSelesai: string; // ISO date
  status: FindingStatus;
  auditeeId?: string;
  createdAt: string;
  followUps: FollowUp[];
}

export interface AppUser {
  id: string;
  nama: string;
  username: string; // identitas login, tanpa email
  role: Role;
  jabatan: string;
  kebunId?: string;
  afdelingId?: string;
  status: UserStatus;
  createdAt: string;
}

export interface AksiLog {
  id: string;
  waktu: string;
  aktor: string;
  aksi: string;
}

// ---------- Sesi & master data (dari REST API) ----------
export interface SessionUser {
  id: string;
  nama: string;
  username: string; // identitas login, tanpa email
  role: Role;
  jabatan: string;
  kebunId: string | null;
  kebunNama: string | null;
  afdelingId: string | null;
  afdelingNama: string | null;
  bindings: string[]; // multi binding: "Estate / Kebun / Afdeling / Perumahan"
  status: UserStatus;
  createdAt: string;
}

export interface MasterData {
  scopeKebunId: string | null;
  periodeAktif: string;
  estates: Estate[];
  kebuns: Kebun[];
  afdelings: Afdeling[];
  baraks: Barak[];
  kartu: Kartu[];
  checklist: ChecklistItem[];
  matriks: ApprovalLevel[];
  users: AppUser[];
}

export interface DraftTemuan {
  itemId: string;
  uraian: string;
  level: 1 | 2 | 3 | 4;
  mitigasiDarurat?: string;
  noWO?: string;
}
