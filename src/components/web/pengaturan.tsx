"use client";
// ============================================================
// RumahLayak — Menu PENGATURAN (portal web)
// Profil & binding akun, ganti kata sandi sendiri, info aplikasi,
// segarkan data server, dan keluar sesi.
// ============================================================
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { ringkasBinding } from "@/lib/utils-rl";
import { api, clearToken } from "@/lib/api";
import { qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Building2, Database, Info, KeyRound, Loader2, LogOut, RefreshCw, ShieldCheck, User } from "lucide-react";

export function WebPengaturan() {
  const { session, master, setSession, setMobileScreen } = useStore();
  const qc = useQueryClient();
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [sandiLama, setSandiLama] = useState("");
  const [sandiBaru, setSandiBaru] = useState("");
  const [sandiUlang, setSandiUlang] = useState("");
  const [simpanSandi, setSimpanSandi] = useState(false);

  if (!session) return null;

  // ---------- Ganti sandi ----------
  const gantiSandi = async () => {
    if (!sandiLama || !sandiBaru || !sandiUlang) return toast.error("Semua kolom sandi wajib diisi");
    if (sandiBaru !== sandiUlang) return toast.error("Konfirmasi sandi tidak sama");
    setSimpanSandi(true);
    try {
      await api.patch("/api/auth/password", { sandiLama, sandiBaru });
      toast.success("Kata sandi berhasil diganti — gunakan sandi baru pada login berikutnya");
      setSandiLama("");
      setSandiBaru("");
      setSandiUlang("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSimpanSandi(false);
    }
  };

  // ---------- Segarkan data ----------
  const segarkan = async () => {
    setMenyegarkan(true);
    qc.invalidateQueries({ queryKey: qk.master });
    qc.invalidateQueries({ queryKey: qk.inspeksi });
    qc.invalidateQueries({ queryKey: qk.temuan });
    qc.invalidateQueries({ queryKey: qk.aktivitas });
    setTimeout(() => {
      setMenyegarkan(false);
      toast.success("Data server disegarkan dari PostgreSQL");
    }, 600);
  };

  // ---------- Keluar ----------
  const keluar = async () => {
    try { await api.post("/api/auth/logout"); } catch { /* abaikan */ }
    clearToken();
    setSession(null);
    setMobileScreen("login");
    window.location.reload();
  };

  const kartu = "rounded-xl border bg-white p-4 shadow-sm";

  return (
    <div className="space-y-4">
      {/* Profil & binding */}
      <div className={kartu}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-soft text-forest"><User className="h-4 w-4" /></div>
          <div>
            <h3 className="text-[13px] font-bold text-slate-800">Profil Akun</h3>
            <p className="text-[11px] text-slate-500">Identitas login &amp; unit tempat Anda didaftarkan admin</p>
          </div>
        </div>
        <div className="mt-3 grid gap-x-6 gap-y-2 text-[12px] sm:grid-cols-2">
          <BarisInfo label="Nama" nilai={session.nama} />
          <BarisInfo label="Nama Pengguna" nilai={session.username} />
          <BarisInfo label="Jabatan" nilai={session.jabatan || "-"} />
          <div className="flex items-center gap-2">
            <span className="w-[110px] shrink-0 text-slate-500">Peran</span>
            <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-bold text-white", session.role === "ADMIN" ? "bg-slate-800" : session.role === "AUDITOR" ? "bg-forest" : "bg-gold-deep")}>{session.role}</span>
          </div>
          <div className="flex items-start gap-2 sm:col-span-2">
            <span className="w-[110px] shrink-0 text-slate-500">Binding Unit</span>
            <span className="inline-flex items-center gap-1 text-slate-700">
              <Building2 className="h-3.5 w-3.5 text-forest" /> {ringkasBinding(session.bindings, session.role === "ADMIN" ? "Corporate — seluruh kebun" : session.kebunNama ?? "-")}
            </span>
          </div>
        </div>
      </div>

      {/* Ganti sandi */}
      <div className={kartu}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-soft text-forest"><KeyRound className="h-4 w-4" /></div>
          <div>
            <h3 className="text-[13px] font-bold text-slate-800">Ganti Kata Sandi</h3>
            <p className="text-[11px] text-slate-500">Sandi baru minimal 6 karakter — berlaku untuk portal web &amp; APK Mobile</p>
          </div>
        </div>
        <div className="mt-3 grid max-w-md gap-3">
          <div>
            <Label className="text-[11px] text-slate-500">Sandi Lama</Label>
            <Input type="password" value={sandiLama} onChange={(e) => setSandiLama(e.target.value)} className="mt-1 h-9 text-[12px]" />
          </div>
          <div>
            <Label className="text-[11px] text-slate-500">Sandi Baru</Label>
            <Input type="password" value={sandiBaru} onChange={(e) => setSandiBaru(e.target.value)} className="mt-1 h-9 text-[12px]" />
          </div>
          <div>
            <Label className="text-[11px] text-slate-500">Ulangi Sandi Baru</Label>
            <Input type="password" value={sandiUlang} onChange={(e) => setSandiUlang(e.target.value)} className="mt-1 h-9 text-[12px]" onKeyDown={(e) => e.key === "Enter" && gantiSandi()} />
          </div>
          <Button onClick={gantiSandi} disabled={simpanSandi} className="h-9 bg-forest text-[12px] font-bold hover:bg-forest-deep">
            {simpanSandi ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Menyimpan…</> : "Simpan Sandi Baru"}
          </Button>
        </div>
      </div>

      {/* Info aplikasi */}
      <div className={kartu}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-soft text-forest"><Info className="h-4 w-4" /></div>
          <div>
            <h3 className="text-[13px] font-bold text-slate-800">Info Aplikasi</h3>
            <p className="text-[11px] text-slate-500">Status server &amp; ringkasan data aktif</p>
          </div>
        </div>
        <div className="mt-3 grid gap-x-6 gap-y-2 text-[12px] sm:grid-cols-2">
          <BarisInfo label="Aplikasi" nilai="RumahLayak — Kamishibai Digital v1" />
          <BarisInfo label="Periode Aktif" nilai={master?.periodeAktif ?? "-"} />
          <BarisInfo label="Server" nilai="Next.js + PostgreSQL (Neon) + Vercel" />
          <div className="flex items-center gap-2">
            <span className="w-[110px] shrink-0 text-slate-500">Koneksi</span>
            <span className="inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-bold text-green-800"><ShieldCheck className="h-3 w-3" /> API + DB terhubung</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-[110px] shrink-0 text-slate-500">Master Data</span>
            <span className="inline-flex items-center gap-1 text-slate-700"><Database className="h-3.5 w-3.5 text-slate-400" /> {(master?.baraks ?? []).length} perumahan • {(master?.afdelings ?? []).length} afdeling • {(master?.checklist ?? []).length} item checklist</span>
          </div>
        </div>
      </div>

      {/* Aksi */}
      <div className={cn(kartu, "flex flex-wrap items-center gap-3")}>
        <Button variant="outline" onClick={segarkan} disabled={menyegarkan} className="h-9 text-[12px]">
          {menyegarkan ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />} Segarkan Data Server
        </Button>
        <Button onClick={keluar} variant="outline" className="h-9 border-red-200 text-[12px] text-red-600 hover:bg-red-50">
          <LogOut className="mr-1.5 h-4 w-4" /> Keluar (akhiri sesi)
        </Button>
        <p className="ml-auto text-[10px] text-slate-400">Sesi JWT aktif 7 hari • data ter-scope binding akun Anda</p>
      </div>
    </div>
  );
}

function BarisInfo({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[110px] shrink-0 text-slate-500">{label}</span>
      <span className="font-semibold text-slate-700">{nilai}</span>
    </div>
  );
}
