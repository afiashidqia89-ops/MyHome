"use client";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { qk, useMaster, useSession } from "@/lib/queries";
import { api, setToken } from "@/lib/api";
import { BottomNav, layarAwal } from "@/components/mobile/frame";
import { LoginScreen, ProfileScreen, LogoMark } from "@/components/mobile/screens-core";
import { InspectNewScreen, InspectScreen, InspectItemScreen } from "@/components/mobile/screens-inspect";
import { FindingsScreen, FindingDetailScreen, HistoryScreen } from "@/components/mobile/screens-findings";
import { DataScreen, GuidelineScreen } from "@/components/mobile/screens-data";
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

function MobileApp() {
  const { session, master, mobileScreen } = useStore();
  if (!session || !master) return null;
  let screen: React.ReactNode;
  switch (mobileScreen) {
    case "login": screen = <LoginScreen />; break;
    case "peta": screen = <PetaBlokScreen />; break;
    case "inspect-new": screen = <InspectNewScreen />; break;
    case "inspect": screen = <InspectScreen />; break;
    case "inspect-item": screen = <InspectItemScreen />; break;
    case "findings": screen = <FindingsScreen />; break;
    case "finding-detail": screen = <FindingDetailScreen />; break;
    case "history": screen = <HistoryScreen />; break;
    case "data": screen = <DataScreen />; break;
    case "guideline": screen = <GuidelineScreen />; break;
    case "profile": screen = <ProfileScreen />; break;
    default: screen = layarAwal(session.role) === "peta" ? <PetaBlokScreen /> : <FindingsScreen />;
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

/** Login untuk mode Web (kartu di tengah halaman). */
function WebLogin() {
  const qc = useQueryClientSafe();
  const setSession = useStore((s) => s.setSession);
  const [username, setUsername] = useState("hendra");
  const [pw, setPw] = useState("demo123");
  const [kirim, setKirim] = useState(false);

  const masuk = async () => {
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

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <LogoMark size={40} />
          <div>
            <p className="text-[14px] font-extrabold text-slate-800">RumahLayak Portal Web</p>
            <p className="text-[10px] text-slate-500">Kamishibai Digital — login tanpa memilih kebun</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-[11px] text-slate-500">Nama Pengguna</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 h-10 text-[13px]" placeholder="cth: hendra" autoCapitalize="none" />
          </div>
          <div>
            <Label className="text-[11px] text-slate-500">Kata Sandi</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1 h-10 text-[13px]" onKeyDown={(e) => e.key === "Enter" && masuk()} />
          </div>
          <Button onClick={masuk} disabled={kirim} className="h-10 w-full bg-forest text-[13px] font-bold hover:bg-forest-deep">
            {kirim ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Memverifikasi...</> : "Masuk Portal"}
          </Button>
          <p className="rounded-lg bg-gold-soft p-2.5 text-[10.5px] leading-relaxed text-gold-deep">
            Demo: hendra (ADMIN) atau budi (AUDITOR, terikat Kebun Mandor) — sandi <b>demo123</b>. User didaftarkan admin tanpa email; username dibuat otomatis dari nama. Akses disesuaikan peran & binding kebun Anda.
          </p>
        </div>
      </div>
    </div>
  );
}

function useQueryClientSafe() {
  return queryClient;
}

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

  // Deteksi lingkungan sekali saat mulai:
  //   - APK (dijalankan di WebView Capacitor) → tampilan MOBILE penuh layar
  //   - Browser ponsel (layar sempit) → tampilan MOBILE penuh layar
  //   - Browser desktop → PORTAL WEB penuh
  // Tidak ada mode "gabungan": web ya web, APK ya APK.
  useEffect(() => {
    const diApk = typeof window !== "undefined" && "Capacitor" in window;
    const layarSempit = typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 767px)").matches;
    useStore.getState().setMode(diApk || layarSempit ? "mobile" : "web");
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
