"use client";
// ============================================================
// RumahLayak — Menu DETAIL PEMERIKSAAN (portal web)
// Fitur:
//  • Rincian hasil pemeriksaan per item (27 item, 4 kartu) + foto
//  • Status perbaikan auditee per temuan (mana yang sudah close)
//    beserta bukti tindak lanjut — kartu kembali HIJAU saat semua
//    temuan sudah ditutup & diverifikasi (data Rekap ikut ter-update)
//  • Filter: Estate/Area → Kebun → Afdeling (sesuai binding akun)
//  • Filter rentang tanggal + pencarian
//  • Paginasi maksimal 10 baris per lembar
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { useStore, namaAfdeling, namaBarak, labelItem } from "@/lib/store";
import { fmtTanggal, fmtTanggalWaktu, kartuStatusDenganPerbaikan } from "@/lib/utils-rl";
import { ChipStatus, LevelBadge, StatusTemuanBadge, SlaInfo } from "@/components/rl-bits";
import { useInspeksi, useTemuan } from "@/lib/queries";
import { FilterWilayah, FilterTanggal, NavigasiHalaman, lolosFilterTanggal, potongHalaman } from "@/components/web/filter-bar";
import type { FilterWilayahValue, FilterTanggalValue } from "@/components/web/filter-bar";
import type { Finding, Foto, Inspection } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Camera, CheckCircle2, ChevronDown, ChevronUp, CircleDot, Loader2, MapPin, Search } from "lucide-react";

export function WebDetailPemeriksaan() {
  const { master } = useStore();
  const { data: inspections = [], isLoading } = useInspeksi(true);
  const { data: findings = [] } = useTemuan(true);

  const [wilayah, setWilayah] = useState<FilterWilayahValue>({ estateId: null, kebunId: null, afdelingId: null });
  const [tanggal, setTanggal] = useState<FilterTanggalValue>({ dari: "", sampai: "" });
  const [cari, setCari] = useState("");
  const [halaman, setHalaman] = useState(1);
  const [bukaId, setBukaId] = useState<string | null>(null);

  useEffect(() => setHalaman(1), [wilayah, tanggal, cari]);

  // Resolusi kaskade filter wilayah: estate -> kebun -> afdeling
  const afdelingIdsTerpilih = useMemo(() => {
    const kebunIds = new Set((master?.kebuns ?? []).filter((k) => !wilayah.estateId || k.estateId === wilayah.estateId).map((k) => k.id));
    return new Set(
      (master?.afdelings ?? [])
        .filter((a) => (!wilayah.kebunId || kebunIds.has(a.kebunId)) && (!wilayah.afdelingId || a.id === wilayah.afdelingId))
        .map((a) => a.id),
    );
  }, [master, wilayah]);

  const terfilter = useMemo(
    () =>
      inspections
        .filter((i) => (afdelingIdsTerpilih.size ? afdelingIdsTerpilih.has(i.afdelingId) : true))
        .filter((i) => lolosFilterTanggal(i.tanggal, tanggal))
        .filter((i) => {
          if (!cari.trim()) return true;
          const q = cari.toLowerCase();
          return i.kode.toLowerCase().includes(q) || namaBarak(i.barakId).toLowerCase().includes(q) || namaAfdeling(i.afdelingId).toLowerCase().includes(q);
        })
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.kode.localeCompare(a.kode)),
    [inspections, afdelingIdsTerpilih, tanggal, cari],
  );

  const { bagian, total, totalHalaman, mulai, akhir } = potongHalaman(terfilter, halaman, 10);

  return (
    <div className="space-y-4">
      {/* Filter wilayah + tanggal */}
      <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <FilterWilayah value={wilayah} onChange={setWilayah} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <FilterTanggal value={tanggal} onChange={setTanggal} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari kode / afdeling / perumahan…" className="h-9 w-[240px] pl-8 text-[12px]" />
          </div>
        </div>
        <p className="text-[10.5px] text-slate-400">
          Pilihan wilayah otomatis mengikuti unit tempat akun Anda didaftarkan (binding). Klik <b>Detail</b> untuk melihat rincian hasil item &amp; status perbaikan auditee.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[980px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-forest text-white">
              <th className="px-3 py-2.5 text-left font-bold">Tanggal</th>
              <th className="px-2 py-2.5 text-left font-bold">Kode</th>
              <th className="px-2 py-2.5 text-center font-bold">W</th>
              <th className="px-2 py-2.5 text-left font-bold">Afdeling / Perumahan</th>
              <th className="px-2 py-2.5 text-left font-bold">Auditor</th>
              <th className="px-2 py-2.5 text-center font-bold">H</th>
              <th className="px-2 py-2.5 text-center font-bold">M</th>
              <th className="px-2 py-2.5 text-center font-bold">% Kelayakan</th>
              <th className="px-2 py-2.5 text-left font-bold">Perbaikan Auditee</th>
              <th className="px-2 py-2.5 text-center font-bold">Sync</th>
              <th className="px-2 py-2.5 text-center font-bold">Detail</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            )}
            {!isLoading && bagian.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-[12px] text-slate-400">Tidak ada pemeriksaan yang cocok dengan filter.</td></tr>
            )}
            {bagian.map((i, idx) => (
              <BarisPemeriksaan key={i.id} insp={i} idx={idx} findings={findings} terbuka={bukaId === i.id} onToggle={() => setBukaId(bukaId === i.id ? null : i.id)} />
            ))}
          </tbody>
        </table>
        <NavigasiHalaman halaman={halaman} totalHalaman={totalHalaman} onChange={setHalaman} total={total} mulai={mulai} akhir={akhir} />
      </div>
    </div>
  );
}

// ---------- Satu baris pemeriksaan + panel detail yang bisa dibuka ----------
function BarisPemeriksaan({ insp, idx, findings, terbuka, onToggle }: {
  insp: Inspection;
  idx: number;
  findings: Finding[];
  terbuka: boolean;
  onToggle: () => void;
}) {
  const { master } = useStore();
  const rel = findings.filter((f) => f.inspectionId === insp.id);
  const ditutup = rel.filter((f) => f.status === "CLOSED").length;
  let h = 0;
  let m = 0;
  insp.results.forEach((r) => {
    if (r.status === "H") h++;
    if (r.status === "M") m++;
  });
  const dinilai = h + m;
  const pct = dinilai ? Math.round((h / dinilai) * 100) : null;

  return (
    <>
      <tr className={cn("border-t border-slate-100", idx % 2 === 1 && "bg-slate-50/60", terbuka && "bg-forest-soft/60")}>
        <td className="px-3 py-2 text-slate-600">{fmtTanggal(insp.tanggal)}</td>
        <td className="px-2 py-2 font-bold text-slate-700">{insp.kode}</td>
        <td className="px-2 py-2 text-center text-slate-500">W{insp.minggu}</td>
        <td className="px-2 py-2 text-slate-600">{namaAfdeling(insp.afdelingId)} — {namaBarak(insp.barakId)}</td>
        <td className="px-2 py-2 text-slate-600">{master?.users.find((u) => u.id === insp.auditorId)?.nama ?? "-"}</td>
        <td className="px-2 py-2 text-center font-bold text-green-700">{h}</td>
        <td className="px-2 py-2 text-center font-bold text-red-600">{m}</td>
        <td className="px-2 py-2 text-center">
          {pct === null ? <span className="text-slate-300">-</span> : (
            <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-bold", pct === 100 ? "bg-green-100 text-green-800" : pct >= 75 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700")}>{pct}%</span>
          )}
        </td>
        <td className="px-2 py-2">
          {rel.length === 0 ? (
            <span className="text-[11px] text-slate-400">tidak ada temuan</span>
          ) : ditutup === rel.length ? (
            <span className="inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-bold text-green-800"><CheckCircle2 className="h-3 w-3" /> {ditutup}/{rel.length} selesai ditutup</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800"><CircleDot className="h-3 w-3" /> {ditutup}/{rel.length} ditutup • {rel.length - ditutup} berjalan</span>
          )}
        </td>
        <td className="px-2 py-2 text-center text-[10px] font-bold text-slate-500">{insp.sync.toUpperCase()}</td>
        <td className="px-2 py-2 text-center">
          <Button variant="outline" onClick={onToggle} className="h-7 gap-1 bg-white px-2 text-[11px] font-bold text-forest hover:bg-forest hover:text-white">
            {terbuka ? <>Tutup <ChevronUp className="h-3 w-3" /></> : <>Detail <ChevronDown className="h-3 w-3" /></>}
          </Button>
        </td>
      </tr>
      {terbuka && (
        <tr className="border-t border-forest/20 bg-forest-soft/30">
          <td colSpan={11} className="px-4 py-4">
            <PanelDetail insp={insp} findings={findings} />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------- Panel rincian: hasil item per kartu + temuan & perbaikan ----------
function PanelDetail({ insp, findings }: { insp: Inspection; findings: Finding[] }) {
  const { master } = useStore();
  const rel = findings.filter((f) => f.inspectionId === insp.id);

  return (
    <div className="space-y-4">
      {/* Ringkasan pemeriksaan */}
      <div className="rounded-lg border bg-white p-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11.5px] text-slate-600">
          <span><b className="text-slate-800">{insp.kode}</b> • W{insp.minggu} • {fmtTanggal(insp.tanggal)}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-forest" /> {namaAfdeling(insp.afdelingId)} — {namaBarak(insp.barakId)}</span>
          <span>Auditor: <b>{master?.users.find((u) => u.id === insp.auditorId)?.nama ?? "-"}</b> • PIC: {insp.picLabel}</span>
          <span className="ml-auto font-bold text-slate-500">Sync: {insp.sync.toUpperCase()}</span>
        </div>
        {insp.kesimpulan ? <p className="mt-2 rounded bg-slate-50 p-2 text-[11.5px] text-slate-700"><b>Kesimpulan:</b> {insp.kesimpulan}</p> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Hasil item per kartu */}
        <div className="rounded-lg border bg-white p-3">
          <p className="mb-2 text-[12px] font-bold text-slate-800">Hasil Item Pemeriksaan (per kartu)</p>
          <div className="max-h-[420px] space-y-3 overflow-y-auto thin-scroll pr-1">
            {(master?.kartu ?? []).map((k) => {
              const { st, perbaikanSelesai } = kartuStatusDenganPerbaikan(insp, k.id, findings);
              const items = (master?.checklist ?? []).filter((c) => c.kartu === k.id);
              const hasil = new Map(insp.results.map((r) => [r.itemId, r]));
              return (
                <div key={k.id} className="rounded border border-slate-100">
                  <div className="flex items-center gap-2 border-b bg-slate-50 px-2.5 py-1.5">
                    <span className="text-[11px] font-bold text-slate-700">{k.id} • {k.nama}</span>
                    {perbaikanSelesai ? (
                      <span className="ml-auto inline-flex items-center gap-1 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white" title="Kartu kembali HIJAU — semua temuan kartu ini sudah ditutup & diverifikasi">
                        H <CheckCircle2 className="h-3 w-3" /> perbaikan selesai
                      </span>
                    ) : (
                      <span className="ml-auto"><ChipStatus s={st} /></span>
                    )}
                  </div>
                  <div className="divide-y divide-slate-50">
                    {items.map((c) => {
                      const r = hasil.get(c.id);
                      return (
                        <div key={c.id} className="flex items-start gap-2 px-2.5 py-1.5">
                          <span className="w-7 shrink-0 rounded bg-slate-100 px-1 py-0.5 text-center text-[10px] font-bold text-slate-600">{c.id}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11.5px] leading-snug text-slate-700">{c.label}</p>
                            {r?.catatan ? <p className="text-[10.5px] italic text-slate-500">Catatan: {r.catatan}</p> : null}
                          </div>
                          {r && r.fotos.length > 0 ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-slate-500"><Camera className="h-3 w-3" /> {r.fotos.length}</span>
                          ) : null}
                          <ChipStatus s={r?.status ?? "-"} className="shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Temuan & status perbaikan auditee */}
        <div className="rounded-lg border bg-white p-3">
          <p className="mb-1 text-[12px] font-bold text-slate-800">Temuan &amp; Status Perbaikan Auditee</p>
          <p className="mb-2 text-[10.5px] text-slate-500">Tandai hijau = perbaikan sudah ditutup &amp; diverifikasi auditor (Rekap Report ikut ter-update otomatis)</p>
          {rel.length === 0 ? (
            <p className="rounded border border-dashed border-slate-200 p-3 text-center text-[11.5px] text-slate-400">Tidak ada temuan pada pemeriksaan ini — semua item layak.</p>
          ) : (
            <div className="max-h-[420px] space-y-2.5 overflow-y-auto thin-scroll pr-1">
              {rel.map((f) => (
                <div key={f.id} className={cn("rounded border p-2.5", f.status === "CLOSED" ? "border-green-200 bg-green-50/60" : "border-slate-200")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelBadge level={f.level} />
                    <span className="text-[12px] font-bold text-slate-700">{f.kode}</span>
                    <StatusTemuanBadge status={f.status} />
                    <span className="ml-auto"><SlaInfo target={f.targetSelesai} /></span>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-snug text-slate-700">{f.uraian}</p>
                  <p className="text-[10.5px] text-slate-500">Item: {labelItem(f.itemId)} • {namaAfdeling(f.afdelingId)} — {namaBarak(f.barakId)}</p>
                  {f.mitigasiDarurat ? <p className="mt-1 rounded bg-orange-50 p-1.5 text-[10.5px] text-orange-800"><b>Mitigasi darurat:</b> {f.mitigasiDarurat}</p> : null}
                  {f.noWO ? <p className="text-[10.5px] text-slate-500"><b>No. WO:</b> {f.noWO}</p> : null}

                  {/* Riwayat tindak lanjut auditee + bukti foto */}
                  {f.followUps.length > 0 && (
                    <div className="mt-2 space-y-1.5 border-t border-dashed border-slate-200 pt-2">
                      {f.followUps.map((t) => (
                        <div key={t.id} className="rounded bg-slate-50 p-2">
                          <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
                            <span className="font-bold text-slate-700">{fmtTanggalWaktu(`${t.tanggal}T10:00:00Z`)}</span>
                            <span>oleh <b>{master?.users.find((u) => u.id === t.olehId)?.nama ?? "Auditee"}</b></span>
                            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", t.status === "VERIFIED" ? "bg-green-100 text-green-800" : "bg-sky-100 text-sky-800")}>
                              {t.status === "VERIFIED" ? "Bukti diverifikasi" : "Bukti terkirim"}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-snug text-slate-700">{t.uraian}</p>
                          {t.fotoUrl ? <GaleriFoto foto={{ id: t.id, dataUrl: t.fotoUrl, lat: 0, lng: 0, timestamp: t.tanggal, label: `Bukti ${f.kode}` }} /> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Galeri thumbnail foto (klik untuk perbesar via title) ----------
function GaleriFoto({ foto }: { foto: Foto }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <img
        src={foto.dataUrl}
        alt={foto.label}
        title={foto.label}
        className="h-16 w-24 cursor-zoom-in rounded border border-slate-200 bg-white object-cover"
        loading="lazy"
      />
    </div>
  );
}
