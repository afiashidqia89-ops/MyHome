"use client";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ClipboardCheck, Database, Flag, Home, MapPinned, Wrench } from "lucide-react";
import type { MobileScreen, Role } from "@/lib/types";

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[400px] max-w-full">
      <div className="relative rounded-[3rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl">
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-20 h-6 w-44 -translate-x-1/2 rounded-b-2xl bg-slate-900" />
        <div className="relative h-[820px] max-h-[80vh] overflow-hidden rounded-[2.4rem] bg-slate-100">
          {/* Status bar */}
          <div className="relative z-10 flex items-center justify-between bg-forest-deep px-6 pb-1 pt-2 text-[12px] font-medium text-white/90">
            <span>09:41</span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-gold" />
              GPS AKTIF
            </span>
            <span className="flex items-center gap-1">
              <span className="tracking-tighter">▮▮▮</span> 87%
            </span>
          </div>
          <div className="flex h-[calc(100%-26px)] flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ---------- Menu bawah per peran (DIRINGKAS — fitur digabung secara proper) ----------
// Gabungan:
//   • Temuan + Riwayat → satu tab "Temuan" (segmen TEMUAN / RIWAYAT di dalamnya)
//   • Data (master, ekspor XLSX/JSON) → bagian "DATA & EKSPOR" di layar Profil
//   • QR demo dihapus (bukan fitur nyata) — perumahan dipilih langsung dari daftar
// BERANDA jadi tab pertama semua peran: setelah login langsung masuk Beranda
// (banner pemeriksaan pindah ke sini dari menu Profil).
const NAV_AUDITOR: { id: MobileScreen; label: string; icon: React.ReactNode }[] = [
  { id: "beranda", label: "Beranda", icon: <Home className="h-4 w-4" /> },
  { id: "inspect-new", label: "Periksa", icon: <ClipboardCheck className="h-4 w-4" /> },
  { id: "peta", label: "Peta Rumah", icon: <MapPinned className="h-4 w-4" /> },
  { id: "findings", label: "Temuan", icon: <Flag className="h-4 w-4" /> },
  { id: "profile", label: "Data", icon: <Database className="h-4 w-4" /> },
];

// AUDITEE: fokus tindak lanjut temuan — tanpa Peta (alat inspeksi) & Data (ekspor)
const NAV_AUDITEE: { id: MobileScreen; label: string; icon: React.ReactNode }[] = [
  { id: "beranda", label: "Beranda", icon: <Home className="h-4 w-4" /> },
  { id: "findings", label: "Temuan", icon: <Flag className="h-4 w-4" /> },
  { id: "guideline", label: "Panduan", icon: <Wrench className="h-4 w-4" /> },
  { id: "profile", label: "Data", icon: <Database className="h-4 w-4" /> },
];

// ADMIN: pemantauan corporate — 3 tab saja (admin memakai portal web)
const NAV_ADMIN: { id: MobileScreen; label: string; icon: React.ReactNode }[] = [
  { id: "beranda", label: "Beranda", icon: <Home className="h-4 w-4" /> },
  { id: "findings", label: "Temuan", icon: <Flag className="h-4 w-4" /> },
  { id: "profile", label: "Data", icon: <Database className="h-4 w-4" /> },
];

export function navPerPeran(role: Role | undefined) {
  if (role === "AUDITEE") return NAV_AUDITEE;
  if (role === "ADMIN") return NAV_ADMIN;
  return NAV_AUDITOR;
}

/** Layar pertama setelah login: BERANDA untuk semua peran (banner pemeriksaan
 *  tampil di sini). Tombol back HP juga selalu kembali ke Beranda. */
export function layarAwal(_role?: Role): MobileScreen {
  return "beranda";
}

export function BottomNav() {
  const { mobileScreen, setMobileScreen, session, draft } = useStore();
  const NAV = navPerPeran(session?.role);

  const klik = (id: MobileScreen) => {
    // Tab Pemeriksaan: bila draft inspeksi sedang berjalan, lanjutkan draft —
    // jangan kembali ke pemilihan perumahan yang bisa mengabaikan data terisi.
    if (id === "inspect-new" && draft.barakId) {
      setMobileScreen("inspect");
      return;
    }
    setMobileScreen(id);
  };

  return (
    <nav className="shrink-0 border-t bg-white px-2 pb-2 pt-1">
      <ul className="flex items-stretch justify-between">
        {NAV.map((n) => {
          // Seluruh alur inspeksi (pilih perumahan → formulir → detail item) menyorot tab Pemeriksaan.
          const aktif =
            n.id === "inspect-new"
              ? mobileScreen === "inspect-new" || mobileScreen === "inspect" || mobileScreen === "inspect-item"
              : mobileScreen === n.id;
          return (
            <li key={n.id} className="flex-1">
              <button
                onClick={() => klik(n.id)}
                aria-label={n.label}
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium",
                  aktif ? "text-forest" : "text-slate-400 hover:text-slate-600",
                )}
              >
                <span className={cn("rounded-lg px-3 py-0.5", aktif && "bg-forest-soft")}>{n.icon}</span>
                {n.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ScreenHeader({ title, sub, onBack, right }: { title: string; sub?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <header className="shrink-0 bg-gradient-to-r from-forest to-forest-deep px-4 py-3 text-white">
      <div className="flex items-center gap-2">
        {onBack ? (
          <button onClick={onBack} aria-label="Kembali" className="rounded-full bg-white/15 p-1.5 text-white hover:bg-white/25">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-bold leading-tight">{title}</h1>
          {sub ? <p className="truncate text-[12px] text-white/70">{sub}</p> : null}
        </div>
        {right}
      </div>
    </header>
  );
}
