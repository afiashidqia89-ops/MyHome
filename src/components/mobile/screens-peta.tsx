"use client";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { useInspeksi, useTemuan } from "@/lib/queries";
import { fmtKoor, fmtTanggal, ringkasBinding } from "@/lib/utils-rl";
import { ScreenHeader } from "@/components/mobile/frame";
import { ChipStatus, LevelBadge } from "@/components/rl-bits";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const PetaMobileKlien = dynamic(() => import("./peta-mobile-klien").then((m) => m.PetaMobileKlien), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] w-full items-center justify-center bg-slate-200">
      <span className="flex items-center gap-2 text-[13px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat peta blok...</span>
    </div>
  ),
});

/** PETA BLOK — fungsi sistem aplikasi cek blok: lihat sebaran titik per afdeling,
 *  status warna hasil audit terakhir, lalu tap titik/daftar untuk mulai inspeksi. */
export function PetaBlokScreen() {
  const { session, master, setInspectPreselect, setMobileScreen } = useStore();
  const { data: inspections = [] } = useInspeksi(true);
  const { data: findings = [] } = useTemuan(true);
  if (!session) return null;
  const auditor = session.role === "AUDITOR";

  const info = (bid: string) => {
    const audits = inspections.filter((i) => i.barakId === bid && i.results.some((r) => r.status !== null)).sort((a, z) => z.tanggal.localeCompare(a.tanggal));
    const last = audits[0];
    const tnd = findings.filter((f) => f.barakId === bid && f.status !== "CLOSED");
    return { last, status: last ? (last.results.some((r) => r.status === "M") ? ("M" as const) : ("H" as const)) : ("N" as const), tnd };
  };

  const buka = (afdelingId: string, barakId: string) => {
    setInspectPreselect({ afdelingId, barakId });
    setMobileScreen("inspect-new");
  };

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Peta Rumah" sub={`${ringkasBinding(session.bindings)} • tap titik untuk mulai pemeriksaan • tombol panah kanan-atas = lokasi perangkat`} />
      <div className="flex-1 overflow-y-auto thin-scroll">
        <PetaMobileKlien />

        <div className="flex items-center justify-center gap-3 py-2 text-[11px] text-slate-600">
          <span className="flex items-center gap-1"><span className="h-3.5 w-3.5 rounded-full bg-[#1F7A41] border-2 border-white shadow" /> H — layak</span>
          <span className="flex items-center gap-1"><span className="h-3.5 w-3.5 rounded-full bg-[#D93025] border-2 border-white shadow" /> M — temuan</span>
          <span className="flex items-center gap-1"><span className="h-3.5 w-3.5 rounded-full bg-[#94a3b8] border-2 border-white shadow" /> Belum diaudit</span>
        </div>

        <div className="px-3 pb-4">
          <p className="mb-2 text-[12px] font-semibold text-slate-500">DAFTAR TITIK ({master?.baraks.length ?? 0} PERUMAHAN — {master?.afdelings.length ?? 0} AFDELING)</p>
          <div className="space-y-2">
            {(master?.baraks ?? []).map((b) => {
              const i = info(b.id);
              return (
                <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center gap-2">
                    <MapPin className={cn("h-4 w-4 shrink-0", i.status === "M" ? "text-red-600" : i.status === "H" ? "text-green-700" : "text-slate-400")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-slate-800">{b.nama}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {master?.afdelings.find((a) => a.id === b.afdelingId)?.nama ?? "-"} • {b.kapasitas} org
                        {i.last ? ` • audit ${fmtTanggal(i.last.tanggal)}` : " • belum diaudit"}
                      </p>
                      {i.tnd.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {i.tnd.slice(0, 3).map((f) => (
                            <span key={f.id} className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
                              <LevelBadge level={f.level} /> {f.kode}
                            </span>
                          ))}
                          {i.tnd.length > 3 && <span className="text-[10px] text-slate-400">+{i.tnd.length - 3} lagi</span>}
                        </div>
                      )}
                    </div>
                    <ChipStatus s={i.status === "N" ? "-" : i.status} className="scale-90" />
                    {auditor && (
                      <button
                        onClick={() => buka(b.afdelingId, b.id)}
                        className="shrink-0 rounded-lg bg-forest px-2.5 py-1.5 text-[11.5px] font-bold text-white hover:bg-forest-deep"
                      >
                        Periksa
                      </button>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-slate-400">{fmtKoor(b.koordinat?.lat, b.koordinat?.lng)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
