"use client";
import { useState } from "react";
import { useStore, namaAfdeling, namaBarak } from "@/lib/store";
import { unduhExport } from "@/lib/api";
import { qk, useInspeksi, useRefresh, useTemuan } from "@/lib/queries";
import { hitungPapan } from "@/lib/utils-rl";
import { JALUR_CONTOH, JALUR_KRITERIA, LANGKAH_AUDITOR } from "@/lib/data";
import { ScreenHeader } from "@/components/mobile/frame";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CloudUpload, Database, Download, FileJson, FileSpreadsheet, Loader2, RefreshCcw, Server } from "lucide-react";
import { cn } from "@/lib/utils";

export function DataScreen() {
  const store = useStore();
  const { master } = store;
  const { data: inspections = [], isFetching: fIns } = useInspeksi(true);
  const { data: findings = [] } = useTemuan(true);
  const refresh = useRefresh();
  const qc = useQueryClient();
  const [mUnduh, setMUnduh] = useState(false);

  const synced = inspections.filter((i) => i.sync === "synced").length;
  const draft = inspections.length - synced;

  const eksporXlsx = async () => {
    try {
      await unduhExport("/api/export/xlsx", `RumahLayak_Kamishibai_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("File XLSX diunduh (4 sheet: Papan, Riwayat, Temuan, Pengguna)");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const eksporJson = async () => {
    try {
      await unduhExport("/api/export/json", `RumahLayak_data_${new Date().toISOString().slice(0, 10)}.json`);
      toast.success("File JSON (paket sync) diunduh dari server");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const unduhMaster = async () => {
    setMUnduh(true);
    try {
      await qc.invalidateQueries({ queryKey: qk.master });
      await qc.refetchQueries({ queryKey: qk.master });
      toast.success(`Master data terbaru terunduh (${master?.checklist.length ?? 27} item • ${master?.baraks.length ?? 9} perumahan • ${master?.afdelings.length ?? 4} afdeling • ${master?.users.length ?? 8} user)`);
    } finally {
      setMUnduh(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Data & Sinkronisasi" sub="Server produksi • PostgreSQL (Neon-ready)" />
      <div className="flex-1 space-y-3 overflow-y-auto thin-scroll p-3">
        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center gap-2">
            <CloudUpload className="h-4 w-4 text-forest" />
            <p className="text-[12px] font-bold text-slate-700">Status Sinkronisasi</p>
            <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">LANGSUNG KE SERVER</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg bg-slate-50 p-2">
              <p className="text-[16px] font-bold text-slate-800">{inspections.length}</p>
              <p className="text-[9px] text-slate-500">pemeriksaan</p>
            </div>
            <div className="rounded-lg bg-green-50 p-2">
              <p className="text-[16px] font-bold text-green-700">{synced}</p>
              <p className="text-[9px] text-green-700">ter-sync</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2">
              <p className="text-[16px] font-bold text-amber-700">{draft}</p>
              <p className="text-[9px] text-amber-700">draft lokal</p>
            </div>
          </div>
          <p className="mt-2 text-[10.5px] text-slate-500">Semua transaksi tersimpan langsung ke database server (transaksi atomik). {fIns ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null}</p>
          <Button onClick={refresh} variant="outline" className="mt-2 h-9 w-full text-[11.5px] text-forest">
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Tarik Data Terbaru dari Server
          </Button>
        </div>

        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-forest" />
            <p className="text-[12px] font-bold text-slate-700">Kirim Data (XLSX & JSON)</p>
          </div>
          <p className="mt-1 text-[10.5px] text-slate-500">Ekspor dibangun di server dari database — {namaBarak(master?.baraks[0]?.id ?? "")} dst., konsisten dengan papan web.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button onClick={eksporXlsx} variant="outline" className="h-10 border-forest text-[11.5px] font-semibold text-forest hover:bg-forest-soft">
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Export XLSX
            </Button>
            <Button onClick={eksporJson} variant="outline" className="h-10 border-forest text-[11.5px] font-semibold text-forest hover:bg-forest-soft">
              <FileJson className="mr-1 h-4 w-4" /> Export JSON
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-forest" />
            <p className="text-[12px] font-bold text-slate-700">Download Master Data</p>
          </div>
          <p className="mt-1 text-[10.5px] text-slate-500">Checklist 27 item pemeriksaan, perumahan, afdeling, matriks approval & user — dari REST API.</p>
          <Button onClick={unduhMaster} disabled={mUnduh} className="mt-2 h-10 w-full bg-gold text-[12px] font-bold text-forest-deep hover:bg-gold-deep hover:text-white">
            {mUnduh ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Mengunduh...</> : <><Download className="mr-1.5 h-4 w-4" /> Unduh Master Data Terbaru</>}
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] text-slate-600">
            <span className="rounded bg-slate-50 px-2 py-1">Checklist: {master?.kartu.length ?? 4} kartu / {master?.checklist.length ?? 27} item</span>
            <span className="rounded bg-slate-50 px-2 py-1">Perumahan: {master?.baraks.length ?? 0} lokasi</span>
            <span className="rounded bg-slate-50 px-2 py-1">Afdeling: {master?.afdelings.length ?? 0}</span>
            <span className="rounded bg-slate-50 px-2 py-1">Kebun: {master?.kebuns.length ?? 0} • Estate: {master?.estates.length ?? 0}</span>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600"><Server className="h-3.5 w-3.5" /> STRATEGI OFFLINE-FIRST (APK CAPACITOR)</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[10px] leading-relaxed text-slate-500">
            <li>Web app saat ini menyimpan langsung ke server (satu sumber kebenaran).</li>
            <li>APK (Capacitor): transaksi disimpan lokal (SQLite/IndexedDB) dengan status <i>draft → queued → synced</i>.</li>
            <li>Service worker mengirim antrian otomatis saat perangkat kembali online.</li>
            <li>Upload foto terkompresi (JPEG q0.72) + koordinat watermark — kolom <i>Foto.dataUrl</i> di server.</li>
            <li>Master data di-cache; hanya berubah saat admin memperbarui di portal web.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============ GUIDELINE / PANDUAN (adaptif per peran) ============
export function GuidelineScreen() {
  const { session, guidelineTab, setGuidelineTab, master } = useStore();
  const { data: inspections = [] } = useInspeksi(true);
  const auditor = session?.role === "AUDITOR";
  // Tab "Langkah Auditor" hanya untuk auditor — auditee/admin fokus jalur & matriks
  const tabs = [
    { id: "jalur" as const, label: "Jalur Eksekusi" },
    { id: "level" as const, label: "Matriks Level" },
    ...(auditor ? [{ id: "langkah" as const, label: "Langkah Auditor" }] : []),
  ];
  const tab = !auditor && guidelineTab === "langkah" ? ("jalur" as const) : guidelineTab;
  const rows = hitungPapan(inspections, (id) => master?.users.find((u) => u.id === id)?.nama ?? "-", namaBarak, namaAfdeling, master?.periodeAktif);

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        title={auditor ? "Guideline Auditor" : "Panduan Temuan & Tindak Lanjut"}
        sub={auditor ? "Jalur solusi temuan & matriks approval" : "Jalur eksekusi, matriks level & SLA perbaikan temuan"}
      />
      <div className={cn("shrink-0 grid gap-1 border-b bg-white p-2", auditor ? "grid-cols-3" : "grid-cols-2")}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setGuidelineTab(t.id)} className={cn("rounded-lg py-2 text-[10.5px] font-bold", tab === t.id ? "bg-forest text-white" : "bg-slate-100 text-slate-600")}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto thin-scroll p-3">
        {tab === "jalur" && (
          <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-slate-500">Klasifikasi jalur eksekusi temuan emplasemen perumahan menentukan siapa yang mengerjakan, dari mana dana, dan berapa lama target penyelesaiannya.</p>
            <div className="rounded-xl border bg-white p-3">
              <p className="text-[12px] font-bold text-forest">JALUR A — Swakelola / Internal Tim Kebun</p>
              <div className="mt-2 space-y-2">
                {JALUR_KRITERIA.map((k) => (
                  <div key={k.aspek} className="rounded-lg bg-forest-soft p-2">
                    <p className="text-[10px] font-bold text-forest">{k.aspek}</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-600">{k.jalurA}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] font-bold text-slate-500">CONTOH TEMUAN:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10.5px] text-slate-600">
                {JALUR_CONTOH.jalurA.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border bg-white p-3">
              <p className="text-[12px] font-bold text-orange-700">JALUR B — Support GS Project (POU) / Corporate</p>
              <div className="mt-2 space-y-2">
                {JALUR_KRITERIA.map((k) => (
                  <div key={k.aspek} className="rounded-lg bg-orange-50 p-2">
                    <p className="text-[10px] font-bold text-orange-700">{k.aspek}</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-600">{k.jalurB}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] font-bold text-slate-500">CONTOH TEMUAN:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10.5px] text-slate-600">
                {JALUR_CONTOH.jalurB.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          </div>
        )}

        {tab === "level" && (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-slate-500">{auditor ? "Jenjang persetujuan & target SLA penyelesaian untuk setiap temuan yang dicatat auditor." : "Level temuan menentukan siapa yang menyetujui dan berapa lama target perbaikan Anda (SLA)."}</p>
            {(master?.matriks ?? []).map((a) => (
              <div key={a.level} className="rounded-xl border bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-bold text-white", a.level === 1 ? "bg-lime-600" : a.level === 2 ? "bg-amber-500" : a.level === 3 ? "bg-orange-600" : "bg-red-700")}>{a.level}</span>
                  <p className="text-[12px] font-bold text-slate-800">{a.jalur}</p>
                </div>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-600">{a.kategori}</p>
                <div className="mt-2 space-y-1 border-t pt-2 text-[10px] text-slate-500">
                  <p><b className="text-slate-700">Pengaju:</b> {a.pengaju}</p>
                  <p><b className="text-slate-700">Verifikator teknis:</b> {a.verifikator}</p>
                  <p><b className="text-slate-700">Final approval:</b> <span className="font-bold text-gold-deep">{a.final}</span></p>
                  <p><b className="text-slate-700">SLA:</b> {a.sla}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "langkah" && (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-slate-500">Prosedur wajib auditor saat menemukan status MERAH di lapangan.</p>
            {LANGKAH_AUDITOR.map((l, i) => (
              <div key={l.judul} className="rounded-xl border bg-white p-3">
                <p className="flex items-center gap-2 text-[12px] font-bold text-forest">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest text-[11px] font-bold text-white">{i + 1}</span>
                  {l.judul.replace(/^Langkah \d+ — /, "")}
                </p>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-600">{l.isi}</p>
              </div>
            ))}
            <div className="rounded-xl border border-green-200 bg-green-50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-green-800"><CheckCircle2 className="h-4 w-4" /> Papan Saat Ini</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-green-900">
                {rows.filter((r) => r.status["KMS-01"] === "M" || r.status["KMS-02"] === "M" || r.status["KMS-03"] === "M" || r.status["KMS-04"] === "M").length} dari {rows.length} baris papan periode {master?.periodeAktif ?? ""} masih memiliki kartu MERAH yang menunggu verifikasi penutupan.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
