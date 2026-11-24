"use client";
import { useState } from "react";
import { useStore, namaAfdeling, namaBarak } from "@/lib/store";
import { hitungPapan, tingkatPemenuhan } from "@/lib/utils-rl";
import { ChipStatus } from "@/components/rl-bits";
import { useInspeksi } from "@/lib/queries";
import { unduhExport } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileSpreadsheet, Target, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WebRekap() {
  const { master, session, rekapKebunId, setRekapKebun } = useStore();
  const { data: inspections = [] } = useInspeksi(true);
  const [minggu, setMinggu] = useState<number | "SEMUA">("SEMUA");
  const admin = session?.role === "ADMIN";

  // Binding kebun: auditor tidak dapat memilih kebun lain (server sudah membatasi data)
  const kebunAktif = admin ? (rekapKebunId ?? master?.kebuns[0]?.id ?? null) : (master?.scopeKebunId ?? master?.kebuns[0]?.id ?? null);

  const afdelingIds = new Set((master?.afdelings ?? []).filter((a) => !kebunAktif || a.kebunId === kebunAktif).map((a) => a.id));
  const rows = hitungPapan(inspections, (id) => master?.users.find((u) => u.id === id)?.nama ?? "-", namaBarak, namaAfdeling, master?.periodeAktif)
    .filter((r) => {
      // temukan afdeling pemeriksaan untuk scoping kebun
      const insp = inspections.find((i) => i.id === r.id);
      return insp ? afdelingIds.has(insp.afdelingId) : false;
    })
    .filter((r) => (minggu === "SEMUA" ? true : r.minggu === minggu));

  const pemenuhan = tingkatPemenuhan(rows);
  const ekspor = async () => {
    try {
      await unduhExport(
        admin && kebunAktif ? `/api/export/xlsx?kebunId=${kebunAktif}` : "/api/export/xlsx",
        `RumahLayak_Kamishibai_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast.success("Rekap Kamishibai diunduh sebagai XLSX (4 sheet, dibangun di server)");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <div className="min-w-[200px]">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400">Kebun {!admin && <LockKeyhole className="h-3 w-3 text-gold-deep" />}</p>
          {admin ? (
            <Select value={kebunAktif ?? ""} onValueChange={setRekapKebun}>
              <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(master?.kebuns ?? []).map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-600">
              {(master?.kebuns ?? []).find((k) => k.id === kebunAktif)?.nama ?? "—"} (otomatis dari binding akun)
            </div>
          )}
        </div>
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
        <Button onClick={ekspor} className="ml-auto bg-forest text-[12px] font-semibold hover:bg-forest-deep">
          <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export XLSX
        </Button>
      </div>

      {/* Papan Kamishibai */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[1050px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-forest text-white">
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
            {rows.map((r, idx) => (
              <tr key={r.id} className={cn("border-t border-slate-100", idx % 2 === 1 && "bg-slate-50/60")}>
                <td className="px-3 py-2 font-bold text-slate-700">{r.kode}</td>
                <td className="px-2 py-2 text-center text-slate-500">W{r.minggu}</td>
                <td className="px-2 py-2 text-center">
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold text-white", r.pic === "EM" ? "bg-forest" : "bg-gold-deep")}>{r.pic}</span>
                </td>
                <td className="px-2 py-2 text-slate-600">{r.auditor}</td>
                <td className="px-2 py-2 text-slate-600">{r.afdeling} — {r.barak}</td>
                {(master?.kartu ?? []).map((k) => (
                  <td key={k.id} className="px-2 py-2 text-center">
                    <ChipStatus s={r.status[k.id]} className="mx-auto" />
                  </td>
                ))}
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
              <td className="px-3 py-2.5" colSpan={6}>TINGKAT PEMENUHAN KEBUTUHAN DASAR PER KARTU (%)</td>
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
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5"><ChipStatus s="H" /> HIJAU — memenuhi standar layak</span>
        <span className="flex items-center gap-1.5"><ChipStatus s="M" /> MERAH — temuan, kartu dibalik & wajib tindak lanjut</span>
        <span className="flex items-center gap-1.5"><ChipStatus s="-" /> Belum diperiksa (terjadwal)</span>
        <span className="ml-auto flex items-center gap-1.5 font-semibold text-forest"><Target className="h-3.5 w-3.5" /> Target: 100% Hijau sebelum akhir periode</span>
      </div>
    </div>
  );
}
