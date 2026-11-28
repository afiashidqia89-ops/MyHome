"use client";
// ============================================================
// RumahLayak — BERANDA (layar pertama SEMUA peran setelah login)
//
// Isi:
//   • Kartu sapaan (nama, jabatan, peran, binding unit)
//   • Banner aksi utama per peran: lanjutkan draft / mulai pemeriksaan /
//     tugas tindak lanjut / pantau corporate
//   • Kartu status ANTREAN OFFLINE (pengiriman manual lewat menu Data)
//   • Statistik ringkas periode aktif + akses cepat menu
// ============================================================
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useInspeksi, useTemuan } from "@/lib/queries";
import { bacaSinkronTerakhir, hitungAntrean } from "@/lib/offline";
import type { HasilSinkron } from "@/lib/offline";
import { fmtTanggalWaktu, ringkasBinding } from "@/lib/utils-rl";
import { ScreenHeader } from "@/components/mobile/frame";
import { LogoMark } from "@/components/mobile/screens-core";
import { Camera, ClipboardCheck, Database, Flag, MapPinned, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export function BerandaScreen() {
  const { session, master, draft, setMobileScreen } = useStore();
  const { data: inspections = [] } = useInspeksi(true);
  const { data: findings = [] } = useTemuan(true);
  const [antre, setAntre] = useState(0);
  const [sinkronTerakhir, setSinkronTerakhir] = useState<HasilSinkron | null>(null);

  useEffect(() => {
    setAntre(hitungAntrean());
    setSinkronTerakhir(bacaSinkronTerakhir());
  }, []);

  if (!session) return null;

  const auditor = session.role === "AUDITOR";
  const auditee = session.role === "AUDITEE";
  const periode = master?.periodeAktif ?? "";

  const pemeriksaanPeriode = inspections.filter(
    (i) => i.periode === periode && i.results.some((r) => r.status !== null),
  );
  const temuanAktif = findings.filter((f) => f.status !== "CLOSED");
  const tugasSaya = auditee
    ? findings.filter((f) => f.auditeeId === session.id && (f.status === "OPEN" || f.status === "IN_PROGRESS"))
    : temuanAktif.filter((f) => f.status === "OPEN");

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Beranda" sub={`${periode ? `Periode ${periode}` : "RumahLayak"} — Kamishibai Emplasemen`} />

      <div className="flex-1 space-y-3 overflow-y-auto thin-scroll p-3">
        {/* ---- SAPAAN ---- */}
        <div className="rounded-2xl bg-gradient-to-br from-forest to-forest-deep p-4 text-white">
          <div className="flex items-center gap-3">
            <LogoMark size={44} />
            <div className="min-w-0">
              <p className="truncate text-[16px] font-bold">Halo, {session.nama.split(" ")[0]}</p>
              <p className="truncate text-[12px] text-white/70">{session.jabatan}</p>
            </div>
            <span className="ml-auto shrink-0 rounded bg-gold px-2 py-0.5 text-[11px] font-bold text-forest-deep">{session.role}</span>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[11.5px] text-white/75">
            Binding: {ringkasBinding(session.bindings, "Corporate — seluruh kebun")}
          </p>
        </div>

        {/* ---- BANNER AKSI UTAMA (per peran) ---- */}
        {auditor && draft.barakId ? (
          <button onClick={() => setMobileScreen("inspect")} className="w-full rounded-2xl border-2 border-gold bg-gold-soft p-4 text-left transition hover:brightness-105">
            <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-forest-deep"><Camera className="h-4 w-4" /> DRAFT PEMERIKSAAN BELUM DISIMPAN</p>
            <p className="mt-1 text-[12px] text-slate-600">Anda punya pemeriksaan yang sedang berjalan. Lanjutkan menilai item lalu simpan — data masuk perangkat, dikirim otomatis saat online atau lewat menu Data.</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-forest px-3 py-1.5 text-[12px] font-bold text-white">Lanjutkan Draft <ClipboardCheck className="h-3.5 w-3.5" /></span>
          </button>
        ) : auditor ? (
          <button onClick={() => setMobileScreen("peta")} className="w-full rounded-2xl bg-forest p-4 text-left text-white transition hover:bg-forest-deep">
            <p className="flex items-center gap-1.5 text-[13.5px] font-bold"><Camera className="h-4 w-4" /> MULAI PEMERIKSAAN HARI INI</p>
            <p className="mt-1 text-[12px] text-white/80">Pilih perumahan lewat Peta Rumah, tag koordinat sekali, nilai 27 item, lalu simpan (aman walau sinyal lemah).</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-[12px] font-bold">Buka Peta Rumah <MapPinned className="h-3.5 w-3.5" /></span>
          </button>
        ) : auditee ? (
          <button onClick={() => setMobileScreen("findings")} className="w-full rounded-2xl bg-forest p-4 text-left text-white transition hover:bg-forest-deep">
            <p className="flex items-center gap-1.5 text-[13.5px] font-bold"><Wrench className="h-4 w-4" /> TUGAS TINDAK LANJUT ANDA</p>
            <p className="mt-1 text-[12px] text-white/80">
              {tugasSaya.length > 0
                ? `${tugasSaya.length} temuan menunggu perbaikan/bukti dari Anda. Kerjakan lalu kirim foto bukti lewat layar Temuan.`
                : "Tidak ada temuan aktif atas nama Anda — bagus! Periksa layar Temuan untuk arsip."}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-[12px] font-bold">Buka Temuan <Flag className="h-3.5 w-3.5" /></span>
          </button>
        ) : (
          <button onClick={() => setMobileScreen("findings")} className="w-full rounded-2xl bg-forest p-4 text-left text-white transition hover:bg-forest-deep">
            <p className="flex items-center gap-1.5 text-[13.5px] font-bold"><Flag className="h-4 w-4" /> PANTAUAN CORPORATE</p>
            <p className="mt-1 text-[12px] text-white/80">{temuanAktif.length} temuan aktif di seluruh kebun. Portal web (desktop) menyediakan Dashboard, Rekap & manajemen user.</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-[12px] font-bold">Buka Temuan <Flag className="h-3.5 w-3.5" /></span>
          </button>
        )}

        {/* ---- ANTREAN OFFLINE & SINKRONISASI (banner pemeriksaan offline — pengiriman manual di menu Data) ---- */}
        <div className="rounded-2xl border bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-bold text-slate-500">STATUS DATA &amp; SINKRONISASI</p>
            {antre > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{antre} menunggu</span>}
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-600">
            {antre > 0
              ? <><b className="text-amber-700">{antre} data tersimpan aman di perangkat</b> (pemeriksaan/temuan/perubahan) — belum terkirim ke server.</>
              : "Semua data pemeriksaan sudah tersinkron dengan server."}
            {sinkronTerakhir ? ` Sinkron terakhir: ${fmtTanggalWaktu(sinkronTerakhir.waktu)}.` : ""}
          </p>
        </div>

        {/* ---- STATISTIK PERIODE ---- */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border bg-white p-2.5 text-center">
            <p className="text-[18px] font-extrabold text-forest">{pemeriksaanPeriode.length}</p>
            <p className="text-[10px] leading-tight text-slate-500">pemeriksaan<br />{periode || "periode ini"}</p>
          </div>
          <div className="rounded-xl border bg-white p-2.5 text-center">
            <p className={cn("text-[18px] font-extrabold", temuanAktif.length ? "text-red-600" : "text-forest")}>{temuanAktif.length}</p>
            <p className="text-[10px] leading-tight text-slate-500">temuan<br />aktif</p>
          </div>
          <div className="rounded-xl border bg-white p-2.5 text-center">
            <p className="text-[18px] font-extrabold text-forest">{master?.baraks.length ?? 0}</p>
            <p className="text-[10px] leading-tight text-slate-500">perumahan<br />unit terikat</p>
          </div>
        </div>

        {/* ---- AKSES CEPAT ---- */}
        <div className="rounded-2xl border bg-white p-3">
          <p className="text-[12px] font-bold text-slate-500">AKSES CEPAT</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {auditor && (
              <>
                <button onClick={() => setMobileScreen("inspect-new")} className="flex flex-col items-center gap-1 rounded-xl bg-forest-soft p-3 text-forest transition hover:bg-forest hover:text-white">
                  <Camera className="h-5 w-5" /><span className="text-[11px] font-bold">Periksa</span>
                </button>
                <button onClick={() => setMobileScreen("peta")} className="flex flex-col items-center gap-1 rounded-xl bg-forest-soft p-3 text-forest transition hover:bg-forest hover:text-white">
                  <MapPinned className="h-5 w-5" /><span className="text-[11px] font-bold">Peta Rumah</span>
                </button>
              </>
            )}
            <button onClick={() => setMobileScreen("findings")} className="flex flex-col items-center gap-1 rounded-xl bg-forest-soft p-3 text-forest transition hover:bg-forest hover:text-white">
              <Flag className="h-5 w-5" /><span className="text-[11px] font-bold">Temuan</span>
            </button>
            {!auditor && (
              <button onClick={() => setMobileScreen("guideline")} className="flex flex-col items-center gap-1 rounded-xl bg-forest-soft p-3 text-forest transition hover:bg-forest hover:text-white">
                <Wrench className="h-5 w-5" /><span className="text-[11px] font-bold">Panduan</span>
              </button>
            )}
            <button onClick={() => setMobileScreen("profile")} className="flex flex-col items-center gap-1 rounded-xl bg-forest-soft p-3 text-forest transition hover:bg-forest hover:text-white">
              <Database className="h-5 w-5" /><span className="text-[11px] font-bold">Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
