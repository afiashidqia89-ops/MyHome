"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { qk } from "@/lib/queries";
import { fmtKoor } from "@/lib/utils-rl";
import * as XLSX from "xlsx";
import { StatCard } from "@/components/rl-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, FileSpreadsheet, Layers3, Loader2, MapPinPlus, Pencil, Plus, Trash2, TreePalm, Upload, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Koordinat } from "@/lib/types";

type Level = "estate" | "kebun" | "afdeling" | "barak"; // "barak" = slug API untuk Perumahan

const TIPE_PERUMAHAN = [
  "Perumahan",
  "Rumah Keluarga Karyawan",
  "Perumahan Transport & Workshop",
];

// Satu bentuk isian untuk pendaftaran DAN ubah data: seluruh rantai + koordinat.
// Koordinat KOSONG secara bawaan (opsional) — tidak ada titik tebakan.
const KOSONG_FORM = { estate: "", kebun: "", afdeling: "", perumahan: "", tipe: TIPE_PERUMAHAN[0], kapasitas: "16", lat: "", lng: "" };

/** Satu baris tabel = satu rantai Estate › Kebun › Afdeling › Perumahan + koordinat. */
type Baris = {
  key: string;
  estateId: string; estate: string;
  kebunId: string | null; kebun: string;
  afdelingId: string | null; afdeling: string;
  barakId: string | null; perumahan: string;
  tipe: string; kapasitas: number | null;
  koordinat: Koordinat;
  dalam: Level; // level terdalam yang ada pada baris ini
  idDalam: string;
};

type HasilImpor = {
  namaFile: string;
  sheet: string;
  barisTerbaca: number;
  berhasil: number;
  estateBaru: number;
  kebunBaru: number;
  afdelingBaru: number;
  perumahanBaru: number;
  dilewati: number;
  gagal: number;
  errors: { baris: number; pesan: string }[];
};

export function WebMaster() {
  const { master } = useStore();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editBaris, setEditBaris] = useState<Baris | null>(null); // null = pendaftaran baru
  const [form, setForm] = useState(KOSONG_FORM);
  const [menyimpan, setMenyimpan] = useState(false);
  const [hapusTarget, setHapusTarget] = useState<Baris | null>(null);
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [menghapusMassa, setMenghapusMassa] = useState(false);

  // ---------- Unggah XLSX data master ----------
  const [unggahOpen, setUnggahOpen] = useState(false);
  const [fileImpor, setFileImpor] = useState<File | null>(null);
  const [mengimpor, setMengimpor] = useState(false);
  const [hasilImpor, setHasilImpor] = useState<HasilImpor | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.master });
    qc.invalidateQueries({ queryKey: qk.aktivitas });
  };

  // ---------- Susun tabel tunggal dari pohon master ----------
  const estates = master?.estates ?? [];
  const kebuns = master?.kebuns ?? [];
  const afdelings = master?.afdelings ?? [];
  const baraks = master?.baraks ?? [];

  const baris: Baris[] = [];
  for (const e of estates) {
    const ks = kebuns.filter((k) => k.estateId === e.id);
    const dasarE = { estateId: e.id, estate: e.nama, kebunId: null, kebun: "", afdelingId: null, afdeling: "", barakId: null, perumahan: "", tipe: "", kapasitas: null };
    if (!ks.length) {
      baris.push({ ...dasarE, key: `estate:${e.id}`, koordinat: e.koordinat ?? null, dalam: "estate", idDalam: e.id });
      continue;
    }
    for (const k of ks) {
      const as = afdelings.filter((a) => a.kebunId === k.id);
      const dasarK = { ...dasarE, kebunId: k.id, kebun: k.nama };
      if (!as.length) {
        baris.push({ ...dasarK, key: `kebun:${k.id}`, koordinat: k.koordinat ?? null, dalam: "kebun", idDalam: k.id });
        continue;
      }
      for (const a of as) {
        const bs = baraks.filter((b) => b.afdelingId === a.id);
        const dasarA = { ...dasarK, afdelingId: a.id, afdeling: a.nama };
        if (!bs.length) {
          baris.push({ ...dasarA, key: `afdeling:${a.id}`, koordinat: a.koordinat, dalam: "afdeling", idDalam: a.id });
          continue;
        }
        for (const b of bs) {
          baris.push({ ...dasarA, key: `barak:${b.id}`, barakId: b.id, perumahan: b.nama, tipe: b.tipe, kapasitas: b.kapasitas, koordinat: b.koordinat, dalam: "barak", idDalam: b.id });
        }
      }
    }
  }

  const semuaDipilih = baris.length > 0 && baris.every((x) => pilih.has(x.key));
  const sebagianDipilih = pilih.size > 0 && !semuaDipilih;
  const cekSemua = () => setPilih(semuaDipilih ? new Set() : new Set(baris.map((x) => x.key)));
  const toggleBaris = (key: string) => {
    const s = new Set(pilih);
    if (s.has(key)) s.delete(key);
    else s.add(key);
    setPilih(s);
  };

  // ---------- Template & impor XLSX (format = kolom tabel) ----------
  const unduhTemplate = () => {
    const aoa: (string | number)[][] = [
      ["ESTATE", "KEBUN", "AFDELING", "PERUMAHAN", "TIPE", "KAPASITAS", "LAT", "LNG"],
      ["Estate Kalbar 1", "Kebun Mandor", "Afdeling I", "Perumahan I-4", "Perumahan", 16, -0.052, 109.322],
      ["Estate Kalbar 1", "Kebun Mandor", "Afdeling II", "Perumahan II-3", "Perumahan", 16, "", ""],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Data Master");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Template_Data_Master_RumahLayak.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const jalankanImpor = async () => {
    if (!fileImpor) return;
    setMengimpor(true);
    setHasilImpor(null);
    try {
      const fd = new FormData();
      fd.append("file", fileImpor);
      const hasil = await api.upload<HasilImpor>("/api/master/import", fd);
      setHasilImpor(hasil);
      refresh();
      toast.success(
        `Impor selesai — ${hasil.perumahanBaru} perumahan baru dari ${hasil.barisTerbaca} baris${hasil.dilewati ? `, ${hasil.dilewati} dilewati` : ""}${hasil.gagal ? `, ${hasil.gagal} gagal` : ""}`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMengimpor(false);
    }
  };

  // ---------- Pendaftaran / ubah ----------
  const bukaTambah = () => {
    setEditBaris(null);
    setForm(KOSONG_FORM);
    setOpen(true);
  };

  const bukaEdit = (x: Baris) => {
    setEditBaris(x);
    setForm({
      estate: x.estate,
      kebun: x.kebun,
      afdeling: x.afdeling,
      perumahan: x.perumahan,
      tipe: x.tipe || TIPE_PERUMAHAN[0],
      kapasitas: String(x.kapasitas ?? 16),
      lat: x.koordinat ? String(x.koordinat.lat) : "",
      lng: x.koordinat ? String(x.koordinat.lng) : "",
    });
    setOpen(true);
  };

  const simpan = async () => {
    const f = { ...form, estate: form.estate.trim(), kebun: form.kebun.trim(), afdeling: form.afdeling.trim(), perumahan: form.perumahan.trim(), lat: form.lat.trim(), lng: form.lng.trim() };
    if (!f.estate) return void toast.error("Estate wajib diisi");
    if (!f.kebun && (f.afdeling || f.perumahan)) return void toast.error("Kebun wajib diisi bila Afdeling/Perumahan diisi");
    if (!f.afdeling && f.perumahan) return void toast.error("Afdeling wajib diisi bila Perumahan diisi");
    if ((f.lat === "") !== (f.lng === "")) return void toast.error("Latitude dan longitude harus diisi keduanya, atau dikosongkan keduanya");
    if (f.lat !== "" && (!Number.isFinite(Number(f.lat.replace(",", "."))) || !Number.isFinite(Number(f.lng.replace(",", "."))))) {
      return void toast.error("Latitude dan longitude harus berupa angka");
    }

    setMenyimpan(true);
    try {
      if (!editBaris) {
        // Satu pendaftaran = seluruh rantai (level yang belum ada dibuat otomatis)
        await api.post("/api/master/baris", {
          estate: f.estate, kebun: f.kebun, afdeling: f.afdeling, perumahan: f.perumahan,
          tipe: f.tipe, kapasitas: Number(f.kapasitas), lat: f.lat, lng: f.lng,
        });
        toast.success(`${[f.estate, f.kebun, f.afdeling, f.perumahan].filter(Boolean).join(" › ")} ditambahkan`);
      } else {
        const x = editBaris;
        const koor = { lat: f.lat, lng: f.lng };
        // Nama tiap level diubah di tempat (berlaku untuk semua baris di bawahnya);
        // koordinat, tipe & kapasitas milik level terdalam baris ini.
        if (f.estate !== x.estate) await api.patch(`/api/master/estate/${x.estateId}`, { nama: f.estate, ...(x.dalam === "estate" ? koor : {}) });
        else if (x.dalam === "estate") await api.patch(`/api/master/estate/${x.estateId}`, { nama: f.estate, ...koor });
        if (x.kebunId) {
          if (f.kebun !== x.kebun || x.dalam === "kebun") await api.patch(`/api/master/kebun/${x.kebunId}`, { nama: f.kebun || x.kebun, ...(x.dalam === "kebun" ? koor : {}) });
        }
        if (x.afdelingId) {
          if (f.afdeling !== x.afdeling || x.dalam === "afdeling") await api.patch(`/api/master/afdeling/${x.afdelingId}`, { nama: f.afdeling || x.afdeling, ...(x.dalam === "afdeling" ? koor : {}) });
        }
        if (x.barakId) {
          await api.patch(`/api/master/barak/${x.barakId}`, { nama: f.perumahan || x.perumahan, tipe: f.tipe, kapasitas: Number(f.kapasitas), ...koor });
        }
        toast.success("Data master diperbarui");
      }
      refresh();
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMenyimpan(false);
    }
  };

  // ---------- Hapus (level terdalam pada baris) ----------
  const namaBaris = (x: Baris) => [x.estate, x.kebun, x.afdeling, x.perumahan].filter(Boolean).join(" › ");

  const hapus = async () => {
    const x = hapusTarget;
    if (!x) return;
    try {
      await api.del(`/api/master/${x.dalam}/${x.idDalam}`);
      refresh();
      setPilih((p) => { const s = new Set(p); s.delete(x.key); return s; });
      toast.success(`${namaBaris(x)} dihapus dari data master`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setHapusTarget(null);
    }
  };

  const hapusMassal = async () => {
    const terpilih = baris.filter((x) => pilih.has(x.key));
    if (!terpilih.length) return;
    setMenghapusMassa(true);
    let sukses = 0;
    const gagal: string[] = [];
    for (const x of terpilih) {
      try {
        await api.del(`/api/master/${x.dalam}/${x.idDalam}`);
        sukses += 1;
      } catch {
        gagal.push(x.perumahan || x.afdeling || x.kebun || x.estate);
      }
    }
    refresh();
    setMenghapusMassa(false);
    setPilih(new Set());
    if (gagal.length === 0) toast.success(`${sukses} baris terpilih dihapus dari data master`);
    else toast.warning(`${sukses} dihapus, ${gagal.length} gagal (masih dipakai data lain): ${gagal.slice(0, 5).join(", ")}${gagal.length > 5 ? "…" : ""}`);
  };

  // Saran isian (datalist) mengikuti rantai yang sedang diketik
  const sama = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const estateTerpilih = estates.find((e) => sama(e.nama, form.estate));
  const saranKebun = estateTerpilih ? kebuns.filter((k) => k.estateId === estateTerpilih.id) : [];
  const kebunTerpilih = saranKebun.find((k) => sama(k.nama, form.kebun));
  const saranAfdeling = kebunTerpilih ? afdelings.filter((a) => a.kebunId === kebunTerpilih.id) : [];

  const mengubah = editBaris !== null;
  const kunci = (level: Level) => mengubah && !(
    level === "estate" ? true
    : level === "kebun" ? !!editBaris?.kebunId
    : level === "afdeling" ? !!editBaris?.afdelingId
    : !!editBaris?.barakId
  ); // level di bawah kedalaman baris tidak bisa diisi lewat Ubah — pakai Tambah

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="Estate" value={estates.length} icon={<Building2 className="h-4 w-4" />} />
        <StatCard title="Kebun" value={kebuns.length} icon={<TreePalm className="h-4 w-4" />} accent="sky" />
        <StatCard title="Afdeling" value={afdelings.length} icon={<Layers3 className="h-4 w-4" />} accent="gold" />
        <StatCard title="Perumahan" value={baraks.length} icon={<Warehouse className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-bold text-slate-800">Manajemen Data Master</h3>
            <p className="text-[11px] text-slate-500">Satu tabel: Estate → Kebun → Afdeling → Perumahan + Koordinat. Pendaftaran manual dan unggah XLSX memakai format baris yang sama; perubahan langsung tersimpan di server & tersedia ke seluruh APK.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={unduhTemplate} className="h-9 border-forest text-[12px] font-semibold text-forest hover:bg-forest-soft">
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Unduh Template
            </Button>
            <Button
              variant="outline"
              onClick={() => { setFileImpor(null); setHasilImpor(null); setUnggahOpen(true); }}
              className="h-9 border-forest text-[12px] font-semibold text-forest hover:bg-forest-soft"
            >
              <Upload className="mr-1.5 h-4 w-4" /> Unggah XLSX
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={pilih.size === 0} className="h-9 border-red-300 text-[12px] font-semibold text-red-600 hover:bg-red-50">
                  <Trash2 className="mr-1.5 h-4 w-4" /> Hapus Terpilih ({pilih.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-[15px]">Hapus {pilih.size} baris terpilih?</AlertDialogTitle>
                  <AlertDialogDescription className="text-[12px]">
                    Yang dihapus adalah level terdalam pada tiap baris (perumahan; bila kosong, afdeling/kebun/estate-nya). Baris yang masih dipakai data lain ditolak server (409) dan dilaporkan setelah proses selesai. Aksi tercatat di audit trail.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="h-9 text-[12px]">Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={hapusMassal} disabled={menghapusMassa} className="h-9 bg-red-600 text-[12px] hover:bg-red-700">
                    {menghapusMassa ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                    {menghapusMassa ? "Menghapus..." : "Ya, Hapus Semua Terpilih"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={bukaTambah} className="h-9 bg-forest text-[12px] font-semibold hover:bg-forest-deep">
              <Plus className="mr-1.5 h-4 w-4" /> Tambah Data
            </Button>
          </div>
        </div>

        {/* TABEL TUNGGAL — satu baris = satu rantai + koordinat */}
        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-9">
                  <Checkbox
                    checked={semuaDipilih ? true : sebagianDipilih ? "indeterminate" : false}
                    onCheckedChange={cekSemua}
                    aria-label="Cek semua baris"
                    className="h-3.5 w-3.5"
                  />
                </TableHead>
                <TableHead className="text-[11px]">Estate</TableHead>
                <TableHead className="text-[11px]">Kebun</TableHead>
                <TableHead className="text-[11px]">Afdeling</TableHead>
                <TableHead className="text-[11px]">Perumahan</TableHead>
                <TableHead className="text-[11px]">Tipe</TableHead>
                <TableHead className="text-[11px]">Kapasitas</TableHead>
                <TableHead className="text-[11px]">Koordinat</TableHead>
                <TableHead className="text-right text-[11px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {baris.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-[11.5px] text-slate-400">
                    Belum ada data master. Gunakan <b>Tambah Data</b> atau <b>Unggah XLSX</b>.
                  </TableCell>
                </TableRow>
              )}
              {baris.map((x) => (
                <TableRow key={x.key}>
                  <TableCell>
                    <Checkbox checked={pilih.has(x.key)} onCheckedChange={() => toggleBaris(x.key)} aria-label={`Pilih ${namaBaris(x)}`} className="h-3.5 w-3.5" />
                  </TableCell>
                  <TableCell className="text-[12px] text-slate-700">{x.estate}</TableCell>
                  <TableCell className="text-[12px] text-slate-700">{x.kebun || "—"}</TableCell>
                  <TableCell className="text-[12px] text-slate-700">{x.afdeling || "—"}</TableCell>
                  <TableCell className="text-[12px] font-semibold text-slate-800">{x.perumahan || "—"}</TableCell>
                  <TableCell className="text-[11px] text-slate-500">{x.tipe || "—"}</TableCell>
                  <TableCell className="text-[11.5px] text-slate-500">{x.kapasitas !== null ? `${x.kapasitas} org` : "—"}</TableCell>
                  <TableCell className="font-mono text-[10px] text-slate-400">{fmtKoor(x.koordinat?.lat, x.koordinat?.lng)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => bukaEdit(x)} className="h-7 px-2 text-[11px] text-forest" aria-label={`Ubah ${namaBaris(x)}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setHapusTarget(x)} className="h-7 px-2 text-[11px] text-red-600" aria-label={`Hapus ${namaBaris(x)}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog hapus satu baris */}
      <AlertDialog open={hapusTarget !== null} onOpenChange={(o) => !o && setHapusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Hapus &quot;{hapusTarget ? namaBaris(hapusTarget) : ""}&quot;?</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              Yang dihapus adalah level terdalam baris ini ({hapusTarget?.dalam === "barak" ? "perumahan" : hapusTarget?.dalam}). Penghapusan ditolak server bila data masih dipakai (memiliki anak atau riwayat pemeriksaan/temuan). Aksi tercatat di audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-[12px]">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={hapus} className="h-9 bg-red-600 text-[12px] hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog tambah / ubah — SATU form untuk seluruh rantai + koordinat */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">{mengubah ? "Ubah Data Master" : "Tambah Data Master"}</DialogTitle>
            <DialogDescription className="text-[12px]">
              {mengubah
                ? "Mengubah nama estate/kebun/afdeling berlaku untuk semua perumahan di bawahnya. Untuk menambah level di bawahnya, gunakan Tambah Data."
                : "Isi rantai dari Estate sampai Perumahan. Nama yang sudah ada dipakai ulang, yang belum ada dibuat otomatis. Koordinat boleh dikosongkan."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">Estate</Label>
                <Input list="saran-estate" value={form.estate} onChange={(e) => setForm({ ...form, estate: e.target.value })} className="mt-1 h-9 text-[12px]" placeholder="cth: Estate Kalbar 1" />
                <datalist id="saran-estate">{estates.map((e) => <option key={e.id} value={e.nama} />)}</datalist>
              </div>
              <div>
                <Label className="text-[11px]">Kebun</Label>
                <Input list="saran-kebun" value={form.kebun} disabled={kunci("kebun")} onChange={(e) => setForm({ ...form, kebun: e.target.value })} className="mt-1 h-9 text-[12px]" placeholder="cth: Kebun Mandor" />
                <datalist id="saran-kebun">{saranKebun.map((k) => <option key={k.id} value={k.nama} />)}</datalist>
              </div>
              <div>
                <Label className="text-[11px]">Afdeling</Label>
                <Input list="saran-afdeling" value={form.afdeling} disabled={kunci("afdeling")} onChange={(e) => setForm({ ...form, afdeling: e.target.value })} className="mt-1 h-9 text-[12px]" placeholder="cth: Afdeling I" />
                <datalist id="saran-afdeling">{saranAfdeling.map((a) => <option key={a.id} value={a.nama} />)}</datalist>
              </div>
              <div>
                <Label className="text-[11px]">Perumahan</Label>
                <Input value={form.perumahan} disabled={kunci("barak")} onChange={(e) => setForm({ ...form, perumahan: e.target.value })} className="mt-1 h-9 text-[12px]" placeholder="cth: Perumahan I-4" />
              </div>
            </div>
            {(!mengubah || editBaris?.barakId) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px]">Tipe Perumahan</Label>
                  <Select value={form.tipe} onValueChange={(v) => setForm({ ...form, tipe: v })}>
                    <SelectTrigger className="mt-1 h-9 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPE_PERUMAHAN.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">Kapasitas (orang)</Label>
                  <Input type="number" min={1} value={form.kapasitas} onChange={(e) => setForm({ ...form, kapasitas: e.target.value })} className="mt-1 h-9 text-[12px]" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">Latitude <span className="font-normal text-slate-400">(opsional)</span></Label>
                <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className="mt-1 h-9 font-mono text-[12px]" placeholder="cth: -0.05200" />
              </div>
              <div>
                <Label className="text-[11px]">Longitude <span className="font-normal text-slate-400">(opsional)</span></Label>
                <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className="mt-1 h-9 font-mono text-[12px]" placeholder="cth: 109.32200" />
              </div>
            </div>
            <p className="text-[10.5px] text-slate-400">Koordinat berlaku untuk level terdalam yang diisi pada baris ini. Kosong = tanpa koordinat (tidak tampil sebagai titik di peta).</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="h-9 text-[12px]">Batal</Button>
            <Button onClick={simpan} disabled={menyimpan} className="h-9 bg-forest text-[12px] hover:bg-forest-deep">
              {menyimpan ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <MapPinPlus className="mr-1 h-3.5 w-3.5" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog unggah XLSX data master */}
      <Dialog open={unggahOpen} onOpenChange={setUnggahOpen}>
        <DialogContent className="rounded-xl sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Unggah Data Master (XLSX)</DialogTitle>
            <DialogDescription className="text-[12px]">
              Impor massal dari file Excel dengan format yang sama seperti tabel di atas. Kolom wajib: <b>ESTATE, KEBUN, AFDELING, PERUMAHAN</b> — opsional: <b>TIPE, KAPASITAS, LAT, LNG</b> (koordinat).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600">
              Satu baris = satu rantai Estate › Kebun › Afdeling › Perumahan. Estate/Kebun/Afdeling otomatis dibuat bila belum ada. Nama yang sudah ada <b>dilewati</b> (impor boleh diulang). Baris tanpa LAT/LNG disimpan tanpa koordinat (dikosongkan).
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={unduhTemplate} className="h-9 border-forest text-[12px] font-semibold text-forest hover:bg-forest-soft">
                <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Unduh Template
              </Button>
              <span className="text-[10.5px] text-slate-400">Template berisi contoh format kolom siap isi.</span>
            </div>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                setFileImpor(e.target.files?.[0] ?? null);
                setHasilImpor(null);
              }}
              className="cursor-pointer text-[12px]"
            />
            {fileImpor && (
              <p className="text-[11px] text-slate-500">
                File terpilih: <b>{fileImpor.name}</b> ({(fileImpor.size / 1024).toFixed(1)} KB)
              </p>
            )}
            {hasilImpor && (
              <div className="rounded-lg border p-2.5">
                <p className="text-[11.5px] font-bold text-forest">Hasil impor — {hasilImpor.namaFile} (sheet &quot;{hasilImpor.sheet}&quot;)</p>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                  {([
                    ["Baris dibaca", hasilImpor.barisTerbaca],
                    ["Perumahan baru", hasilImpor.perumahanBaru],
                    ["Dilewati (sudah ada)", hasilImpor.dilewati],
                    ["Estate baru", hasilImpor.estateBaru],
                    ["Kebun baru", hasilImpor.kebunBaru],
                    ["Afdeling baru", hasilImpor.afdelingBaru],
                  ] as const).map(([label, nilai]) => (
                    <div key={label} className="rounded bg-slate-50 p-1.5">
                      <p className="text-[13px] font-bold text-slate-800">{nilai}</p>
                      <p className="text-[9px] leading-tight text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
                {hasilImpor.gagal > 0 && (
                  <div className="mt-2 rounded bg-red-50 p-2 text-[10.5px] text-red-700">
                    <p className="font-bold">{hasilImpor.gagal} baris gagal:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {hasilImpor.errors.map((er, i) => (
                        <li key={i}>Baris {er.baris || "-"}: {er.pesan}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnggahOpen(false)} className="h-9 text-[12px]">Tutup</Button>
            <Button onClick={jalankanImpor} disabled={!fileImpor || mengimpor} className="h-9 bg-forest text-[12px] hover:bg-forest-deep">
              {mengimpor ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />} Impor Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className={cn("rounded-lg bg-gold-soft p-3 text-[10.5px] leading-relaxed text-gold-deep")}>
        Catatan: penghapusan dengan data terikat akan <b>ditolak server (409)</b> agar riwayat pemeriksaan, temuan, dan binding user tetap utuh. Koordinat bersifat opsional; hanya perumahan yang berkoordinat yang tampil sebagai titik di peta.
      </p>
    </div>
  );
}
