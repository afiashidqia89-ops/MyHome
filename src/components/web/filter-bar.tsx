"use client";
// ============================================================
// RumahLayak — Filter wilayah (Estate/Area → Kebun → Afdeling)
// & filter rentang tanggal untuk portal web.
// Pilihan wilayah otomatis mengikuti binding akun: master data
// dari server hanya berisi unit tempat user didaftarkan
// (lihat src/app/api/master-data + src/lib/scope.ts).
// ADMIN tanpa binding menerima seluruh unit → bisa memilih semua.
// ============================================================
import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface FilterWilayahValue {
  estateId: string | null;
  kebunId: string | null;
  afdelingId: string | null;
}

export function FilterWilayah({ value, onChange }: { value: FilterWilayahValue; onChange: (v: FilterWilayahValue) => void }) {
  const { master } = useStore();

  const kebuns = (master?.kebuns ?? []).filter((k) => !value.estateId || k.estateId === value.estateId);
  const afdelings = (master?.afdelings ?? []).filter((a) => !value.kebunId || a.kebunId === value.kebunId);

  const ganti = (bagian: Partial<FilterWilayahValue>) => {
    const berikut = { ...value, ...bagian };
    // Reset anak bila induk berubah (kaskade: estate -> kebun -> afdeling)
    if ("estateId" in bagian) {
      berikut.kebunId = null;
      berikut.afdelingId = null;
    } else if ("kebunId" in bagian) {
      berikut.afdelingId = null;
    }
    onChange(berikut);
  };

  const bisaReset = value.estateId || value.kebunId || value.afdelingId;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[170px]">
        <Label className="mb-1 text-[10px] font-bold uppercase text-slate-400">Estate (Area)</Label>
        <Select
          value={value.estateId ?? "SEMUA"}
          onValueChange={(v) => ganti({ estateId: v === "SEMUA" ? null : v })}
        >
          <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="SEMUA">Semua estate</SelectItem>
            {(master?.estates ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.nama}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-[170px]">
        <Label className="mb-1 text-[10px] font-bold uppercase text-slate-400">Kebun</Label>
        <Select
          value={value.kebunId ?? "SEMUA"}
          onValueChange={(v) => ganti({ kebunId: v === "SEMUA" ? null : v })}
        >
          <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="SEMUA">Semua kebun</SelectItem>
            {kebuns.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-[170px]">
        <Label className="mb-1 text-[10px] font-bold uppercase text-slate-400">Afdeling</Label>
        <Select
          value={value.afdelingId ?? "SEMUA"}
          onValueChange={(v) => ganti({ afdelingId: v === "SEMUA" ? null : v })}
        >
          <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="SEMUA">Semua afdeling</SelectItem>
            {afdelings.map((a) => <SelectItem key={a.id} value={a.id}>{a.nama}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {bisaReset ? (
        <Button variant="outline" onClick={() => onChange({ estateId: null, kebunId: null, afdelingId: null })} className="h-9 px-3 text-[11px]">
          <X className="mr-1 h-3.5 w-3.5" /> Reset wilayah
        </Button>
      ) : null}
    </div>
  );
}

export interface FilterTanggalValue {
  dari: string; // ISO date (YYYY-MM-DD) atau ""
  sampai: string;
}

/** Filter rentang tanggal pemeriksaan (kolom tanggal inspeksi). */
export function FilterTanggal({ value, onChange }: { value: FilterTanggalValue; onChange: (v: FilterTanggalValue) => void }) {
  const aktif = value.dari || value.sampai;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <Label className="mb-1 text-[10px] font-bold uppercase text-slate-400">Dari Tanggal</Label>
        <Input
          type="date"
          value={value.dari}
          max={value.sampai || undefined}
          onChange={(e) => onChange({ ...value, dari: e.target.value })}
          className="h-9 w-[150px] text-[12px]"
        />
      </div>
      <div>
        <Label className="mb-1 text-[10px] font-bold uppercase text-slate-400">Sampai Tanggal</Label>
        <Input
          type="date"
          value={value.sampai}
          min={value.dari || undefined}
          onChange={(e) => onChange({ ...value, sampai: e.target.value })}
          className="h-9 w-[150px] text-[12px]"
        />
      </div>
      {aktif ? (
        <Button variant="outline" onClick={() => onChange({ dari: "", sampai: "" })} className="h-9 px-3 text-[11px]">
          <X className="mr-1 h-3.5 w-3.5" /> Reset tanggal
        </Button>
      ) : null}
    </div>
  );
}

/** Terapkan filter tanggal pada tanggal inspeksi (string ISO date "YYYY-MM-DD"). */
export function lolosFilterTanggal(tanggal: string, f: FilterTanggalValue): boolean {
  if (f.dari && tanggal < f.dari) return false;
  if (f.sampai && tanggal > f.sampai) return false;
  return true;
}

/** Paginasi sederhana: potong daftar utk halaman aktif + info rentang baris. */
export function potongHalaman<T>(daftar: T[], halaman: number, perHalaman = 10): { bagian: T[]; total: number; totalHalaman: number; mulai: number; akhir: number } {
  const total = daftar.length;
  const totalHalaman = Math.max(1, Math.ceil(total / perHalaman));
  const hp = Math.min(Math.max(1, halaman), totalHalaman);
  const mulai = (hp - 1) * perHalaman;
  const bagian = daftar.slice(mulai, mulai + perHalaman);
  return { bagian, total, totalHalaman, mulai: total === 0 ? 0 : mulai + 1, akhir: mulai + bagian.length };
}

/** Bar navigasi halaman (maksimal N baris per lembar → lanjut ke lembar berikutnya). */
export function NavigasiHalaman({ halaman, totalHalaman, onChange, total, mulai, akhir, label = "pemeriksaan" }: {
  halaman: number;
  totalHalaman: number;
  onChange: (h: number) => void;
  total: number;
  mulai: number;
  akhir: number;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50 px-4 py-2.5">
      <p className="text-[11px] text-slate-500">
        Menampilkan <b className="text-slate-700">{mulai}–{akhir}</b> dari <b className="text-slate-700">{total}</b> {label} • maks. 10 baris per lembar
      </p>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" disabled={halaman <= 1} onClick={() => onChange(halaman - 1)} className="h-8 text-[11px]">
          Sebelumnya
        </Button>
        <span className="px-1.5 text-[11px] font-bold text-slate-600">Halaman {halaman} / {totalHalaman}</span>
        <Button variant="outline" size="sm" disabled={halaman >= totalHalaman} onClick={() => onChange(halaman + 1)} className="h-8 text-[11px]">
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
