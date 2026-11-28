"use client";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { qk, useMaster, useSession } from "@/lib/queries";
import { api, setToken } from "@/lib/api";
import { BottomNav, layarAwal } from "@/components/mobile/frame";
import { LoginScreen, ProfileScreen, LogoMark } from "@/components/mobile/screens-core";
import { InspectNewScreen, InspectScreen, InspectItemScreen } from "@/components/mobile/screens-inspect";
import { FindingsScreen, FindingDetailScreen } from "@/components/mobile/screens-findings";
import { GuidelineScreen } from "@/components/mobile/screens-data";
import { BerandaScreen } from "@/components/mobile/screens-beranda";
import { PetaBlokScreen } from "@/components/mobile/screens-peta";
import { WebLayout, menuWebPerPeran } from "@/components/web/layout";
import { WebDashboard } from "@/components/web/dashboard";
import { WebRekap } from "@/components/web/rekap";
import { WebDetailPemeriksaan } from "@/components/web/detail-inspeksi";
import { WebPeta } from "@/components/web/peta";
import { WebMaster } from "@/components/web/master";
import { WebUsers } from "@/components/web/users";
import { WebPengaturan } from "@/components/web/pengaturan";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import type { SessionUser } from "@/lib/types";
import type { MobileScreen } from "@/lib/types";
import { autoSinkron, hitungAntrean } from "@/lib/offline";
import { diApk } from "@/lib/perangkat";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

function MobileApp() {
  const { session, master, mobileScreen } = useStore();
  if (!session || !master) return null;
  let screen: React.ReactNode;
  switch (mobileScreen) {
    case "login": screen = <LoginScreen />; break;
    // BERANDA — layar pertama setelah login (banner pemeriksaan + status sinkron)
    case "beranda": screen = <BerandaScreen />; break;
    case "peta": screen = <PetaBlokScreen />; break;
    case "inspect-new": screen = <InspectNewScreen />; break;
    case "inspect": screen = <InspectScreen />; break;
    case "inspect-item": screen = <InspectItemScreen />; break;
    case "findings": screen = <FindingsScreen />; break;
    case "finding-detail": screen = <FindingDetailScreen />; break;
    // Riwayat = segmen di dalam layar Temuan; Data = bagian di layar Profil
    // (konsolidasi menu — layar lama tetap bisa dibuka lewat rute ini).
    case "history": screen = <FindingsScreen tabAwal="riwayat" />; break;
    case "data": screen = <ProfileScreen />; break;
    case "guideline": screen = <GuidelineScreen />; break;
    case "profile": screen = <ProfileScreen />; break;
    default: screen = <BerandaScreen />; // layarAwal() selalu Beranda — fallback aman
  }
  return (
    <>
      <div className="min-h-0 flex-1">{screen}</div>
      {mobileScreen !== "login" ? <BottomNav /> : null}
    </>
  );
}

function WebApp() {
  const { webPage, session } = useStore();
  // Guard peran: halaman di luar menu peran (mis. auditee membuka peta) jatuh kembali ke dashboard
  const halaman = menuWebPerPeran(session?.role).some((m) => m.id === webPage) ? webPage : "dashboard";
  return (
    <WebLayout>
      {halaman === "dashboard" && <WebDashboard />}
      {halaman === "detail" && <WebDetailPemeriksaan />}
      {halaman === "rekap" && <WebRekap />}
      {halaman === "peta" && <WebPeta />}
      {halaman === "master" && <WebMaster />}
      {halaman === "users" && <WebUsers />}
      {halaman === "pengaturan" && <WebPengaturan />}
    </WebLayout>
  );
}

/** Login untuk mode Web — SAMPUL dua panel (kiri: brand/fitur, kanan: form).
 *  Tanpa teks/akun demo (tampilan produksi). */
function WebLogin() {
  const qc = useQueryClientSafe();
  const setSession = useStore((s) => s.setSession);
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [kirim, setKirim] = useState(false);

  const masuk = async () => {
    if (!username.trim() || !pw) {
      toast.error("Isi nama pengguna dan kata sandi");
      return;
    }
    setKirim(true);
    try {
      const res = await api.post<{ user: SessionUser; token: string }>("/api/auth/login", { username, password: pw });
      setToken(res.token); // sesi Bearer — tetap hidup di iframe preview & WebView Capacitor
      qc.setQueryData(qk.session, { authenticated: true as const, user: res.user });
      qc.invalidateQueries({ queryKey: qk.master });
      toast.success(`Selamat datang, ${res.user.nama}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setKirim(false);
    }
  };

  const fitur = [
    { judul: "Papan Kamishibai Digital", isi: "Status layak/tidak layak 27 item per perumahan, langsung dari lapangan" },
    { judul: "GPS & Foto Tergeotag", isi: "Koordinat ditag 1x di depan rumah + foto kamera bawaan ber-watermark" },
    { judul: "Temuan & Jalur Approval", isi: "Level 1–4: Swakelola kebun hingga GS Project / Corporate (Capex)" },
    { judul: "Offline-First", isi: "Pemeriksaan disimpan aman di perangkat, dikirim lewat Sinkron Sekarang" },
  ];

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4 md:p-8">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border bg-white shadow-xl lg:grid-cols-[1.1fr_1fr]">
        {/* ---- PANEL BRAND (desktop) ---- */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-forest via-forest-deep to-[#0b2416] p-8 text-white lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <LogoMark size={52} />
              <div>
                <p className="text-[20px] font-extrabold leading-tight">RumahLayak</p>
                <p className="text-[11px] text-gold">Portal Web — Kamishibai Emplasemen</p>
              </div>
            </div>
            <p className="mt-6 text-[12.5px] leading-relaxed text-white/80">
              Sistem pemeriksaan kelayakan perumahan &amp; fasilitas karyawan. Satu sumber data untuk papan audit, tindak lanjut perbaikan, dan pelaporan corporate.
            </p>
            <div className="mt-6 space-y-3">
              {fitur.map((f) => (
                <div key={f.judul} className="rounded-xl bg-white/10 px-3.5 py-2.5 ring-1 ring-white/15">
                  <p className="text-[12px] font-bold text-gold">{f.judul}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-white/75">{f.isi}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-6 text-[9.5px] text-white/50">Sesi JWT ter-enkripsi 7 hari • bcrypt password • audit trail penuh • PostgreSQL Neon</p>
        </div>

        {/* ---- PANEL FORM ---- */}
        <div className="flex flex-col justify-center p-6 md:p-10">
          {/* Ringkasan brand untuk layar sempit */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <LogoMark size={44} />
            <div>
              <p className="text-[16px] font-extrabold text-slate-800">RumahLayak</p>
              <p className="text-[10.5px] text-slate-500">Portal Web — Kamishibai Emplasemen</p>
            </div>
          </div>

          <h1 className="text-[17px] font-extrabold text-slate-800">Masuk ke Portal</h1>
          <p className="mt-1 text-[11.5px] text-slate-500">Gunakan akun yang didaftarkan admin — tanpa pendaftaran mandiri, tanpa email.</p>

          <div className="mt-5 space-y-3">
            <div>
              <Label className="text-[11px] font-semibold text-slate-500">Nama Pengguna</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 h-11 text-[13px]" placeholder="username Anda" autoCapitalize="none" autoFocus />
            </div>
            <div>
              <Label className="text-[11px] font-semibold text-slate-500">Kata Sandi</Label>
              <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1 h-11 text-[13px]" placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && masuk()} />
            </div>
            <Button onClick={masuk} disabled={kirim} className="h-11 w-full bg-forest text-[13px] font-bold hover:bg-forest-deep">
              {kirim ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Memverifikasi...</> : "Masuk Portal"}
            </Button>
          </div>

          <p className="mt-5 rounded-xl bg-slate-50 p-3 text-[10.5px] leading-relaxed text-slate-500">
            Akses otomatis mengikuti <b>peran</b> (AUDITOR / AUDITEE / ADMIN) dan <b>binding unit</b> yang ditetapkan admin saat pendaftaran. Lupa sandi? Hubungi admin kebun / IT corporate.
          </p>
        </div>
      </div>
    </div>
  );
}

function useQueryClientSafe() {
  return queryClient;
}

// Hindari auto-sinkron berulang tiap render: sekali per 30 detik maksimal
let WAKTU_AUTO_SINKRON = 0;

// ---- Tombol BACK Android (Capacitor App) ----
// TIDAK langsung keluar: back memundurkan layar bertahap, di luar alur
// inspeksi langsung ke BERANDA peran (auditor: Peta, auditee/admin: Temuan).
// Sudah di beranda → tekan 2x (toast penanda) baru keluar.
let WAKTU_BACK_TERAKHIR = 0;

const TURUN_SATU: Partial<Record<MobileScreen, MobileScreen>> = {
  "inspect-item": "inspect",
  "inspect": "inspect-new",
  "finding-detail": "findings",
};

function AppRoot() {
  const { mode, session, setSession, setMobileScreen, master } = useStore();
  const { data: sess, isLoading: sessLoading } = useSession();
  const { data: masterData, isLoading: masterLoading } = useMaster(!!sess?.authenticated);

  // Sinkronkan hasil query ke store UI
  useEffect(() => {
    setSession(sess?.authenticated ? sess.user : null);
    if (!sess?.authenticated) setMobileScreen("login");
    else if (useStore.getState().mobileScreen === "login") setMobileScreen(layarAwal(sess.user.role));
  }, [sess, setSession, setMobileScreen]);
  useEffect(() => {
    useStore.getState().setMaster(masterData ?? null);
  }, [masterData]);

  // Saat aplikasi dibuka dalam keadaan login: kirim antrean offline lalu
  // segarkan data (diam-diam; hanya bila ada data yang menunggu)
  useEffect(() => {
    if (!sess?.authenticated) return;
    const sekarang = Date.now();
    if (sekarang - WAKTU_AUTO_SINKRON < 30_000) return;
    WAKTU_AUTO_SINKRON = sekarang;
    if (!hitungAntrean()) return;
    void autoSinkron(queryClient).then((hasil) => {
      if (hasil && hasil.kirim === 0 && hasil.catatan.length > 0) {
        toast.warning(hasil.catatan[0], { duration: 8000 });
      }
      if (hasil && hasil.kirim > 0) {
        toast.success(`${hasil.kirim} data offline berhasil dikirim ke server`);
        void queryClient.invalidateQueries({ queryKey: qk.inspeksi });
        void queryClient.invalidateQueries({ queryKey: qk.temuan });
        void queryClient.invalidateQueries({ queryKey: qk.aktivitas });
      }
    }).catch(() => { /* senyap — antrean tetap aman di perangkat */ });
  }, [sess?.authenticated]);

  // Koneksi internet kembali → kirim antrean otomatis (tanpa menunggu buka ulang aplikasi)
  useEffect(() => {
    if (!sess?.authenticated) return;
    const saatOnline = () => {
      if (!hitungAntrean()) return;
      void autoSinkron(queryClient).then((hasil) => {
        if (hasil && hasil.kirim > 0) {
          toast.success(`${hasil.kirim} data offline berhasil dikirim ke server`);
          void queryClient.invalidateQueries({ queryKey: qk.inspeksi });
          void queryClient.invalidateQueries({ queryKey: qk.temuan });
        }
      }).catch(() => { /* senyap */ });
    };
    window.addEventListener("online", saatOnline);
    return () => window.removeEventListener("online", saatOnline);
  }, [sess?.authenticated]);

  // Deteksi lingkungan (dihitung ulang saat orientasi/ukuran jendela berubah):
  //   - APK (dijalankan di WebView Capacitor) → tampilan MOBILE penuh layar
  //   - Browser ponsel (layar sempit) → tampilan MOBILE penuh layar
  //   - Browser desktop → PORTAL WEB penuh
  // Tidak ada mode "gabungan": web ya web, APK ya APK.
  // PENTING: pakai Capacitor.isNativePlatform() (via diApk()), BUKAN
  // "Capacitor" in window — @capacitor/core juga mendefinisikan
  // window.Capacitor di browser, sehingga cek itu selalu true dan
  // browser desktop ikut mendapat tampilan mobile (bug v0.3).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const terapkan = () => useStore.getState().setMode(diApk() || mq.matches ? "mobile" : "web");
    terapkan();
    mq.addEventListener?.("change", terapkan);
    return () => mq.removeEventListener?.("change", terapkan);
  }, []);

  // Tombol BACK perangkat (APK): mundur bertahap / ke beranda, bukan keluar.
  // Hanya aktif di dalam APK — di browser perilaku back default dibiarkan.
  useEffect(() => {
    if (!diApk()) return;
    let hancur = false;
    let sub: { remove: () => Promise<void> } | null = null;
    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("backButton", () => {
          const s = useStore.getState();
          const beranda = layarAwal(s.session?.role);
          const skr = s.mobileScreen;
          if (skr === "login" || skr === beranda) {
            // Sudah di beranda → 2x tekan dalam 2,2 detik untuk keluar
            const kini = Date.now();
            if (kini - WAKTU_BACK_TERAKHIR < 2200) {
              void App.exitApp();
            } else {
              WAKTU_BACK_TERAKHIR = kini;
              toast.info("Tekan tombol back sekali lagi untuk keluar aplikasi");
            }
            return;
          }
          // Mundur satu langkah di alur inspeksi/temuan; di luar itu → beranda.
          s.setMobileScreen(TURUN_SATU[skr] ?? beranda);
        });
        if (hancur) void listener.remove();
        else sub = listener;
      } catch {
        /* plugin tidak tersedia — abaikan */
      }
    })();
    return () => {
      hancur = true;
      void sub?.remove?.();
    };
  }, []);

  if (sessLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-forest-deep">
        <div className="animate-pulse text-center text-white">
          <LogoMark size={64} />
          <p className="mt-3 text-[13px] font-bold">RumahLayak — menghubungkan ke server...</p>
        </div>
      </div>
    );
  }

  const authenticated = !!session;
  const siap = authenticated && !!master;

  // ===== APK / ponsel: aplikasi MOBILE penuh layar — tanpa bingkai, tanpa panel samping =====
  if (mode === "mobile") {
    return (
      <div className="flex h-[100dvh] flex-col bg-slate-100">
        {!authenticated ? <LoginScreen /> : !siap ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-forest" /></div>
        ) : (
          <MobileApp />
        )}
      </div>
    );
  }

  // ===== Browser desktop: PORTAL WEB penuh — tanpa mockup HP =====
  if (!authenticated) return <WebLogin />;
  if (!siap) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100">
        {masterLoading ? <Loader2 className="h-6 w-6 animate-spin text-forest" /> : <p className="text-[12px] text-slate-500">Master data belum tersedia.</p>}
      </div>
    );
  }
  return <WebApp />;
}

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoot />
    </QueryClientProvider>
  );
}
