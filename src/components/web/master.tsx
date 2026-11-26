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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, FileSpreadsheet, Layers3, Loader2, MapPinPlus, Pencil, Plus, Trash2, TreePalm, Upload, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

type Entity = "estate" | "kebun" | "afdeling" | "barak";

// Label tampil ke pengguna — entity "barak" dipakai sebagai slug URL/API (tabel DB),
// tetapi kata yang terlihat pengguna adalah "Perumahan".
const LABEL_ENTITAS: Record<Entity, string> = { estate: "ESTATE", kebun: "KEBUN", afdeling: "AFDELING", barak: "PERUMAHAN" };

const TIPE_PERUMAHAN = [
  "Perumahan",
  "Rumah Keluarga Karyawan",
  "Perumahan Transport & Workshop",
];

const KOSONG_FORM = { nama: "", parent: "", tipe: TIPE_PERUMAHAN[0], kapasitas: "16", lat: "-0.052", lng: "109.322" };

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

  const [entitas, setEntitas] = useState<Entity>("barak");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null); // null = tambah baru
  const [form, setForm] = useState(KOSONG_FORM);
  const [menyimpan, setMenyimpan] = useState(false);
  const [hapusId, setHapusId] = useState<string | null>(null);
  const [hapusNama, setHapusNama] = useState("");
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [menghapusMassa, setMenghapusMassa] = useState(false);

  // ---------- Unggah XLSX data master ----------
  const [unggahOpen, setUnggahOpen] = useState(false);
  const [fileImpor, setFileImpor] = useState<File | null>(null);
  const [mengimpor, setMengimpor] = useState(false);
  const [hasilImpor, setHasilImpor] = useState<HasilImpor | null>(null);

  const unduhTemplate = () => {
    const aoa: (string | number)[][] = [
      ["ESTATE", "KEBUN", "AFDELING", "PERUMAHAN"],
      ["Estate Kalbar 1", "Kebun Mandor", "Afdeling I", "Perumahan I-4"],
      ["Estate Kalbar 1", "Kebun Mandor", "Afdeling II", "Perumahan II-3"],
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

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.master });
    qc.invalidateQueries({ queryKey: qk.aktivitas });
  };

  const bukaTambah = (e: Entity) => {
    setEntitas(e);
    setEditId(null);
    setForm({
      ...KOSONG_FORM,
      parent: e === "estate" ? "" : e === "kebun" ? (master?.estates[0]?.id ?? "") : e === "afdeling" ? (master?.kebuns[0]?.id ?? "") : (master?.afdelings[0]?.id ?? ""),
    });
    setOpen(true);
  };

  const bukaEdit = (e: Entity, id: string) => {
    setEntitas(e);
    setEditId(id);
    if (e === "estate") {
      const x = master?.estates.find((v) => v.id === id);
      setForm({ ...KOSONG_FORM, nama: x?.nama ?? "" });
    } else if (e === "kebun") {
      const x = master?.kebuns.find((v) => v.id === id);
      setForm({ ...KOSONG_FORM, nama: x?.nama ?? "", parent: x?.estateId ?? "" });
    } else if (e === "afdeling") {
      const x = master?.afdelings.find((v) => v.id === id);
      setForm({ ...KOSONG_FORM, nama: x?.nama ?? "", parent: x?.kebunId ?? "", lat: String(x?.koordinat.lat ?? KOSONG_FORM.lat), lng: String(x?.koordinat.lng ?? KOSONG_FORM.lng) });
    } else {
      const x = master?.baraks.find((v) => v.id === id);
      setForm({ ...KOSONG_FORM, nama: x?.nama ?? "", parent: x?.afdelingId ?? "", tipe: x?.tipe ?? TIPE_PERUMAHAN[0], kapasitas: String(x?.kapasitas ?? 16), lat: String(x?.koordinat.lat ?? KOSONG_FORM.lat), lng: String(x?.koordinat.lng ?? KOSONG_FORM.lng) });
    }
    setOpen(true);
  };

  const konfirmasiHapus = (e: Entity, id: string, nama: string) => {
    setEntitas(e);
    setHapusId(id);
    setHapusNama(nama);
  };

  const hapus = async () => {
    if (!hapusId) return;
    try {
      await api.del(`/api/master/${entitas}/${hapusId}`);
      refresh();
      toast.success(`${hapusNama} dihapus dari data master`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setHapusId(null);
      setHapusNama("");
    }
  };

  // ---------- Cek semua / hapus terpilih (multi baris pada tab aktif) ----------
  const daftarEntitasAktif =
    entitas === "estate" ? (master?.estates ?? [])
    : entitas === "kebun" ? (master?.kebuns ?? [])
    : entitas === "afdeling" ? (master?.afdelings ?? [])
    : (master?.baraks ?? []);
  const semuaDipilih = daftarEntitasAktif.length > 0 && daftarEntitasAktif.every((x) => pilih.has(x.id));
  const sebagianDipilih = pilih.size > 0 && !semuaDipilih;
  const cekSemua = () => {
    if (semuaDipilih) setPilih(new Set());
    else setPilih(new Set(daftarEntitasAktif.map((x) => x.id)));
  };
  const toggleBaris = (id: string) => {
    const s = new Set(pilih);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setPilih(s);
  };
  const namaBaris = (id: string) => daftarEntitasAktif.find((x) => x.id === id)?.nama ?? id;

  /** Hapus semua baris tercentang pada tab aktif — dijalankan satu per satu
   *  via API per-item (server menolak 409 bila data masih dipakai), lalu
   *  ringkasan sukses/gagal dilaporkan. */
  const hapusMassal = async () => {
    const ids = [...pilih];
    if (!ids.length) return;
    setMenghapusMassa(true);
    let sukses = 0;
    const gagal: string[] = [];
    for (const id of ids) {
      try {
        await api.del(`/api/master/${entitas}/${id}`);
        sukses += 1;
      } catch {
        gagal.push(namaBaris(id));
      }
    }
    refresh();
    setMenghapusMassa(false);
    setPilih(new Set());
    if (gagal.length === 0) {
      toast.success(`${sukses} ${LABEL_ENTITAS[entitas]} terpilih dihapus dari data master`);
    } else {
      toast.warning(
        `${sukses} dihapus, ${gagal.length} gagal (masih dipakai data lain): ${gagal.slice(0, 5).join(", ")}${gagal.length > 5 ? "…" : ""}`,
      );
    }
  };

  const simpan = async () => {
    const nama = form.nama.trim();
    if (!nama) {
      toast.error("Nama wajib diisi");
      return;
    }
    const indukWajib = entitas === "kebun" ? "Estate" : entitas === "afdeling" ? "Kebun" : entitas === "barak" ? "Afdeling" : null;
    if (indukWajib && !form.parent) {
      toast.error(`${indukWajib} induk wajib dipilih`);
      return;
    }
    const payload: Record<string, unknown> =
      entitas === "estate" ? { nama }
      : entitas === "kebun" ? { nama, estateId: form.parent }
      : entitas === "afdeling" ? { nama, kebunId: form.parent, lat: Number(form.lat), lng: Number(form.lng) }
      : { nama, afdelingId: form.parent, tipe: form.tipe, kapasitas: Number(form.kapasitas), lat: Number(form.lat), lng: Number(form.lng) };

    setMenyimpan(true);
    try {
      if (editId) {
        await api.patch(`/api/master/${entitas}/${editId}`, payload);
        toast.success(`${nama} diperbarui`);
      } else {
        await api.post(`/api/master/${entitas}`, payload);
        toast.success(`${nama} ditambahkan ke data master`);
      }
      refresh();
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMenyimpan(false);
    }
  };

  const namaEstate = (id: string) => master?.estates.find((v) => v.id === id)?.nama ?? "-";
  const namaKebun = (id: string) => master?.kebuns.find((v) => v.id === id)?.nama ?? "-";
  const namaAfd = (id: string) => master?.afdelings.find((v) => v.id === id)?.nama ?? "-";

  const LabelInduk = entitas === "kebun" ? "Estate Induk" : entitas === "afdeling" ? "Kebun Induk" : "Afdeling Induk";
  const daftarInduk =
    entitas === "kebun" ? (master?.estates ?? []).map((x) => ({ id: x.id, nama: x.nama }))
    : entitas === "afdeling" ? (master?.kebuns ?? []).map((x) => ({ id: x.id, nama: `${x.nama} — ${namaEstate(x.estateId)}` }))
    : (master?.afdelings ?? []).map((x) => ({ id: x.id, nama: `${x.nama} — ${namaKebun(x.kebunId)}` }));

  const tampilInduk = entitas !== "estate";
  const tampilKoor = entitas === "afdeling" || entitas === "barak";

  const AksiRow = ({ e, id, nama }: { e: Entity; id: string; nama: string }) => (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => bukaEdit(e, id)} className="h-7 px-2 text-[11px] text-forest">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" onClick={() => konfirmasiHapus(e, id, nama)} className="h-7 px-2 text-[11px] text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Hapus &quot;{hapusNama}&quot;?</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              Penghapusan ditolak server bila data ini masih dipakai (memiliki anak atau riwayat pemeriksaan/temuan). Aksi tercatat di audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-[12px]">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={hapus} className="h-9 bg-red-600 text-[12px] hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="Estate" value={master?.estates.length ?? 0} icon={<Building2 className="h-4 w-4" />} />
        <StatCard title="Kebun" value={master?.kebuns.length ?? 0} icon={<TreePalm className="h-4 w-4" />} accent="sky" />
        <StatCard title="Afdeling" value={master?.afdelings.length ?? 0} icon={<Layers3 className="h-4 w-4" />} accent="gold" />
        <StatCard title="Perumahan" value={master?.baraks.length ?? 0} icon={<Warehouse className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-bold text-slate-800">Manajemen Data Master</h3>
            <p className="text-[11px] text-slate-500">Struktur organisasi Estate → Kebun → Afdeling → Perumahan. Perubahan langsung tersimpan di server & tersedia ke seluruh APK — centang baris atau Cek Semua di kepala tabel, lalu Hapus Terpilih untuk hapus massal.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={unduhTemplate}
              className="h-9 border-forest text-[12px] font-semibold text-forest hover:bg-forest-soft"
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Unduh Template
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFileImpor(null);
                setHasilImpor(null);
                setUnggahOpen(true);
              }}
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
                  <AlertDialogTitle className="text-[15px]">Hapus {pilih.size} {LABEL_ENTITAS[entitas]} terpilih?</AlertDialogTitle>
                  <AlertDialogDescription className="text-[12px]">
                    Penghapusan dijalankan satu per satu — baris yang masih dipakai data lain akan ditolak server (409) dan dilaporkan setelah proses selesai. Aksi tercatat di audit trail.
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
            <Button onClick={() => bukaTambah(entitas)} className="h-9 bg-forest text-[12px] font-semibold hover:bg-forest-deep">
              <Plus className="mr-1.5 h-4 w-4" /> Tambah {LABEL_ENTITAS[entitas]}
            </Button>
          </div>
        </div>

        <Tabs value={entitas} onValueChange={(v) => { setEntitas(v as Entity); setPilih(new Set()); }} className="mt-3">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="estate" className="text-[11.5px]">Estate</TabsTrigger>
            <TabsTrigger value="kebun" className="text-[11.5px]">Kebun</TabsTrigger>
            <TabsTrigger value="afdeling" className="text-[11.5px]">Afdeling</TabsTrigger>
            <TabsTrigger value="barak" className="text-[11.5px]">Perumahan</TabsTrigger>
          </TabsList>

          <TabsContent value="estate">
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
                  <TableHead className="text-[11px]">Nama Estate</TableHead>
                  <TableHead className="text-[11px]">Jumlah Kebun</TableHead>
                  <TableHead className="text-[11px] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(master?.estates ?? []).map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>
                      <Checkbox checked={pilih.has(x.id)} onCheckedChange={() => toggleBaris(x.id)} aria-label={`Pilih ${x.nama}`} className="h-3.5 w-3.5" />
                    </TableCell>
                    <TableCell className="text-[12px] font-semibold text-slate-700">{x.nama}</TableCell>
                    <TableCell className="text-[11.5px] text-slate-500">{(master?.kebuns ?? []).filter((k) => k.estateId === x.id).length} kebun</TableCell>
                    <TableCell><AksiRow e="estate" id={x.id} nama={x.nama} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="kebun">
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
                  <TableHead className="text-[11px]">Nama Kebun</TableHead>
                  <TableHead className="text-[11px]">Estate</TableHead>
                  <TableHead className="text-[11px]">Afdeling</TableHead>
                  <TableHead className="text-[11px]">Perumahan</TableHead>
                  <TableHead className="text-[11px] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(master?.kebuns ?? []).map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>
                      <Checkbox checked={pilih.has(x.id)} onCheckedChange={() => toggleBaris(x.id)} aria-label={`Pilih ${x.nama}`} className="h-3.5 w-3.5" />
                    </TableCell>
                    <TableCell className="text-[12px] font-semibold text-slate-700">{x.nama}</TableCell>
                    <TableCell className="text-[11.5px] text-slate-500">{namaEstate(x.estateId)}</TableCell>
                    <TableCell className="text-[11.5px] text-slate-500">{(master?.afdelings ?? []).filter((a) => a.kebunId === x.id).length}</TableCell>
                    <TableCell className="text-[11.5px] text-slate-500">{(master?.baraks ?? []).filter((b) => (master?.afdelings.find((a) => a.id === b.afdelingId)?.kebunId) === x.id).length}</TableCell>
                    <TableCell><AksiRow e="kebun" id={x.id} nama={x.nama} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="afdeling">
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
                  <TableHead className="text-[11px]">Nama Afdeling</TableHead>
                  <TableHead className="text-[11px]">Kebun</TableHead>
                  <TableHead className="text-[11px]">Perumahan</TableHead>
                  <TableHead className="text-[11px]">Koordinat</TableHead>
                  <TableHead className="text-[11px] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(master?.afdelings ?? []).map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>
                      <Checkbox checked={pilih.has(x.id)} onCheckedChange={() => toggleBaris(x.id)} aria-label={`Pilih ${x.nama}`} className="h-3.5 w-3.5" />
                    </TableCell>
                    <TableCell className="text-[12px] font-semibold text-slate-700">{x.nama}</TableCell>
                    <TableCell className="text-[11.5px] text-slate-500">{namaKebun(x.kebunId)}</TableCell>
                    <TableCell className="text-[11.5px] text-slate-500">{(master?.baraks ?? []).filter((b) => b.afdelingId === x.id).length}</TableCell>
                    <TableCell className="font-mono text-[10px] text-slate-400">{fmtKoor(x.koordinat.lat, x.koordinat.lng)}</TableCell>
                    <TableCell><AksiRow e="afdeling" id={x.id} nama={x.nama} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="barak">
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
                  <TableHead className="text-[11px]">Nama Perumahan</TableHead>
                  <TableHead className="text-[11px]">Afdeling / Kebun</TableHead>
                  <TableHead className="text-[11px]">Tipe</TableHead>
                  <TableHead className="text-[11px]">Kapasitas</TableHead>
                  <TableHead className="text-[11px]">Koordinat</TableHead>
                  <TableHead className="text-[11px] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(master?.baraks ?? []).map((x) => {
                  const afd = master?.afdelings.find((a) => a.id === x.afdelingId);
                  return (
                    <TableRow key={x.id}>
                      <TableCell>
                        <Checkbox checked={pilih.has(x.id)} onCheckedChange={() => toggleBaris(x.id)} aria-label={`Pilih ${x.nama}`} className="h-3.5 w-3.5" />
                      </TableCell>
                      <TableCell className="text-[12px] font-semibold text-slate-700">{x.nama}</TableCell>
                      <TableCell className="text-[11.5px] text-slate-500">{afd?.nama ?? "-"} / {namaKebun(afd?.kebunId ?? "")}</TableCell>
                      <TableCell className="text-[11px] text-slate-500">{x.tipe}</TableCell>
                      <TableCell className="text-[11.5px] text-slate-500">{x.kapasitas} org</TableCell>
                      <TableCell className="font-mono text-[10px] text-slate-400">{fmtKoor(x.koordinat.lat, x.koordinat.lng)}</TableCell>
                      <TableCell><AksiRow e="barak" id={x.id} nama={x.nama} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog tambah / edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">{editId ? `Ubah ${LABEL_ENTITAS[entitas]}` : `Tambah ${LABEL_ENTITAS[entitas]}`}</DialogTitle>
            <DialogDescription className="text-[12px]">
              {editId ? "Perubahan langsung tersimpan di server dan tersinkron ke seluruh aplikasi." : "ID dibuat otomatis oleh server. Koordinat menentukan posisi titik pada peta."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label className="text-[11px]">Nama {LABEL_ENTITAS[entitas]}</Label>
              <Input
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                className="mt-1 h-9 text-[12px]"
                placeholder={entitas === "barak" ? "cth: Perumahan I-4" : entitas === "afdeling" ? "cth: Afdeling V" : entitas === "kebun" ? "cth: Kebun Teluk" : "cth: Estate Kalbar 2"}
              />
            </div>
            {tampilInduk && (
              <div>
                <Label className="text-[11px]">{LabelInduk}</Label>
                <Select value={form.parent} onValueChange={(v) => setForm({ ...form, parent: v })}>
                  <SelectTrigger className="mt-1 h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {daftarInduk.map((x) => <SelectItem key={x.id} value={x.id}>{x.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {entitas === "barak" && (
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
            {tampilKoor && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px]">Latitude</Label>
                  <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className="mt-1 h-9 font-mono text-[12px]" />
                </div>
                <div>
                  <Label className="text-[11px]">Longitude</Label>
                  <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className="mt-1 h-9 font-mono text-[12px]" />
                </div>
              </div>
            )}
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
              Impor massal Perumahan dari file Excel. Kolom wajib: <b>ESTATE, KEBUN, AFDELING, PERUMAHAN</b> — opsional: TIPE, KAPASITAS, LAT, LNG.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600">
              Satu baris = satu Perumahan. Estate/Kebun/Afdeling otomatis dibuat bila belum ada. Nama yang sudah ada <b>dilewati</b> (impor boleh diulang). Baris tanpa koordinat memakai koordinat afdelingnya.
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
        Catatan: penghapusan dengan data terikat akan <b>ditolak server (409)</b> agar riwayat pemeriksaan, temuan, dan binding user tetap utuh. Struktur ini identik dengan aplikasi cek blok: peta app membaca koordinat perumahan/afdeling dari data master ini.
      </p>
    </div>
  );
}
