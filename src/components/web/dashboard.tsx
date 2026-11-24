"use client";
import { useMemo } from "react";
import { useStore, namaAfdeling, namaBarak } from "@/lib/store";
import { fmtTanggalWaktu, ringkasBinding, statDashboard } from "@/lib/utils-rl";
import { LevelBadge, StatCard, StatusTemuanBadge, SlaInfo } from "@/components/rl-bits";
import { useAktivitas, useInspeksi, useTemuan } from "@/lib/queries";
import { AlertTriangle, BadgeCheck, CheckCircle2, ClipboardList, Flag, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const LEVEL_COLORS = ["#84cc16", "#eab308", "#ea580c", "#b91c1c"];

export function WebDashboard() {
  const { session, master, setWebPage } = useStore();
  const { data: inspections = [] } = useInspeksi(true);
  const { data: findings = [] } = useTemuan(true);
  const { data: aksiLog = [] } = useAktivitas(true);

  const stats = useMemo(() => statDashboard(inspections, findings), [inspections, findings]);

  const perKartu = useMemo(() =>
    (master?.kartu ?? []).map((k) => {
      let h = 0;
      let m = 0;
      inspections.forEach((i) => {
        i.results.forEach((r) => {
          const kartuId = `KMS-0${r.itemId[0] === "A" ? 1 : r.itemId[0] === "B" ? 2 : r.itemId[0] === "C" ? 3 : 4}`;
          if (kartuId === k.id && r.status === "H") h++;
          if (kartuId === k.id && r.status === "M") m++;
        });
      });
      return { kartu: k.singkat, hijau: h, merah: m };
    }),
    [inspections, master],
  );

  const menungguVerifikasi = findings.filter((f) => f.status === "SUBMITTED");
  const overdue = findings.filter((f) => f.status !== "CLOSED" && new Date(`${f.targetSelesai}T00:00:00+07:00`) < new Date());

  const pieData = stats.byLevel.filter((l) => l.jumlah > 0).map((l, idx) => ({ name: `Level ${l.level}`, value: l.jumlah, fill: LEVEL_COLORS[idx] }));

  // AUDITEE: dashboard fokus tugas tindak lanjut — bukan rekap kinerja auditor
  if (session?.role === "AUDITEE") return <DashboardAuditee />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="% Kelayakan Bulan Ini" value={`${stats.pctKelayakan}%`} sub={`${stats.itemH} hijau • ${stats.itemM} merah dari ${stats.itemH + stats.itemM} item`} icon={<BadgeCheck className="h-4 w-4" />} />
        <StatCard title="Kartu Pemeriksaan" value={stats.totalInspeksi} sub={`${stats.selesai} selesai • ${stats.totalInspeksi - stats.selesai} terjadwal`} icon={<ClipboardList className="h-4 w-4" />} accent="sky" />
        <StatCard title="Temuan Terbuka" value={stats.temuanTerbuka} sub={`${stats.temuanClosed} sudah ditutup`} icon={<Flag className="h-4 w-4" />} accent="red" />
        <StatCard title="Lewat SLA" value={stats.temuanOverdue} sub="butuh eskalasi mitigasi" icon={<AlertTriangle className="h-4 w-4" />} accent="gold" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-slate-800">Tren Kelayakan Mingguan (Kamishibai)</h3>
              <p className="text-[11px] text-slate-500">Persentase item HIJAU per minggu audit — target 100%</p>
            </div>
            <TrendingUp className="h-4 w-4 text-forest" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.tren}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e4" />
                <XAxis dataKey="minggu" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(v: number | string) => [`${v}%`, "Kelayakan"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="pct" stroke="#1F7A41" strokeWidth={3} dot={{ r: 5, fill: "#D4AF37" }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-bold text-slate-800">Temuan per Level Approval</h3>
          <p className="text-[11px] text-slate-500">Jalur Swakelola (Lv.1–2) vs GS Project (Lv.3–4)</p>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {pieData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-bold text-slate-800">Hijau vs Merah per Kartu Pemeriksaan</h3>
          <p className="text-[11px] text-slate-500">Kumulatif penilaian item {master?.periodeAktif ?? "bulan ini"}</p>
          <div className="mt-2 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perKartu}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e4" />
                <XAxis dataKey="kartu" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="hijau" name="Hijau (layak)" fill="#1F7A41" radius={[4, 4, 0, 0]} />
                <Bar dataKey="merah" name="Merah (temuan)" fill="#D93025" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-bold text-slate-800">Aktivitas Terbaru (Audit Trail Server)</h3>
          <p className="text-[11px] text-slate-500">Semua aksi pengguna dicatat di tabel AksiLog</p>
          <div className="mt-3 max-h-60 space-y-2 overflow-y-auto thin-scroll pr-1">
            {aksiLog.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" />
                <div>
                  <p className="text-[11.5px] leading-snug text-slate-700">{a.aksi}</p>
                  <p className="text-[10px] text-slate-400">{a.aktor} • {fmtTanggalWaktu(a.waktu)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-bold text-slate-800">Menunggu Verifikasi Auditor ({menungguVerifikasi.length})</h3>
          <p className="text-[11px] text-slate-500">Auditee sudah melampirkan bukti perbaikan</p>
          <div className="mt-3 space-y-2">
            {menungguVerifikasi.length === 0 && <p className="text-[12px] italic text-slate-400">Tidak ada antrean verifikasi.</p>}
            {menungguVerifikasi.map((f) => (
              <button key={f.id} onClick={() => setWebPage("rekap")} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-left hover:border-forest">
                <LevelBadge level={f.level} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-slate-700">{f.kode} • {namaBarak(f.barakId)}</p>
                  <p className="truncate text-[10.5px] text-slate-500">{f.uraian}</p>
                </div>
                <StatusTemuanBadge status={f.status} />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-bold text-slate-800">Peringatan SLA ({overdue.length})</h3>
          <p className="text-[11px] text-slate-500">Target penyelesaian terlampaui — perlu mitigasi darurat/eskalasi</p>
          <div className="mt-3 space-y-2">
            {overdue.length === 0 && <p className="text-[12px] italic text-slate-400">Semua temuan masih dalam batas SLA.</p>}
            {overdue.map((f) => (
              <div key={f.id} className="rounded-lg border border-red-100 bg-red-50 p-2.5">
                <div className="flex items-center gap-2">
                  <LevelBadge level={f.level} />
                  <p className="text-[12px] font-bold text-red-800">{f.kode}</p>
                  <span className="ml-auto text-[10px] font-semibold text-red-600">Target {f.targetSelesai}</span>
                </div>
                <p className="mt-1 text-[10.5px] text-red-900">{namaAfdeling(f.afdelingId)} • {namaBarak(f.barakId)} • {f.uraian}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400">Sumber data: PostgreSQL server (sinkron langsung dari APK auditor/auditee) • {master?.users.length ?? 0} pengguna aktif • sesi: {session?.nama} ({session?.role})</p>
    </div>
  );
}

// ============ DASHBOARD AUDITEE — fokus tugas tindak lanjut yang ditugaskan ============
function DashboardAuditee() {
  const { session, setWebPage } = useStore();
  const { data: findings = [] } = useTemuan(true);

  const perluTindak = findings.filter((f) => f.status === "OPEN" || f.status === "IN_PROGRESS");
  const menungguVerif = findings.filter((f) => f.status === "SUBMITTED");
  const selesai = findings.filter((f) => f.status === "VERIFIED" || f.status === "CLOSED");
  const overdue = findings.filter((f) => f.status !== "CLOSED" && new Date(`${f.targetSelesai}T00:00:00+07:00`) < new Date());
  const urutSla = (a: typeof findings[number], b: typeof findings[number]) => a.targetSelesai.localeCompare(b.targetSelesai);

  // Di portal web, daftar temuan dilihat lewat halaman Rekap (detail & eksekusi tetap di APK)
  const bukaRekap = () => setWebPage("rekap");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
        <p className="text-[12.5px] font-bold text-sky-900">Peran Anda: AUDITEE — PIC perbaikan temuan</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-sky-800">
          Dashboard ini hanya menampilkan <b>temuan yang ditugaskan kepada Anda</b> ({findings.length} tugas) di {session?.afdelingNama ? `Afdeling ${session.afdelingNama}` : "kebun Anda"}.
          Kerjakan perbaikan, unggah foto bukti, lalu kirim untuk diverifikasi auditor. Jalur eksekusi & matriks approval tersedia di tab <b>Panduan</b> APK Mobile.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Perlu Tindak" value={perluTindak.length} sub="belum disubmit ke auditor" icon={<ClipboardList className="h-4 w-4" />} accent="red" />
        <StatCard title="Menunggu Verifikasi" value={menungguVerif.length} sub="bukti sudah terkirim" icon={<Flag className="h-4 w-4" />} accent="sky" />
        <StatCard title="Selesai" value={selesai.length} sub="terverifikasi & ditutup" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard title="Lewat SLA" value={overdue.length} sub="segera kerjakan / eskalasi" icon={<AlertTriangle className="h-4 w-4" />} accent="gold" />
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="text-[13px] font-bold text-slate-800">Tugas Saya — Perlu Ditindak ({perluTindak.length})</h3>
        <p className="text-[11px] text-slate-500">Temuan status BARU / SEDANG DIKERJAKAN — kerjakan lalu kirim bukti dari APK Mobile</p>
        <div className="mt-3 space-y-2">
          {perluTindak.length === 0 && <p className="text-[12px] italic text-slate-400">Tidak ada tugas tertunda — bagus, pertahankan!</p>}
          {[...perluTindak].sort(urutSla).map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2.5">
              <LevelBadge level={f.level} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-slate-700">{f.kode} • {namaBarak(f.barakId)} • {namaAfdeling(f.afdelingId)}</p>
                <p className="truncate text-[10.5px] text-slate-500">{f.uraian}</p>
              </div>
              <SlaInfo target={f.targetSelesai} />
              <StatusTemuanBadge status={f.status} />
              <Button onClick={bukaRekap} className="h-8 shrink-0 bg-forest px-3 text-[11px] hover:bg-forest-deep">Lihat di Rekap</Button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-bold text-slate-800">Menunggu Verifikasi Auditor ({menungguVerif.length})</h3>
          <p className="text-[11px] text-slate-500">Bukti perbaikan Anda sedang diperiksa auditor di lapangan</p>
          <div className="mt-3 space-y-2">
            {menungguVerif.length === 0 && <p className="text-[12px] italic text-slate-400">Tidak ada bukti yang menunggu verifikasi.</p>}
            {menungguVerif.map((f) => (
              <button key={f.id} onClick={bukaRekap} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-left hover:border-forest">
                <LevelBadge level={f.level} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-slate-700">{f.kode} • {namaBarak(f.barakId)}</p>
                  <p className="truncate text-[10.5px] text-slate-500">{f.uraian}</p>
                </div>
                <StatusTemuanBadge status={f.status} />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-bold text-slate-800">Selesai ({selesai.length})</h3>
          <p className="text-[11px] text-slate-500">Riwayat perbaikan yang sudah diverifikasi & ditutup auditor</p>
          <div className="mt-3 space-y-2">
            {selesai.length === 0 && <p className="text-[12px] italic text-slate-400">Belum ada tugas yang selesai.</p>}
            {selesai.slice(0, 6).map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5">
                <LevelBadge level={f.level} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-slate-700">{f.kode} • {namaBarak(f.barakId)}</p>
                  <p className="truncate text-[10.5px] text-slate-500">{f.uraian}</p>
                </div>
                <StatusTemuanBadge status={f.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400">Sumber data: PostgreSQL server • temuan ter-scope otomatis ke akun Anda ({session?.nama}, {session?.role} • {ringkasBinding(session?.bindings, session?.kebunNama ?? "-")})</p>
    </div>
  );
}
