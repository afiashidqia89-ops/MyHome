"use client";
import { useState } from "react";
import { useStore, namaAfdeling } from "@/lib/store";
import { fmtKoor, fmtTanggal } from "@/lib/utils-rl";
import { ChipStatus, LevelBadge } from "@/components/rl-bits";
import { useInspeksi, useTemuan } from "@/lib/queries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const PetaKlien = dynamic(() => import("./peta-klien").then((m) => m.PetaKlien), {
  ssr: false,
  loading: () => (
    <div className="flex h-[430px] w-full items-center justify-center rounded-xl bg-slate-200">
      <span className="text-[12px] text-slate-500">Memuat peta lokasi pemeriksaan...</span>
    </div>
  ),
});

export function WebPeta() {
  const { session, master, rekapKebunId, setRekapKebun } = useStore();
  const { data: inspections = [] } = useInspeksi(true);
  const { data: findings = [] } = useTemuan(true);
  const [afdeling, setAfdeling] = useState("SEMUA");
  const admin = session?.role === "ADMIN";
  const kebunAktif = admin ? (rekapKebunId ?? master?.kebuns[0]?.id ?? null) : (master?.scopeKebunId ?? master?.kebuns[0]?.id ?? null);

  const afdList = (master?.afdelings ?? []).filter((a) => !kebunAktif || a.kebunId === kebunAktif);
  const list = (master?.baraks ?? []).filter((b) => afdList.some((a) => a.id === b.afdelingId)).filter((b) => afdeling === "SEMUA" || b.afdelingId === afdeling);

  const info = (bid: string) => {
    const last = inspections.filter((i) => i.barakId === bid && i.results.some((r) => r.status !== null)).sort((a, z) => z.tanggal.localeCompare(a.tanggal))[0];
    const tnd = findings.filter((f) => f.barakId === bid && f.status !== "CLOSED");
    return {
      last,
      status: last ? (last.results.some((r) => r.status === "M") ? ("M" as const) : ("H" as const)) : ("N" as const),
      tnd,
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
        {admin && (
          <div className="min-w-[200px]">
            <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Kebun</p>
            <Select value={kebunAktif ?? ""} onValueChange={setRekapKebun}>
              <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(master?.kebuns ?? []).map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="min-w-[200px]">
          <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Filter Afdeling</p>
          <Select value={afdeling} onValueChange={setAfdeling}>
            <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SEMUA">Semua Afdeling</SelectItem>
              {afdList.map((af) => (
                <SelectItem key={af.id} value={af.id}>{af.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded-full bg-[#1F7A41] border-2 border-white shadow" /> H — layak</span>
          <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded-full bg-[#D93025] border-2 border-white shadow" /> M — ada temuan</span>
          <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded-full bg-[#94a3b8] border-2 border-white shadow" /> Belum diaudit</span>
        </div>
        <p className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-forest">
          <Radar className="h-4 w-4" /> {list.filter((b) => b.koordinat).length} titik GPS perumahan{list.some((b) => !b.koordinat) ? ` • ${list.filter((b) => !b.koordinat).length} belum berkoordinat` : ""} • koordinat dari foto auditor
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border shadow-sm">
        <PetaKlien filterAfdeling={afdeling} kebunAktif={kebunAktif} />
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="text-[13px] font-bold text-slate-800">Daftar Titik Pemeriksaan</h3>
        <p className="text-[11px] text-slate-500">Koordinat perumahan + hasil audit terakhir dari database server</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => {
            const i = info(b.id);
            return (
              <div key={b.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <MapPin className={cn("h-4 w-4", i.status === "M" ? "text-red-600" : i.status === "H" ? "text-green-700" : "text-slate-400")} />
                  <p className="text-[12.5px] font-bold text-slate-800">{b.nama}</p>
                  <ChipStatus s={i.status === "N" ? "-" : i.status} className="ml-auto scale-90" />
                </div>
                <p className="mt-1 text-[10.5px] text-slate-500">{namaAfdeling(b.afdelingId)} • {b.kapasitas} orang</p>
                <p className="font-mono text-[10px] text-slate-400">{fmtKoor(b.koordinat?.lat, b.koordinat?.lng)}</p>
                <div className="mt-1.5 border-t pt-1.5">
                  {i.last ? (
                    <>
                      <p className="text-[10.5px] text-slate-600">Audit terakhir: <b>{i.last.kode}</b> • {fmtTanggal(i.last.tanggal)}</p>
                      {i.tnd.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {i.tnd.map((f) => (
                            <span key={f.id} className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
                              <LevelBadge level={f.level} /> {f.kode}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[10.5px] italic text-slate-400">Belum diaudit</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
