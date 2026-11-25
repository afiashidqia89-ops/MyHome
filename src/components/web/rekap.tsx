"use client";
// ============================================================
// RumahLayak — Papan Rekap Kamishibai (portal web)
// Fitur:
//  • Paginasi maksimal 10 baris per lembar + tombol lembaran lanjut
//  • ADMIN: hapus pemeriksaan — centang beberapa baris sekaligus
//  • Filter tanggal, Estate/Area → Kebun → Afdeling (sesuai binding)
//  • Kartu MERAH kembali HIJAU bila seluruh temuan sudah ditutup
//    & diverifikasi (data rekap ter-update bersamaan dengan Detail
//    Pemeriksaan — Langkah 4 Guideline)
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore, namaAfdeling, namaBarak } from "@/lib/store";
import { hitungPapan, tingkatPemenuhan } from "@/lib/utils-rl";
import { ChipStatus } from "@/components/rl-bits";
import { useInspeksi, useTemuan, qk } from "@/lib/queries";
import { api, unduhExport } from "@/lib/api";
import { FilterWilayah, FilterTanggal, NavigasiHalaman, lolosFilterTanggal, potongHalaman } from "@/components/web/filter-bar";
import type { FilterWilayahValue, FilterTanggalValue } from "@/components/web/filter-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CheckCircle2, FileSpreadsheet, Loader2, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PER_HALAMAN = 10;

export function WebRekap() {
  const qc = useQueryClient();
  const { master, session } = useStore();
  const { data: inspections = [] } = useInspeksi(true);
  const { data: findings = [] } = useTemuan(true);
  const [minggu, setMinggu] = useState<number | "SEMUA">("SEMUA");
  const [wilayah, setWilayah] = useState<FilterWilayahValue>({ estateId: null, kebunId: null, afdelingId: null });
  const [tanggal, setTanggal] = useState<FilterTanggalValue>({ dari: "", sampai: "" });
  const [halaman, setHalaman] = useState(1);
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [menghapus, setMenghapus] = useState(false);
  const admin = session?.role === "ADMIN";

  useEffect(() => setHalaman(1), [wilayah, tanggal, minggu]);

  // Resolusi kaskade filter wilayah: estate -> kebun -> afdeling
  const afdelingIdsTerpilih = useMemo(() => {
    const kebunIds = new Set((master?.kebuns ?? []).filter((k) => !wilayah.estateId || k.estateId === wilayah.estateId).map((k) => k.id));
    return new Set(
      (master?.afdelings ?? [])
        .filter((a) => (!wilayah.kebunId || kebunIds.has(a.kebunId)) && (!wilayah.afdelingId || a.id === wilayah.afdelingId))
        .map((a) => a.id),
    );
  }, [master, wilayah]);

  const semuaBaris = useMemo(
    () =>
      hitungPapan(inspections, (id) => master?.users.find((u) => u.id === id)?.nama ?? "-", namaBarak, namaAfdeling, master?.periodeAktif, findings).filter((r) => {
        // temukan afdeling pemeriksaan untuk scoping kebun + filter rentang tanggal
        const insp = inspections.find((i) => i.id === r.id);
        return insp ? afdelingIdsTerpilih.has(insp.afdelingId) && lolosFilterTanggal(insp.tanggal, tanggal) : false;
      }),
    [inspections, findings, master, afdelingIdsTerpilih, tanggal],
  );

  const rows = useMemo(() => semuaBaris.filter((r) => (minggu === "SEMUA" ? true : r.minggu === minggu)), [semuaBaris, minggu]);
  const { bagian, total, totalHalaman, mulai, akhir } = potongHalaman(rows, halaman, PER_HALAMAN);
  const pemenuhan = tingkatPemenuhan(rows);

  const ekspor = async () => {
    try {
      await unduhExport(
        "/api/export/xlsx",
        `RumahLayak_Kamishibai_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast.success("Rekap Kamishibai diunduh sebagai XLSX (4 sheet, dibangun di server)");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // ---------- Hapus multi-centang (ADMIN) ----------
  const togglePilih = (id: string) => {
    setTerpilih((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const semuaTerpilih = bagian.length > 0 && bagian.every((r) => terpilih.has(r.id));
  const pilihSemuaHalaman = () => {
    setTerpilih((s) => {
      const n = new Set(s);
      if (semuaTerpilih) bagian.forEach((r) => n.delete(r.id));
      else bagian.forEach((r) => n.add(r.id));
      return n;
    });
  };
  const hapusTerpilih = async () => {
    if (terpilih.size === 0) return;
    setMenghapus(true);
    let ok = 0;
    let gagal = 0;
    for (const id of terpilih) {
      try {
        await api.del(`/api/inspeksi/${id}`);
        ok++;
      } catch {
        gagal++;
      }
    }
    setMenghapus(false);
    setTerpilih(new Set());
    qc.invalidateQueries({ queryKey: qk.inspeksi });
    qc.invalidateQueries({ queryKey: qk.temuan });
    qc.invalidateQueries({ queryKey: qk.aktivitas });
    qc.invalidateQueries({ queryKey: qk.master });
    if (gagal === 0) toast.success(`${ok} pemeriksaan berhasil dihapus (beserta temuan & tindak lanjutnya)`);
    else toast.warning(`${ok} dihapus, ${gagal} gagal — coba segarkan halaman`);
  };

  return (
    <div className="space-y-4">
      {/* Filter: wilayah (sesuai binding) + tanggal + minggu + export */}
      <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <FilterWilayah value={wilayah} onChange={setWilayah} />
          <Button onClick={ekspor} className="bg-forest text-[12px] font-semibold hover:bg-forest-deep">
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export XLSX
          </Button>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <FilterTanggal value={tanggal} onChange={setTanggal} />
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Minggu Audit</p>
            <div className="flex gap-1">
              {(["SEMUA", 1, 2, 3, 4] as const).map((w) => (
                <button key={w} onClick={() => setMinggu(w)} className={cn("rounded-lg border px-3 py-1.5 text-[11px] font-bold", minggu === w ? "border-forest bg-forest text-white" : "border-slate-200 bg-white text-slate-600 hover:border-forest")}>
                  {w === "SEMUA" ? "Semua" : `W${w}`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[10.5px] text-slate-400">
          Pilihan wilayah otomatis mengikuti unit tempat akun Anda didaftarkan (binding){admin ? "" : " — hanya admin corporate dapat melihat lintas kebun"}.
        </p>
      </div>

      {/* Bar aksi hapus (ADMIN) */}
      {admin && terpilih.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <span className="text-[12px] font-bold text-red-800">{terpilih.size} pemeriksaan dicentang</span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={menghapus} className="h-8 bg-red-600 text-[11.5px] font-bold hover:bg-red-700">
                {menghapus ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Menghapus…</> : <><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus terpilih</>}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus {terpilih.size} pemeriksaan?</AlertDialogTitle>
                <AlertDialogDescription>
                  Seluruh data pemeriksaan terpilih dihapus permanen — termasuk hasil item, foto tergeotag, temuan, dan tindak lanjutnya. Aksi ini tidak bisa dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={hapusTerpilih} className="bg-red-600 hover:bg-red-700">Ya, hapus permanen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" onClick={() => setTerpilih(new Set())} className="h-8 text-[11.5px]">Batal pilih semua</Button>
        </div>
      )}

      {/* Papan Kamishibai */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[1080px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-forest text-white">
              {admin && (
                <th className="w-9 px-2 py-2.5 text-center font-bold">
                  <Checkbox checked={semuaTerpilih} onCheckedChange={pilihSemuaHalaman} aria-label="Pilih semua di lembar ini" className="border-white data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-forest" />
                </th>
              )}
              <th className="px-3 py-2.5 text-left font-bold">Kartu Audit</th>
              <th className="px-2 py-2.5 text-center font-bold">W</th>
              <th className="px-2 py-2.5 text-center font-bold">PIC</th>
              <th className="px-2 py-2.5 text-left font-bold">Auditor</th>
              <th className="px-2 py-2.5 text-left font-bold">Afdeling / Perumahan</th>
              {(master?.kartu ?? []).map((k) => (
                <th key={k.id} className="px-2 py-2.5 text-center font-bold">{k.singkat}</th>
              ))}
              <th className="px-2 py-2.5 text-center font-bold">H</th>
              <th className="px-2 py-2.5 text-center font-bold">M</th>
              <th className="px-2 py-2.5 text-center font-bold">% Kelayakan</th>
              <th className="px-2 py-2.5 text-center font-bold">Sync</th>
            </tr>
          </thead>
          <tbody>
            {bagian.map((r, idx) => (
              <tr key={r.id} className={cn("border-t border-slate-100", idx % 2 === 1 && "bg-slate-50/60", terpilih.has(r.id) && "bg-red-50/70")}>
                {admin && (
                  <td className="px-2 py-2 text-center">
                    <Checkbox checked={terpilih.has(r.id)} onCheckedChange={() => togglePilih(r.id)} aria-label={`Pilih ${r.kode}`} />
                  </td>
                )}
                <td className="px-3 py-2 font-bold text-slate-700">{r.kode}</td>
                <td className="px-2 py-2 text-center text-slate-500">W{r.minggu}</td>
                <td className="px-2 py-2 text-center">
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold text-white", r.pic === "EM" ? "bg-forest" : "bg-gold-deep")}>{r.pic}</span>
                </td>
                <td className="px-2 py-2 text-slate-600">{r.auditor}</td>
                <td className="px-2 py-2 text-slate-600">{r.afdeling} — {r.barak}</td>
                {(master?.kartu ?? []).map((k) => {
                  const selesai = r.perbaikanSelesai[k.id];
                  return (
                    <td key={k.id} className="px-2 py-2 text-center">
                      {selesai ? (
                        <span
                          className="inline-flex h-6 min-w-8 items-center justify-center gap-0.5 rounded bg-green-600 px-1 text-[12px] font-bold text-white shadow-sm"
                          title="Kartu kembali HIJAU — semua temuan kartu ini sudah diperbaiki auditee, diverifikasi & ditutup"
                        >
                          H<CheckCircle2 className="h-3 w-3" />
                        </span>
                      ) : (
                        <ChipStatus s={r.status[k.id]} className="mx-auto" />
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center font-bold text-green-700">{r.h}</td>
                <td className="px-2 py-2 text-center font-bold text-red-600">{r.m}</td>
                <td className="px-2 py-2 text-center">
                  {r.pct === null ? <span className="text-slate-300">-</span> : (
                    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-bold", r.pct === 100 ? "bg-green-100 text-green-800" : r.pct >= 75 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700")}>{r.pct}%</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center text-[10px] font-bold text-slate-500">{inspections.find((i) => i.id === r.id)?.sync.toUpperCase()}</td>
              </tr>
            ))}
            {/* Baris ringkasan */}
            <tr className="border-t-2 border-forest/40 bg-forest-soft font-bold text-forest">
              <td className="px-3 py-2.5" colSpan={admin ? 6 : 5}>TINGKAT PEMENUHAN KEBUTUHAN DASAR PER KARTU (%)</td>
              {(master?.kartu ?? []).map((k) => {
                const d = pemenuhan.perKartu[k.id];
                const tot = d.h + d.m;
                const pct = tot ? Math.round((d.h / tot) * 100) : 0;
                return (
                  <td key={k.id} className="px-2 py-2.5 text-center">{tot ? `${pct}%` : "-"}</td>
                );
              })}
              <td className="px-2 py-2.5 text-center">{pemenuhan.totalH}</td>
              <td className="px-2 py-2.5 text-center">{pemenuhan.totalM}</td>
              <td className="px-2 py-2.5 text-center">{pemenuhan.pct}%</td>
              <td className="px-2 py-2.5" />
            </tr>
          </tbody>
        </table>
        <NavigasiHalaman halaman={halaman} totalHalaman={totalHalaman} onChange={setHalaman} total={total} mulai={mulai} akhir={akhir} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5"><ChipStatus s="H" /> HIJAU — memenuhi standar layak</span>
        <span className="flex items-center gap-1.5"><span className="inline-flex h-6 min-w-8 items-center justify-center rounded bg-green-600 px-1 text-[12px] font-bold text-white">H<CheckCircle2 className="h-3 w-3" /></span> Hijau hasil perbaikan — temuan sudah ditutup &amp; diverifikasi</span>
        <span className="flex items-center gap-1.5"><ChipStatus s="M" /> MERAH — temuan, kartu dibalik &amp; wajib tindak lanjut</span>
        <span className="flex items-center gap-1.5"><ChipStatus s="-" /> Belum diperiksa (terjadwal)</span>
        <span className="ml-auto flex items-center gap-1.5 font-semibold text-forest"><Target className="h-3.5 w-3.5" /> Target: 100% Hijau sebelum akhir periode</span>
      </div>
    </div>
  );
}
