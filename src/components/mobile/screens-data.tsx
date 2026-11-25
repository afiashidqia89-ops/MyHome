"use client";
import { useStore, namaAfdeling, namaBarak } from "@/lib/store";
import { useInspeksi } from "@/lib/queries";
import { hitungPapan } from "@/lib/utils-rl";
import { JALUR_CONTOH, JALUR_KRITERIA, LANGKAH_AUDITOR } from "@/lib/data";
import { ScreenHeader } from "@/components/mobile/frame";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// "DataScreen" DIHAPUS dari navigasi — fiturnya (ekspor XLSX/JSON, unduh master)
// dipindah ke layar Profil, bagian "DATA & EKSPOR" (konsolidasi menu).

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
