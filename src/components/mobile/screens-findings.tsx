"use client";
import { useState } from "react";
import { useStore, namaAfdeling, namaBarak } from "@/lib/store";
import { api } from "@/lib/api";
import { qk, useInspeksi, useRefresh, useTemuan } from "@/lib/queries";
import { fmtTanggal, fmtTanggalWaktu, generateFotoCanvas, kartuStatus } from "@/lib/utils-rl";
import { ScreenHeader } from "@/components/mobile/frame";
import { LevelBadge, SlaInfo, StatusTemuanBadge } from "@/components/rl-bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, ChevronRight, ClipboardCheck, Flag, Hammer, Loader2, MapPin, ShieldCheck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FindingStatus } from "@/lib/types";

const FILTERS: { id: "SEMUA" | FindingStatus; label: string }[] = [
  { id: "SEMUA", label: "Semua" },
  { id: "OPEN", label: "Belum Ditindak" },
  { id: "IN_PROGRESS", label: "Dikerjakan" },
  { id: "SUBMITTED", label: "Menunggu Verifikasi" },
  { id: "VERIFIED", label: "Bukti Disetujui" },
  { id: "CLOSED", label: "Selesai" },
];

// ============ DAFTAR TEMUAN ============
export function FindingsScreen() {
  const store = useStore();
  const { session, setActiveFinding, setMobileScreen } = store;
  const { data: findings = [], isLoading } = useTemuan(true);
  const [filter, setFilter] = useState<"SEMUA" | FindingStatus>("SEMUA");

  const list = (filter === "SEMUA" ? findings : findings.filter((f) => f.status === filter));

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Temuan & Tindak Lanjut" sub={session?.role === "AUDITEE" ? "Temuan yang ditugaskan kepada Anda (dari server)" : "Seluruh temuan pemeriksaan (dari server)"} />
      <div className="shrink-0 space-y-2 border-b bg-white px-3 py-2">
        <div className="flex gap-1.5 overflow-x-auto thin-scroll pb-1">
          {FILTERS.map((f) => {
            const n = f.id === "SEMUA" ? findings.length : findings.filter((x) => x.status === f.id).length;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold", filter === f.id ? "border-forest bg-forest text-white" : "border-slate-200 bg-white text-slate-600")}>
                {f.label} ({n})
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto thin-scroll p-3">
        {isLoading && <p className="mt-10 text-center text-[12px] text-slate-400"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Memuat dari server...</p>}
        {!isLoading && list.length === 0 && <p className="mt-10 text-center text-[12px] text-slate-400">Tidak ada temuan pada filter ini</p>}
        {list.map((f) => (
          <button key={f.id} onClick={() => { setActiveFinding(f.id); setMobileScreen("finding-detail"); }} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-forest">
            <div className="flex items-center gap-2">
              <LevelBadge level={f.level} />
              <span className="text-[12px] font-bold text-slate-800">{f.kode}</span>
              <StatusTemuanBadge status={f.status} />
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-600">{f.uraian}</p>
            <div className="mt-2 flex items-center justify-between border-t pt-2">
              <span className="flex items-center gap-1 text-[10px] text-slate-400"><MapPin className="h-3 w-3" /> {namaBarak(f.barakId)} • {namaAfdeling(f.afdelingId)}</span>
              <SlaInfo target={f.targetSelesai} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============ DETAIL TEMUAN ============
export function FindingDetailScreen() {
  const store = useStore();
  const { session, master, activeFindingId, setMobileScreen, setActiveFinding } = store;
  const { data: findings = [] } = useTemuan(true);
  const qc = useQueryClient();
  const refresh = useRefresh();
  const [uraian, setUraian] = useState("");
  const [foto, setFoto] = useState<{ dataUrl: string; lat: number; lng: number } | undefined>(undefined);
  const [mengirim, setMengirim] = useState(false);

  if (!session) return null;
  const f = findings.find((x) => x.id === activeFindingId);
  if (!f) {
    setMobileScreen("findings");
    return null;
  }
  const item = master?.checklist.find((c) => c.id === f.itemId);
  const lvl = master?.matriks.find((a) => a.level === f.level);
  const auditee = master?.users.find((u) => u.id === f.auditeeId);
  const sebagaiAuditee = session.role === "AUDITEE" && f.auditeeId === session.id;
  const sebagaiAuditor = session.role === "AUDITOR" || session.role === "ADMIN";

  const ambilFotoBukti = () => {
    setFoto({ dataUrl: generateFotoCanvas(`BUKTI PERBAIKAN • ${f.kode}`, `${namaBarak(f.barakId)} • ${new Date().toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`), lat: -0.05 + Math.random() * 0.01, lng: 109.3 + Math.random() * 0.03 });
    toast.success("Foto bukti tergeotag dilampirkan");
  };

  const tandaiProgres = async () => {
    try {
      await api.patch(`/api/temuan/${f.id}`, { status: "IN_PROGRESS" });
      qc.invalidateQueries({ queryKey: qk.temuan });
      refresh();
      toast.info("Temuan ditandai sedang dikerjakan (tersimpan di server)");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const kirim = async () => {
    if (!uraian.trim()) {
      toast.error("Uraian tindak lanjut wajib diisi");
      return;
    }
    setMengirim(true);
    try {
      await api.post(`/api/temuan/${f.id}/tindak-lanjut`, { uraian: uraian.trim(), foto });
      qc.invalidateQueries({ queryKey: qk.temuan });
      qc.invalidateQueries({ queryKey: qk.aktivitas });
      refresh();
      setUraian("");
      setFoto(undefined);
      toast.success("Bukti perbaikan terkirim ke server — menunggu verifikasi auditor");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMengirim(false);
    }
  };

  const verifikasi = async () => {
    try {
      await api.post(`/api/temuan/${f.id}/verifikasi`);
      qc.invalidateQueries({ queryKey: qk.temuan });
      qc.invalidateQueries({ queryKey: qk.aktivitas });
      refresh();
      toast.success(`${f.kode} ditutup — status kartu kembali HIJAU (tersimpan di server)`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        title={`${f.kode} — ${item?.label ?? f.itemId}`}
        sub={`${namaBarak(f.barakId)} • ${namaAfdeling(f.afdelingId)}`}
        onBack={() => { setActiveFinding(null); setMobileScreen("findings"); }}
        right={<LevelBadge level={f.level} />}
      />
      <div className="flex-1 space-y-3 overflow-y-auto thin-scroll p-3">
        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between">
            <StatusTemuanBadge status={f.status} />
            <SlaInfo target={f.targetSelesai} />
          </div>
          <p className="mt-2 text-[12px] font-semibold text-slate-700">Uraian Temuan Auditor</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">{f.uraian}</p>
          <p className="mt-2 text-[10px] text-slate-400">Dibuat {fmtTanggalWaktu(f.createdAt)} oleh auditor • PIC perbaikan: {auditee?.nama ?? "belum ditugaskan"}</p>
        </div>

        {lvl && (
          <div className="rounded-xl border border-forest/30 bg-forest-soft p-3">
            <p className="text-[10px] font-bold text-forest">JALUR & APPROVAL (MATRIKS GUIDELINE)</p>
            <p className="mt-1 text-[12px] font-bold text-slate-700">Level {f.level} — {lvl.jalur}</p>
            <p className="text-[10.5px] text-slate-500">Sumber dana: {lvl.sumberDana}</p>
            <div className="mt-2 flex items-center gap-1 text-[10px]">
              <span className="rounded bg-white px-1.5 py-1 shadow-sm">{lvl.pengaju}</span>
              <span className="text-slate-400">→</span>
              <span className="rounded bg-white px-1.5 py-1 shadow-sm">{lvl.verifikator}</span>
              <span className="text-slate-400">→</span>
              <span className="rounded bg-gold px-1.5 py-1 font-semibold text-forest-deep">{lvl.final}</span>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">SLA: {lvl.sla}</p>
            {f.noWO && <p className="mt-1 inline-block rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-forest">No. WO: {f.noWO}</p>}
          </div>
        )}

        {f.mitigasiDarurat && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800"><ShieldCheck className="h-4 w-4" /> MITIGASI DARURAT (Hari Itu Juga)</p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-900">{f.mitigasiDarurat}</p>
          </div>
        )}

        <div className="rounded-xl border bg-white p-3">
          <p className="text-[10px] font-bold text-slate-500">TIMELINE TINDAK LANJUT ({f.followUps.length})</p>
          {f.followUps.length === 0 && <p className="mt-2 text-[11px] italic text-slate-400">Belum ada tindak lanjut dari auditee.</p>}
          <div className="mt-2 space-y-2">
            {f.followUps.map((fu) => {
              const oleh = master?.users.find((u) => u.id === fu.olehId);
              return (
                <div key={fu.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <div className="flex items-center gap-1.5">
                    {fu.status === "VERIFIED" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <ClipboardCheck className="h-3.5 w-3.5 text-sky-600" />}
                    <span className="text-[11px] font-bold text-slate-700">{oleh?.nama ?? "User"}</span>
                    <span className={cn("ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold", fu.status === "VERIFIED" ? "bg-green-100 text-green-700" : "bg-sky-100 text-sky-700")}>{fu.status === "VERIFIED" ? "TERVERIFIKASI" : "MENUNGGU VERIFIKASI"}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{fu.uraian}</p>
                  {fu.fotoUrl && (
                    <img src={fu.fotoUrl} alt={`Bukti ${f.kode}`} className="mt-1.5 w-full rounded-lg border object-cover" />
                  )}
                  <p className="mt-1 text-[9.5px] text-slate-400">{fmtTanggal(fu.tanggal)}</p>
                </div>
              );
            })}
          </div>
        </div>

        {sebagaiAuditee && (f.status === "OPEN" || f.status === "IN_PROGRESS" || f.status === "SUBMITTED") && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-sky-800"><Wrench className="h-4 w-4" /> TINDAK LANJUT AUDITEE</p>
            {f.status === "OPEN" && (
              <Button variant="outline" onClick={tandaiProgres} className="mt-2 h-9 w-full border-sky-300 text-[11.5px] text-sky-800">
                <Hammer className="mr-1.5 h-4 w-4" /> Tandai Sedang Dikerjakan
              </Button>
            )}
            <p className="mt-2 text-[10px] font-bold text-slate-500">LAMPIRKAN HASIL PERBAIKAN</p>
            <Textarea value={uraian} onChange={(e) => setUraian(e.target.value)} placeholder="Uraikan pekerjaan yang dilakukan, material, dan hasilnya..." className="mt-1 min-h-[64px] bg-white text-[11.5px]" />
            <div className="mt-2 flex gap-2">
              <Button variant="outline" onClick={ambilFotoBukti} className="h-10 flex-1 border-dashed bg-white text-[11.5px] text-forest">
                <Camera className="mr-1.5 h-4 w-4" /> {foto ? "Foto Terlampir (ganti)" : "Ambil Foto Bukti"}
              </Button>
            </div>
            {foto && (
              <img src={foto.dataUrl} alt="Pratinjau bukti" className="mt-2 w-full rounded-lg border object-cover" />
            )}
            <Button onClick={kirim} disabled={mengirim} className="mt-2 h-11 w-full bg-forest text-[12px] font-bold hover:bg-forest-deep">
              {mengirim ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Flag className="mr-1.5 h-4 w-4" />}
              Kirim Bukti Perbaikan ke Server
            </Button>
          </div>
        )}

        {sebagaiAuditor && (f.status === "SUBMITTED" || f.status === "VERIFIED") && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="h-11 w-full bg-green-700 text-[12px] font-bold hover:bg-green-800">
                <ShieldCheck className="mr-1.5 h-4 w-4" /> Verifikasi & Tutup Temuan (Closing)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[320px] rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-[14px]">Verifikasi Penutupan — {f.kode}</AlertDialogTitle>
                <AlertDialogDescription className="text-[12px]">
                  Pastikan perbaikan sudah diverifikasi langsung di lapangan dan berfungsi normal. Setelah ditutup, kartu Kamishibai boleh dibalik kembali ke HIJAU (Langkah 4 Guideline Auditor).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-9 text-[12px]">Batal</AlertDialogCancel>
                <AlertDialogAction className="h-9 bg-green-700 text-[12px]" onClick={verifikasi}>
                  Ya, Tutup Temuan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

// ============ RIWAYAT ============
export function HistoryScreen() {
  const store = useStore();
  const { master, setActiveFinding, setMobileScreen } = store;
  const { data: inspections = [] } = useInspeksi(true);
  const { data: findings = [] } = useTemuan(true);
  const [minggu, setMinggu] = useState<number | "SEMUA">("SEMUA");

  const list = inspections
    .filter((i) => i.results.some((r) => r.status !== null))
    .filter((i) => (minggu === "SEMUA" ? true : i.minggu === minggu))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.kode.localeCompare(a.kode));

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Riwayat Pemeriksaan" sub="Arsip pemeriksaan — tersimpan di database server" />
      <div className="shrink-0 flex gap-1.5 overflow-x-auto thin-scroll border-b bg-white px-3 py-2">
        {(["SEMUA", 1, 2, 3, 4] as const).map((w) => (
          <button key={w} onClick={() => setMinggu(w)} className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold", minggu === w ? "border-forest bg-forest text-white" : "border-slate-200 bg-white text-slate-600")}>
            {w === "SEMUA" ? "Semua Minggu" : `Minggu ${w}`}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto thin-scroll p-3">
        {list.map((i) => {
          const auditor = master?.users.find((u) => u.id === i.auditorId);
          const tnd = findings.filter((f) => f.inspectionId === i.id);
          return (
            <button key={i.id} onClick={() => { setActiveFinding(tnd[0]?.id ?? null); setMobileScreen(tnd.length ? "finding-detail" : "history"); }} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-forest">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-800">{i.kode}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", i.sync === "synced" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500")}>{i.sync === "synced" ? "TER-SYNC" : "DRAFT"}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">{fmtTanggal(i.tanggal)} • {namaBarak(i.barakId)} • {namaAfdeling(i.afdelingId)}</p>
              <p className="text-[10px] text-slate-400">Auditor: {auditor?.nama ?? "-"} ({i.picLabel}){tnd.length ? ` • ${tnd.length} temuan` : ""}</p>
              <div className="mt-1.5 flex gap-1.5">
                {(master?.kartu ?? []).map((k) => (
                  <span key={k.id} className={cn("flex h-5 w-9 items-center justify-center rounded text-[10px] font-bold text-white", kartuStatus(i, k.id) === "H" ? "bg-green-600" : kartuStatus(i, k.id) === "M" ? "bg-red-600" : "bg-slate-300")}>
                    {k.id.replace("KMS-0", "K")}
                  </span>
                ))}
                <ChevronRight className="ml-auto h-4 w-4 self-center text-slate-300" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
