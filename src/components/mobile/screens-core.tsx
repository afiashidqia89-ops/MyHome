"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, apiUrl, clearToken, getServerUrl, normalisasiServerUrl, setServerUrl, setToken, unduhExport } from "@/lib/api";
import { bacaMasterCache, hapusMasterCache, simpanMasterCache } from "@/lib/master-cache";
import type { MasterCache } from "@/lib/master-cache";
import { autoSinkron, bacaSinkronTerakhir, hitungAntrean, simpanAkun, sinkronAntrean, verifikasiAkunOffline } from "@/lib/offline";
import type { HasilSinkron } from "@/lib/offline";
import { VERSI_APLIKASI, bandingkanVersi } from "@/lib/version";
import { cn } from "@/lib/utils";
import { qk, useRefresh } from "@/lib/queries";
import { fmtTanggalWaktu, ringkasBinding } from "@/lib/utils-rl";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Database, Download, ExternalLink, FileJson, FileSpreadsheet, HardDriveDownload, Loader2, LockKeyhole, LogOut, RefreshCw, Server, Settings, Upload, Wifi, X } from "lucide-react";
import { ScreenHeader, layarAwal } from "@/components/mobile/frame";
import type { SessionUser } from "@/lib/types";

export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#14532D" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="#D4AF37" strokeWidth="2.5" />
      <path d="M16 34 L32 18 L48 34" fill="none" stroke="#D4AF37" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="21" y="33" width="22" height="14" rx="1.5" fill="#F7FBF8" />
      <rect x="29.5" y="38" width="5" height="9" fill="#14532D" />
      <rect x="23" y="36" width="4" height="4" fill="#1F7A41" />
      <rect x="37" y="36" width="4" height="4" fill="#1F7A41" />
    </svg>
  );
}

// ============ LOGIN (tanpa pemilihan kebun — binding dari pendaftaran) ============
// Tampilan produksi: TANPA blok "AKUN DEMO" / tombol akses cepat /
// sandi terisi otomatis — user memasukkan akun sendiri.
export function LoginScreen() {
  const setSession = useStore((s) => s.setSession);
  const setMobileScreen = useStore((s) => s.setMobileScreen);
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [kirim, setKirim] = useState(false);
  const [pengaturan, setPengaturan] = useState(false);

  const masuk = async (pengguna?: string, sandi?: string) => {
    setKirim(true);
    const nama = pengguna ?? username;
    const sandiEfektif = sandi ?? pw;
    try {
      const res = await api.post<{ user: SessionUser; token: string }>(
        "/api/auth/login",
        { username: nama, password: sandiEfektif },
      );
      setToken(res.token); // sesi Bearer — tetap hidup di iframe preview & WebView Capacitor
      void simpanAkun(res.user, sandiEfektif); // cache utk login OFFLINE berikutnya
      qc.setQueryData(qk.session, { authenticated: true as const, user: res.user });
      qc.invalidateQueries({ queryKey: qk.master });
      setMobileScreen(layarAwal(res.user.role)); // langsung ke layar kerja utama sesuai peran
      toast.success(
        res.user.bindings?.length
          ? `Selamat datang, ${res.user.nama} — terikat ${ringkasBinding(res.user.bindings)}`
          : `Selamat datang, ${res.user.nama}`,
      );
      // Antrean offline (pemeriksaan/temuan saat sinyal hilang) dikirim otomatis
      const hasil = await autoSinkron(qc);
      if (hasil && hasil.kirim > 0) {
        toast.success(`${hasil.kirim} data offline berhasil dikirim ke server`);
        qc.invalidateQueries({ queryKey: qk.inspeksi });
        qc.invalidateQueries({ queryKey: qk.temuan });
      }
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      if (status === 0) {
        // Server tak terjangkau → login OFFLINE dari akun cache perangkat
        const u = await verifikasiAkunOffline(nama, sandiEfektif);
        if (u) {
          setToken("offline");
          qc.setQueryData(qk.session, { authenticated: true as const, user: u });
          setMobileScreen(layarAwal(u.role));
          toast.info(`MODE OFFLINE — halo ${u.nama}. Data baru disimpan di perangkat & otomatis terkirim saat online.`);
          return;
        }
        toast.error("Server tidak terjangkau & akun belum pernah login di perangkat ini — sambungkan internet lalu coba lagi.");
        return;
      }
      toast.error((e as Error).message);
    } finally {
      setKirim(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-forest-deep via-forest to-forest-deep text-white">
      {/* Gear kanan-atas: Set IP, data master offline, update aplikasi */}
      <button
        onClick={() => setPengaturan(true)}
        aria-label="Pengaturan perangkat"
        className="absolute right-3 top-3 z-20 rounded-full bg-white/15 p-2 text-white/90 backdrop-blur transition hover:bg-white/25"
      >
        <Settings className="h-4 w-4" />
      </button>
      <div className="flex-1 overflow-y-auto thin-scroll px-5 py-6">
      <div className="flex flex-col items-center pt-6 text-center">
        <LogoMark size={64} />
        <h1 className="mt-2 text-xl font-extrabold">RumahLayak</h1>
        <p className="text-[11px] text-white/60">Kamishibai Emplasemen Perumahan — Sistem Produksi</p>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-4 text-slate-800 shadow-xl">
        <p className="text-[14px] font-bold text-forest">Masuk ke Akun Anda</p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
          <LockKeyhole className="h-3 w-3" /> Akun otomatis terikat kebun tempat Anda didaftarkan — tidak perlu memilih kebun.
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <Label className="text-[12px] text-slate-500">Nama Pengguna</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 h-10 text-[14px]" placeholder="username Anda" autoCapitalize="none" />
          </div>
          <div>
            <Label className="text-[12px] text-slate-500">Kata Sandi</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1 h-10 text-[14px]" onKeyDown={(e) => e.key === "Enter" && masuk()} />
          </div>
          <Button onClick={() => masuk()} disabled={kirim} className="h-11 w-full bg-forest text-[14px] font-bold hover:bg-forest-deep">
            {kirim ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Memverifikasi...</> : "Masuk"}
          </Button>
        </div>
        <p className="mt-3 rounded-lg bg-gold-soft p-2 text-[11px] leading-relaxed text-gold-deep">
          Akun didaftarkan oleh admin kebun (tanpa email) dengan binding unit. Lupa sandi? Hubungi admin kebun / IT corporate.
        </p>
      </div>
      <p className="mt-4 text-center text-[11px] text-white/50">Login terikat peran: AUDITOR / AUDITEE / ADMIN</p>
      </div>
      {pengaturan && <PengaturanPerangkat onTutup={() => setPengaturan(false)} />}
    </div>
  );
}

// ============ PENGATURAN PERANGKAT (gear layar login — pra-authentikasi) ============
type StatusAksi = "idle" | "jalan" | "ok" | "gagal";

export function PengaturanPerangkat({ onTutup }: { onTutup: () => void }) {
  const [ip, setIp] = useState(getServerUrl() ?? "");
  const [uji, setUji] = useState<StatusAksi>("idle");
  const [infoUji, setInfoUji] = useState("");
  const [unduh, setUnduh] = useState<StatusAksi>("idle");
  const [infoUnduh, setInfoUnduh] = useState("");
  const [cache, setCache] = useState<MasterCache | null>(null);
  const [update, setUpdate] = useState<StatusAksi | "tersedia">("idle");
  const [infoUpdate, setInfoUpdate] = useState("");
  const [versiServer, setVersiServer] = useState<{ versi: string; urlUnduh: string | null } | null>(null);
  const [antre, setAntre] = useState(0);
  const [sink, setSink] = useState<StatusAksi>("idle");
  const [infoSink, setInfoSink] = useState("");
  const [sinkronTerakhir, setSinkronTerakhir] = useState<HasilSinkron | null>(null);

  useEffect(() => {
    setCache(bacaMasterCache());
    setAntre(hitungAntrean());
    setSinkronTerakhir(bacaSinkronTerakhir());
  }, []);

  const simpanIp = async () => {
    const bersih = ip.trim();
    if (!bersih) {
      setServerUrl(null);
      setUji("idle");
      setInfoUji("Kembali ke server bawaan (tempat aplikasi ini dilayani).");
      return;
    }
    const url = normalisasiServerUrl(bersih);
    if (!url) {
      setUji("gagal");
      setInfoUji("Format tidak valid — contoh yang benar: 192.168.1.10:3000");
      return;
    }
    setServerUrl(url);
    setUji("jalan");
    try {
      const h = await api.get<{ status: string; database: string; waktu: string }>("/api/health");
      setUji("ok");
      setInfoUji(`Terhubung ${url} — ${h.database} • ${fmtTanggalWaktu(h.waktu)}`);
    } catch (e) {
      setUji("gagal");
      setInfoUji(`Gagal terhubung: ${(e as Error).message} — cek IP/port & jaringan`);
    }
  };

  const pakaiBawaan = () => {
    setServerUrl(null);
    setIp("");
    setUji("idle");
    setInfoUji("Memakai server bawaan — tempat aplikasi ini dilayani.");
  };

  const unduhMaster = async () => {
    setUnduh("jalan");
    setInfoUnduh("");
    try {
      const res = await fetch(apiUrl("/api/public/master"), { cache: "no-store" }); // endpoint publik, tanpa token
      const body = (await res.json()) as Record<string, unknown> & { baraks?: unknown[]; afdelings?: unknown[]; checklist?: unknown[] };
      if (!res.ok) throw new Error((body.error as string) ?? `Gagal (${res.status})`);
      const ukuran = simpanMasterCache(body as never, getServerUrl() ?? "(server bawaan)");
      setCache(bacaMasterCache());
      setUnduh("ok");
      setInfoUnduh(
        `Tersimpan: ${body.baraks?.length ?? 0} perumahan • ${body.afdelings?.length ?? 0} afdeling • ${body.checklist?.length ?? 0} item checklist • ${(ukuran / 1024).toFixed(1)} KB`,
      );
    } catch (e) {
      setUnduh("gagal");
      setInfoUnduh(`Gagal mengunduh: ${(e as Error).message}`);
    }
  };

  const hapusCache = () => {
    hapusMasterCache();
    setCache(null);
    setUnduh("idle");
    setInfoUnduh("Cache data master dihapus dari perangkat.");
  };

  const sinkronSekarang = async () => {
    setSink("jalan");
    setInfoSink("");
    if (hitungAntrean() === 0) {
      setSink("ok");
      setInfoSink(`Tidak ada data menunggu dikirim${sinkronTerakhir ? ` — sinkron terakhir ${fmtTanggalWaktu(sinkronTerakhir.waktu)}` : ""}.`);
      return;
    }
    try {
      const h = await sinkronAntrean();
      setAntre(h.sisa);
      setSinkronTerakhir(h);
      if (h.kirim > 0) {
        setSink("ok");
        setInfoSink(`${h.kirim} data terkirim ke server${h.gagal ? `, ${h.gagal} ditolak` : ""}${h.sisa ? `, ${h.sisa} masih mengantre` : ""}.`);
      } else if (h.sisa > 0) {
        setSink("gagal");
        setInfoSink(`Server tidak terjangkau — ${h.sisa} data tetap AMAN di perangkat, coba lagi saat online.`);
      } else {
        setSink("gagal");
        setInfoSink(h.catatan[0] ?? "Sinkron belum selesai — login ulang lalu coba lagi.");
      }
      if (h.catatan.length && h.kirim > 0) setInfoSink((prev) => `${prev} ${h.catatan.join(" · ")}`);
    } catch {
      setSink("gagal");
      setInfoSink("Sinkron gagal — periksa alamat IP (Set IP) dan koneksi, lalu coba lagi.");
    }
  };

  const cekUpdate = async () => {
    setUpdate("jalan");
    setInfoUpdate("");
    try {
      const v = await (await fetch(apiUrl("/api/app-version"), { cache: "no-store" })).json() as { versi: string; urlUnduh: string | null; catatan: string };
      setVersiServer({ versi: v.versi, urlUnduh: v.urlUnduh });
      if (bandingkanVersi(v.versi, VERSI_APLIKASI) > 0) {
        setUpdate("tersedia");
        setInfoUpdate(`v${v.versi} tersedia — ${v.catatan}`);
      } else {
        setUpdate("ok");
        setInfoUpdate(`Server: v${v.versi} — aplikasi sudah versi terbaru.`);
      }
    } catch (e) {
      setUpdate("gagal");
      setInfoUpdate(`Gagal memeriksa: ${(e as Error).message}`);
    }
  };

  const unduhUpdate = () => {
    if (versiServer?.urlUnduh) {
      window.open(versiServer.urlUnduh, "_blank");
      toast.info("Unduhan dimulai — instal setelah selesai, lalu buka ulang aplikasi.");
    } else {
      toast.info("Tautan APK belum diatur server — hubungi IT / muat ulang aplikasi PWA.");
    }
  };

  const garisStatus = (info: string, status: StatusAksi | "tersedia") =>
    info ? (
      <p className={cn(
        "mt-2 rounded-lg px-2 py-1.5 text-[11.5px] leading-relaxed",
        status === "ok" && "bg-green-50 text-green-700",
        status === "gagal" && "bg-red-50 text-red-600",
        status === "jalan" && "bg-slate-50 text-slate-500",
        (status === "idle" || status === "tersedia") && "bg-amber-50 text-amber-800",
      )}>{info}</p>
    ) : null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-slate-100 text-slate-800">
      <header className="flex shrink-0 items-center gap-2 bg-gradient-to-r from-forest to-forest-deep px-4 py-3 text-white">
        <button onClick={onTutup} aria-label="Tutup pengaturan" className="rounded-full bg-white/15 p-1.5 text-white hover:bg-white/25">
          <X className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold leading-tight">Pengaturan Perangkat</h2>
          <p className="text-[12px] text-white/70">Server, data offline & pembaruan — tersedia sebelum login</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto thin-scroll p-3">
        {/* ---------- SET IP ---------- */}
        <section className="rounded-xl border bg-white p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500"><Server className="h-3.5 w-3.5 text-forest" /> ALAMAT SERVER (SET IP)</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Alamat API yang dipakai perangkat lapangan. Kosong = server bawaan tempat aplikasi dilayani.
          </p>
          <div className="mt-2 flex gap-2">
            <Input
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="contoh: 192.168.1.10:3000"
              className="h-9 flex-1 font-mono text-[13px]"
              aria-label="Alamat server"
            />
            <Button onClick={simpanIp} disabled={uji === "jalan"} className="h-9 shrink-0 bg-forest px-3 text-[12.5px] font-bold hover:bg-forest-deep">
              {uji === "jalan" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Wifi className="mr-1 h-3.5 w-3.5" />} Simpan & Uji
            </Button>
          </div>
          {garisStatus(infoUji, uji)}
          <button onClick={pakaiBawaan} className="mt-1.5 w-full rounded-lg py-1.5 text-[12px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-forest">
            Pakai Server Bawaan
          </button>
        </section>

        {/* ---------- DATA OFFLINE & SINKRONISASI (digabung: cache master + antrean kiriman) ---------- */}
        <section className="rounded-xl border bg-white p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500"><HardDriveDownload className="h-3.5 w-3.5 text-forest" /> DATA OFFLINE &amp; SINKRONISASI</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">
            {cache
              ? <>Cache master: <b>{cache.data.baraks.length} perumahan</b> • {cache.data.afdelings.length} afdeling • {cache.data.checklist.length} item — diunduh {fmtTanggalWaktu(cache.diunduh)}.</>
              : "Cache master belum ada — unduh agar peta & checklist tetap tampil saat sinyal lemah."}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">
            {antre > 0
              ? <b className="text-amber-700">{antre} data menunggu dikirim saat online.</b>
              : "Semua data sudah tersinkron dengan server."}
            {sinkronTerakhir ? ` Sinkron terakhir: ${fmtTanggalWaktu(sinkronTerakhir.waktu)}.` : ""}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button onClick={unduhMaster} disabled={unduh === "jalan"} className="h-9 bg-forest text-[12.5px] font-bold hover:bg-forest-deep">
              {unduh === "jalan" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />} Unduh Master
            </Button>
            <Button onClick={sinkronSekarang} disabled={sink === "jalan"} className="h-9 bg-forest text-[12.5px] font-bold hover:bg-forest-deep">
              {sink === "jalan" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />} Sinkron
            </Button>
          </div>
          {cache && (
            <button onClick={hapusCache} className="mt-1 w-full rounded-lg py-1.5 text-[12px] font-semibold text-red-600 hover:bg-red-50">
              Hapus Cache Master
            </button>
          )}
          {garisStatus(infoUnduh, unduh)}
          {garisStatus(infoSink, sink)}
          <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
            Cache master dipakai otomatis bila server tidak terjangkau (tidak memuat data pengguna). Pemeriksaan, temuan, tindak lanjut &amp; verifikasi yang dibuat saat offline masuk antrean perangkat dan terkirim otomatis saat online (setelah login / buka aplikasi).
          </p>
        </section>

        {/* ---------- UPDATE APLIKASI ---------- */}
        <section className="rounded-xl border bg-white p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500"><RefreshCw className="h-3.5 w-3.5 text-forest" /> APLIKASI</p>
          <p className="mt-1 text-[11.5px] text-slate-600">Versi terpasang: <b>v{VERSI_APLIKASI}</b></p>
          <Button onClick={cekUpdate} disabled={update === "jalan"} variant="outline" className="mt-2 h-9 w-full text-[12.5px] text-forest">
            {update === "jalan" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />} Periksa Update
          </Button>
          {garisStatus(infoUpdate, update)}
          {update === "tersedia" && (
            <Button onClick={unduhUpdate} className="mt-2 h-9 w-full bg-gold text-[12.5px] font-bold text-forest-deep hover:bg-gold-soft">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Unduh Update (v{versiServer?.versi})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => window.open("https://github.com/afiashidqia89-ops/MyHome/releases/latest", "_blank")}
            className="mt-1.5 h-9 w-full text-[12.5px] text-forest"
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Buka Halaman Rilis APK (GitHub)
          </Button>
        </section>
      </div>
    </div>
  );
}

// ============ PROFIL ============
export function ProfileScreen() {
  const { session, master, setMobileScreen } = useStore();
  const refresh = useRefresh();
  const qc = useQueryClient();
  const [cekKoneksi, setCekKoneksi] = useState<"idle" | "cek" | "ok" | "gagal">("idle");
  const [serverInfo, setServerInfo] = useState<string>("");
  const [antre, setAntre] = useState(0);
  const [sinkronJalan, setSinkronJalan] = useState(false);
  const [mUnduh, setMUnduh] = useState(false);
  useEffect(() => setAntre(hitungAntrean()), []);
  if (!session) return null;

  // ---------- DATA & EKSPOR (dipindah dari tab "Data" yang lama — menu diringkas) ----------
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

  const sinkron = async () => {
    setSinkronJalan(true);
    try {
      const h = await sinkronAntrean();
      setAntre(h.sisa);
      if (h.kirim > 0) {
        toast.success(`${h.kirim} data offline terkirim ke server`);
        refresh();
      } else if (h.sisa > 0) {
        toast.warning(`Server tidak terjangkau — ${h.sisa} data tetap aman di perangkat.`);
      } else {
        toast.info("Tidak ada data yang menunggu dikirim.");
      }
    } catch {
      toast.error("Sinkron gagal — cek koneksi / Set IP lalu coba lagi.");
    } finally {
      setSinkronJalan(false);
    }
  };

  const ujiServer = async () => {
    setCekKoneksi("cek");
    try {
      const h = await api.get<{ status: string; database: string; waktu: string }>("/api/health");
      setServerInfo(`${h.database} • ${h.status.toUpperCase()} • ${fmtTanggalWaktu(h.waktu)}`);
      setCekKoneksi("ok");
    } catch {
      setCekKoneksi("gagal");
    }
  };

  const keluar = async () => {
    try { await api.post("/api/auth/logout"); } catch { /* abaikan */ }
    clearToken();
    setMobileScreen("login");
    window.location.reload();
  };

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Data" />
      <div className="flex-1 overflow-y-auto thin-scroll p-3">
        <div className="rounded-xl border bg-white p-3">
          <p className="text-[12px] font-bold text-slate-500">SERVER & SINKRONISASI</p>
          <div className="mt-2 space-y-1.5 text-[12px] text-slate-600">
            <p className="flex items-center gap-1.5"><Server className="h-3.5 w-3.5 text-forest" /> API: <span className="truncate">/api (server ini • PostgreSQL Neon-ready)</span></p>
            <p className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-forest" /> Status: {cekKoneksi === "ok" ? serverInfo : cekKoneksi === "cek" ? "menguji..." : cekKoneksi === "gagal" ? "tidak terhubung" : "sudah terhubung sejak login"}</p>
          </div>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" onClick={ujiServer} className="h-9 flex-1 text-[12.5px] text-forest">
              {cekKoneksi === "cek" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />} Uji Koneksi
            </Button>
            <Button variant="outline" onClick={refresh} className="h-9 flex-1 text-[12.5px] text-forest"><Database className="mr-1 h-3.5 w-3.5" /> Refresh Data</Button>
          </div>
          <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11.5px] text-slate-600">
            <p><b>{antre}</b> data menunggu dikirim saat online{antre > 0 ? " — pemeriksaan/temuan buatan offline aman di perangkat" : ""}.</p>
          </div>
          <Button onClick={sinkron} disabled={sinkronJalan} className="mt-2 h-9 w-full bg-forest text-[12.5px] font-bold hover:bg-forest-deep">
            {sinkronJalan ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />} Sinkron Sekarang
          </Button>
        </div>

        <div className="mt-3 rounded-xl border bg-white p-3">
          <p className="text-[12px] font-bold text-slate-500">DATA &amp; EKSPOR</p>
          <p className="mt-1 text-[11.5px] text-slate-500">Ekspor dibangun di server dari database — konsisten dengan papan web.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button onClick={eksporXlsx} variant="outline" className="h-10 border-forest text-[12.5px] font-semibold text-forest hover:bg-forest-soft">
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Export XLSX
            </Button>
            <Button onClick={eksporJson} variant="outline" className="h-10 border-forest text-[12.5px] font-semibold text-forest hover:bg-forest-soft">
              <FileJson className="mr-1 h-4 w-4" /> Export JSON
            </Button>
          </div>
          <Button onClick={unduhMaster} disabled={mUnduh} className="mt-2 h-10 w-full bg-gold text-[13px] font-bold text-forest-deep hover:bg-gold-deep hover:text-white">
            {mUnduh ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Mengunduh...</> : <><Download className="mr-1.5 h-4 w-4" /> Unduh Master Data Terbaru</>}
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-slate-600">
            <span className="rounded bg-slate-50 px-2 py-1">Checklist: {master?.kartu.length ?? 4} kartu / {master?.checklist.length ?? 27} item</span>
            <span className="rounded bg-slate-50 px-2 py-1">Perumahan: {master?.baraks.length ?? 0} lokasi</span>
            <span className="rounded bg-slate-50 px-2 py-1">Afdeling: {master?.afdelings.length ?? 0}</span>
            <span className="rounded bg-slate-50 px-2 py-1">Kebun: {master?.kebuns.length ?? 0} • Estate: {master?.estates.length ?? 0}</span>
          </div>
        </div>

        <div className="mt-3 rounded-xl border bg-white p-3">
          <p className="text-[12px] font-bold text-slate-500">AKSI</p>
          <Button variant="outline" onClick={keluar} className="mt-2 h-9 w-full justify-start text-[13px]"><LogOut className="mr-2 h-4 w-4" /> Keluar (akhiri sesi)</Button>
        </div>
      </div>
    </div>
  );
}
