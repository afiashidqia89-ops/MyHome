"use client";
import { useStore } from "@/lib/store";
import { ringkasBinding } from "@/lib/utils-rl";
import { LogoMark } from "@/components/mobile/screens-core";
import { cn } from "@/lib/utils";
import { ClipboardCheck, ClipboardList, LayoutDashboard, MapPinned, Settings, Table2, UserPlus } from "lucide-react";
import type { WebPage } from "@/lib/types";

// ---------- Menu web per peran (fungsi & kebutuhan masing-masing) ----------
// adminOnly  : hanya ADMIN corporate
// bukanAuditee : disembunyikan dari AUDITEE (alat perencanaan inspeksi auditor)
const MENU: { id: WebPage; label: string; icon: React.ReactNode; desc: string; descAuditee?: string; adminOnly?: boolean; bukanAuditee?: boolean }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, desc: "Ringkasan kinerja kelayakan", descAuditee: "Tugas tindak lanjut saya" },
  { id: "detail", label: "Detail Pemeriksaan", icon: <ClipboardCheck className="h-4 w-4" />, desc: "Rincian hasil inspeksi & status perbaikan" },
  { id: "rekap", label: "Rekap Report", icon: <ClipboardList className="h-4 w-4" />, desc: "Papan Rekap Kamishibai" },
  { id: "peta", label: "Peta Lokasi", icon: <MapPinned className="h-4 w-4" />, desc: "Sebaran titik pemeriksaan GPS", bukanAuditee: true },
  { id: "master", label: "Data Master", icon: <Table2 className="h-4 w-4" />, desc: "Kelola estate, kebun, afdeling & perumahan", adminOnly: true },
  { id: "users", label: "Pendaftaran User", icon: <UserPlus className="h-4 w-4" />, desc: "Kelola akses & binding kebun", adminOnly: true },
  { id: "pengaturan", label: "Pengaturan", icon: <Settings className="h-4 w-4" />, desc: "Profil, ganti sandi & info aplikasi" },
];

export function menuWebPerPeran(role: string | undefined) {
  return MENU.filter((m) => {
    if (m.adminOnly) return role === "ADMIN";
    if (m.bukanAuditee) return role !== "AUDITEE";
    return true;
  });
}

export function WebLayout({ children }: { children: React.ReactNode }) {
  const { webPage, setWebPage, session, master } = useStore();
  const admin = session?.role === "ADMIN";
  const auditee = session?.role === "AUDITEE";
  const menu = menuWebPerPeran(session?.role);
  const aktif = menu.find((m) => m.id === webPage) ?? menu[0];
  const bindingLabel = admin
    ? "Corporate — seluruh kebun"
    : ringkasBinding(session?.bindings, session?.kebunNama ?? "-");

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-forest-deep md:flex">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
          <LogoMark size={36} />
          <div>
            <p className="text-[14px] font-extrabold text-white">RumahLayak</p>
            <p className="text-[9.5px] text-gold">Portal Web — Kamishibai Digital</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {menu.map((m) => (
            <button
              key={m.id}
              onClick={() => setWebPage(m.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition",
                webPage === m.id ? "bg-white/15 text-white ring-1 ring-gold/50" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <span className={cn(webPage === m.id ? "text-gold" : "")}>{m.icon}</span>
              <span>
                <span className="block text-[12.5px] font-semibold">{m.label}</span>
                <span className="block text-[9.5px] opacity-60">{m.desc}</span>
              </span>
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2 px-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold text-white">{session?.nama.split(" ").map((w) => w[0]).join("")}</span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-white">{session?.nama}</p>
              <p className="truncate text-[9px] text-white/60">{session?.role} • {session?.jabatan}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen flex-1 flex-col md:ml-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white px-4 py-3 shadow-sm md:px-6">
          <div className="md:hidden">
            <LogoMark size={30} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-slate-800">{aktif?.label}</h1>
            <p className="hidden text-[11px] text-slate-500 sm:block">{auditee && aktif?.descAuditee ? aktif.descAuditee : aktif?.desc} — Periode {master?.periodeAktif ?? ""}</p>
          </div>
          <span className="ml-auto hidden rounded-full bg-forest-soft px-3 py-1 text-[10px] font-bold text-forest md:inline">{master?.estates[0]?.nama ?? "Estate"} • {bindingLabel}</span>
          <span className="rounded-full bg-forest px-2.5 py-1 text-[10px] font-bold text-white">PRODUKSI • API + DB</span>
        </header>

        {/* Nav mobile */}
        <nav className="flex gap-1 overflow-x-auto border-b bg-white px-3 py-2 md:hidden thin-scroll">
          {menu.map((m) => (
            <button
              key={m.id}
              onClick={() => setWebPage(m.id)}
              className={cn("shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold", webPage === m.id ? "bg-forest text-white" : "bg-slate-100 text-slate-600")}
            >
              {m.label}
            </button>
          ))}
        </nav>

        <main className="flex-1 p-4 md:p-6">{children}</main>
        <footer className="mt-auto border-t bg-white px-6 py-3 text-center text-[10px] text-slate-400">
          RumahLayak — Sistem pemeriksaan kelayakan perumahan & fasilitas karyawan • Stack: Next.js + PostgreSQL (Neon) + Vercel + Capacitor
        </footer>
      </div>
    </div>
  );
}
