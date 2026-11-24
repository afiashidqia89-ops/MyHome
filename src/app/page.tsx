"use client";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { qk, useMaster, useSession } from "@/lib/queries";
import { api, setToken } from "@/lib/api";
import { ringkasBinding } from "@/lib/utils-rl";
import { PhoneFrame, BottomNav, layarAwal } from "@/components/mobile/frame";
import { LoginScreen, ProfileScreen, LogoMark } from "@/components/mobile/screens-core";
import { InspectNewScreen, InspectScreen, InspectItemScreen } from "@/components/mobile/screens-inspect";
import { FindingsScreen, FindingDetailScreen, HistoryScreen } from "@/components/mobile/screens-findings";
import { DataScreen, GuidelineScreen } from "@/components/mobile/screens-data";
import { PetaBlokScreen } from "@/components/mobile/screens-peta";
import { WebLayout, menuWebPerPeran } from "@/components/web/layout";
import { WebDashboard } from "@/components/web/dashboard";
import { WebRekap } from "@/components/web/rekap";
import { WebPeta } from "@/components/web/peta";
import { WebMaster } from "@/components/web/master";
import { WebUsers } from "@/components/web/users";
import { WebDocs } from "@/components/web/docs";
import { toast } from "sonner";
import { Github, Database, Triangle, Smartphone, Monitor, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
      {halaman === "rekap" && <WebRekap />}
      {halaman === "peta" && <WebPeta />}
      {halaman === "master" && <WebMaster />}
      {halaman === "users" && <WebUsers />}
      {halaman === "docs" && <WebDocs />}
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

  if (sessLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-200">
        <div className="animate-pulse text-center text-white">
          <LogoMark size={64} />
          <p className="mt-3 text-[13px] font-bold">RumahLayak — menghubungkan ke server...</p>
        </div>
      </div>
    );
  }

  const authenticated = !!session;
  const siap = authenticated && !!master;

  return (
    <div className="flex min-h-screen flex-col bg-slate-200">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-slate-300 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <LogoMark size={30} />
          <div>
            <p className="text-[13px] font-extrabold leading-tight text-slate-800">RumahLayak</p>
            <p className="text-[9px] leading-tight text-slate-500">Sistem Produksi v1.0 — Pemeriksaan Kelayakan Perumahan & Fasilitas Karyawan</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {session && (
            <span className="hidden rounded-full bg-forest-soft px-2.5 py-1 text-[10px] font-bold text-forest sm:inline">
              {session.nama} • {session.role}{session.bindings?.length ? ` • ${ringkasBinding(session.bindings)}` : ""}
            </span>
          )}
          <div className="flex rounded-full border border-slate-200 bg-slate-100 p-0.5">
            <button
              onClick={() => useStore.getState().setMode("mobile")}
              className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition", mode === "mobile" ? "bg-forest text-white shadow" : "text-slate-500 hover:text-slate-700")}
            >
              <Smartphone className="h-3.5 w-3.5" /> APK Mobile
            </button>
            <button
              onClick={() => useStore.getState().setMode("web")}
              className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition", mode === "web" ? "bg-forest text-white shadow" : "text-slate-500 hover:text-slate-700")}
            >
              <Monitor className="h-3.5 w-3.5" /> Web Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Info stack */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-forest-deep px-4 py-1.5 text-[10px] text-white/70">
        <span className="flex items-center gap-1"><Github className="h-3 w-3" /> GitHub — version control & CI</span>
        <span className="flex items-center gap-1"><Triangle className="h-3 w-3" /> Vercel — hosting web + API</span>
        <span className="flex items-center gap-1"><Database className="h-3 w-3" /> PostgreSQL Neon-ready — data nyata</span>
        <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> Capacitor — build APK</span>
      </div>

      {mode === "mobile" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-8 xl:flex-row xl:items-start xl:gap-12">
          <aside className="hidden w-72 shrink-0 xl:block">
            <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
              <p className="text-[12px] font-bold text-forest">Perbedaan dari Prototipe</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[11px] leading-relaxed text-slate-600">
                <li><b>Login tanpa pilih kebun</b> — akun terikat kebun tempat didaftarkan (server menegakkan)</li>
                <li>Autentikasi bcrypt + JWT httpOnly, rate-limit login</li>
                <li>Database PostgreSQL (Prisma) — bukan localStorage; transaksi atomik</li>
                <li>REST API dengan RBAC: auditor/auditee/admin, scope per kebun</li>
                <li>Ekspor XLSX/JSON dibangun di server; audit trail AksiLog</li>
                <li>Siap deploy: GitHub + Vercel + Neon + Capacitor</li>
              </ul>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
              <p className="text-[12px] font-bold text-forest">Coba Alur Ini</p>
              <ol className="mt-2 space-y-1.5">
                {[
                  "Login budi / demo123 (AUDITOR — Kebun Mandor)",
                  "Mulai Pemeriksaan → pilih perumahan → nilai item → MERAH wajib temuan + level",
                  "Simpan → data tersimpan di server, langsung muncul di Portal Web",
                  "Login fauzi (AUDITEE) → kirim bukti perbaikan",
                  "Auditor verifikasi & tutup → kartu kembali HIJAU",
                ].map((p, i) => (
                  <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-slate-600">
                    <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-forest-soft px-1.5 text-[9px] font-bold text-forest">{i + 1}</span>
                    {p}
                  </li>
                ))}
              </ol>
            </div>
          </aside>
          <PhoneFrame>
            {!authenticated ? <LoginScreen /> : !siap ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-forest" /></div>
            ) : (
              <MobileApp />
            )}
          </PhoneFrame>
        </div>
      ) : !authenticated ? (
        <WebLogin />
      ) : !siap ? (
        <div className="flex flex-1 items-center justify-center p-10">
          {masterLoading ? <Loader2 className="h-6 w-6 animate-spin text-forest" /> : <p className="text-[12px] text-slate-500">Master data belum tersedia.</p>}
        </div>
      ) : (
        <div className="flex-1">
          <WebApp />
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoot />
    </QueryClientProvider>
  );
}
