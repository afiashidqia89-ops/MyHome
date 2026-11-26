"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { qk, useUsers } from "@/lib/queries";
import { fmtTanggal } from "@/lib/utils-rl";
import { StatCard } from "@/components/rl-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronDown, ChevronRight, Layers3, Loader2, ShieldCheck, Trash2, TreePalm, UserCheck, UserPlus, Warehouse, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MasterData } from "@/lib/types";
import type { Role } from "@/lib/types";

const ROLE_STYLE: Record<Role, string> = {
  AUDITOR: "bg-forest text-white",
  AUDITEE: "bg-sky-600 text-white",
  ADMIN: "bg-gold text-forest-deep",
};

type BindingIds = { estateId: string | null; kebunId: string | null; afdelingId: string | null; barakId: string | null };

// ============ POHON CENTANG BINDING (multi estate/kebun/afdeling/perumahan) ============
interface SetBinding {
  e: Set<string>;
  k: Set<string>;
  a: Set<string>;
  b: Set<string>;
}

/** Centang satu node (eksplisit). Anak yang cocok tampil "ikut" otomatis oleh resolusi server. */
function toggleNode(kind: "e" | "k" | "a" | "b", id: string, cur: SetBinding): SetBinding {
  const s = new Set(cur[kind]);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  return { ...cur, [kind]: s } as SetBinding;
}

function PohonBinding({ master, sel, setSel }: { master: MasterData; sel: SetBinding; setSel: (s: SetBinding) => void }) {
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set(master.estates.map((e) => e.id)));
  const toggleBuka = (id: string) => {
    const t = new Set(terbuka);
    if (t.has(id)) t.delete(id);
    else t.add(id);
    setTerbuka(t);
  };

  const cb = (aktif: boolean, sebagian: boolean) => ({ checked: aktif ? true : sebagian ? ("indeterminate" as const) : false });

  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border bg-white p-2 thin-scroll">
      {master.estates.map((e) => {
        const kebuns = master.kebuns.filter((k) => k.estateId === e.id);
        const anakTerpilih = kebuns.some((k) => sel.k.has(k.id)) || kebuns.some((k) => master.afdelings.some((a) => a.kebunId === k.id && (sel.a.has(a.id) || master.baraks.some((bb) => bb.afdelingId === a.id && sel.b.has(bb.id)))));
        return (
          <div key={e.id}>
            <div className="flex items-center gap-2 py-1">
              <button onClick={() => toggleBuka(e.id)} aria-label="Buka/tutup estate" className="text-slate-400 hover:text-forest">
                {terbuka.has(e.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              <Checkbox
                id={`e-${e.id}`}
                {...cb(sel.e.has(e.id), !sel.e.has(e.id) && anakTerpilih)}
                onCheckedChange={() => setSel(toggleNode("e", e.id, sel))}
                className="h-3.5 w-3.5"
              />
              <label htmlFor={`e-${e.id}`} className="flex items-center gap-1 text-[12px] font-bold text-slate-700">
                <Building2 className="h-3.5 w-3.5 text-forest" /> {e.nama}
                <span className="text-[9px] font-medium text-slate-400">(semua kebun di bawahnya)</span>
              </label>
            </div>
            {terbuka.has(e.id) && (
              <div className="ml-7 border-l border-slate-200 pl-3">
                {kebuns.map((k) => {
                  const afdelings = master.afdelings.filter((a) => a.kebunId === k.id);
                  const anakK = afdelings.some((a) => sel.a.has(a.id)) || afdelings.some((a) => master.baraks.some((bb) => bb.afdelingId === a.id && sel.b.has(bb.id)));
                  return (
                    <div key={k.id}>
                      <div className="flex items-center gap-2 py-1">
                        <button onClick={() => toggleBuka(k.id)} aria-label="Buka/tutup kebun" className="text-slate-400 hover:text-forest">
                          {terbuka.has(k.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                        <Checkbox
                          id={`k-${k.id}`}
                          {...cb(sel.k.has(k.id), !sel.k.has(k.id) && anakK)}
                          onCheckedChange={() => setSel(toggleNode("k", k.id, sel))}
                          className="h-3.5 w-3.5"
                        />
                        <label htmlFor={`k-${k.id}`} className="flex items-center gap-1 text-[11.5px] font-semibold text-slate-600">
                          <TreePalm className="h-3.5 w-3.5 text-forest" /> {k.nama}
                        </label>
                      </div>
                      {terbuka.has(k.id) && (
                        <div className="ml-6 border-l border-slate-200 pl-3">
                          {afdelings.map((a) => {
                            const baraks = master.baraks.filter((bb) => bb.afdelingId === a.id);
                            const anakA = baraks.some((bb) => sel.b.has(bb.id));
                            return (
                              <div key={a.id}>
                                <div className="flex items-center gap-2 py-1">
                                  <button onClick={() => toggleBuka(a.id)} aria-label="Buka/tutup afdeling" className="text-slate-400 hover:text-forest">
                                    {baraks.length > 0 ? (terbuka.has(a.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="inline-block h-3.5 w-3.5" />}
                                  </button>
                                  <Checkbox
                                    id={`a-${a.id}`}
                                    {...cb(sel.a.has(a.id), !sel.a.has(a.id) && anakA)}
                                    onCheckedChange={() => setSel(toggleNode("a", a.id, sel))}
                                    className="h-3.5 w-3.5"
                                  />
                                  <label htmlFor={`a-${a.id}`} className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                                    <Layers3 className="h-3.5 w-3.5 text-forest" /> {a.nama}
                                  </label>
                                </div>
                                {terbuka.has(a.id) && baraks.length > 0 && (
                                  <div className="ml-6 border-l border-slate-200 pl-3">
                                    {baraks.map((bb) => (
                                      <div key={bb.id} className="flex items-center gap-2 py-0.5">
                                        <Checkbox
                                          id={`b-${bb.id}`}
                                          {...cb(sel.b.has(bb.id), false)}
                                          onCheckedChange={() => setSel(toggleNode("b", bb.id, sel))}
                                          className="h-3.5 w-3.5"
                                        />
                                        <label htmlFor={`b-${bb.id}`} className="flex items-center gap-1 text-[10.5px] text-slate-500">
                                          <Warehouse className="h-3 w-3 text-forest" /> {bb.nama}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {master.estates.length === 0 && <p className="p-2 text-[11px] text-slate-400">Belum ada estate pada data master.</p>}
    </div>
  );
}

function jadiPayload(sel: SetBinding): BindingIds[] {
  const out: BindingIds[] = [];
  sel.e.forEach((id) => out.push({ estateId: id, kebunId: null, afdelingId: null, barakId: null }));
  sel.k.forEach((id) => out.push({ estateId: null, kebunId: id, afdelingId: null, barakId: null }));
  sel.a.forEach((id) => out.push({ estateId: null, kebunId: null, afdelingId: id, barakId: null }));
  sel.b.forEach((id) => out.push({ estateId: null, kebunId: null, afdelingId: null, barakId: id }));
  return out;
}

function dariIds(ids: BindingIds[] | undefined): SetBinding {
  const sel: SetBinding = { e: new Set(), k: new Set(), a: new Set(), b: new Set() };
  (ids ?? []).forEach((b) => {
    if (b.estateId) sel.e.add(b.estateId);
    if (b.kebunId) sel.k.add(b.kebunId);
    if (b.afdelingId) sel.a.add(b.afdelingId);
    if (b.barakId) sel.b.add(b.barakId);
  });
  return sel;
}

// ============ HALAMAN PENDAFTARAN USER ============
export function WebUsers() {
  const { master } = useStore();
  const { data: users = [], isLoading } = useUsers(true);
  const qc = useQueryClient();
  const pending = users.filter((u) => u.status === "PENDING");
  const aktif = users.filter((u) => u.status === "ACTIVE");

  const [open, setOpen] = useState(false);
  const [nama, setNama] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [sandi, setSandi] = useState("");
  const [role, setRole] = useState<Role>("AUDITEE");
  const [sel, setSel] = useState<SetBinding>({ e: new Set(), k: new Set(), a: new Set(), b: new Set() });
  const [menyimpan, setMenyimpan] = useState(false);

  // Dialog UBAH DATA user eksisting (nama, jabatan, role, kata sandi, binding)
  const [editTarget, setEditTarget] = useState<{ id: string; nama: string; role: string } | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editJabatan, setEditJabatan] = useState("");
  const [editRole, setEditRole] = useState<Role>("AUDITEE");
  const [editSandi, setEditSandi] = useState("");
  const [selEdit, setSelEdit] = useState<SetBinding>({ e: new Set(), k: new Set(), a: new Set(), b: new Set() });

  // Dialog HAPUS user permanen (tombol di kolom Aksi tabel)
  const [hapusTarget, setHapusTarget] = useState<{ id: string; nama: string; username: string } | null>(null);
  const [menghapus, setMenghapus] = useState(false);

  const totalPilihan = sel.e.size + sel.k.size + sel.a.size + sel.b.size;
  const totalEditPilihan = selEdit.e.size + selEdit.k.size + selEdit.a.size + selEdit.b.size;

  const bukaDialogBaru = () => {
    setNama("");
    setJabatan("");
    setSandi("");
    setRole("AUDITEE");
    setSel({ e: new Set(), k: new Set(), a: new Set(), b: new Set() });
    setOpen(true);
  };

  const simpan = async () => {
    if (!nama.trim() || !jabatan.trim()) {
      toast.error("Nama dan jabatan wajib diisi");
      return;
    }
    if (sandi.trim().length < 6) {
      toast.error("Kata sandi wajib dibuat saat pendaftaran — minimal 6 karakter");
      return;
    }
    if (role !== "ADMIN" && totalPilihan === 0) {
      toast.error("Centang minimal satu estate/kebun/afdeling/perumahan — user diikat pada unit terdaftar");
      return;
    }
    setMenyimpan(true);
    try {
      const res = await api.post<{ user: { username: string }; sandiAwal: string }>("/api/users", {
        nama: nama.trim(),
        jabatan: jabatan.trim(),
        role,
        password: sandi.trim(),
        bindings: jadiPayload(sel),
      });
      qc.invalidateQueries({ queryKey: qk.users });
      qc.invalidateQueries({ queryKey: qk.aktivitas });
      toast.success(`User ${nama} ditambahkan sebagai ${role}. Nama pengguna: ${res.user.username} — sandi awal: ${res.sandiAwal}`);
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMenyimpan(false);
    }
  };

  /** Buka dialog UBAH DATA — semua isian diprefill dari data user terpilih. */
  const bukaUbah = (u: { id: string; nama: string; jabatan?: string; role: string; bindingIds?: BindingIds[] }) => {
    setEditTarget({ id: u.id, nama: u.nama, role: u.role });
    setEditNama(u.nama);
    setEditJabatan(u.jabatan ?? "");
    setEditRole((u.role as Role) ?? "AUDITEE");
    setEditSandi("");
    setSelEdit(dariIds(u.bindingIds));
  };

  /** Simpan perubahan data user (PATCH /api/users/[id]): nama, jabatan,
   *  role, kata sandi baru (opsional) dan binding unit. */
  const simpanEdit = async () => {
    if (!editTarget) return;
    if (!editNama.trim()) {
      toast.error("Nama tidak boleh kosong");
      return;
    }
    if (!editJabatan.trim()) {
      toast.error("Jabatan wajib diisi");
      return;
    }
    if (editSandi.trim() && editSandi.trim().length < 6) {
      toast.error("Kata sandi baru minimal 6 karakter");
      return;
    }
    if (editRole !== "ADMIN" && totalEditPilihan === 0) {
      toast.error("User lapangan wajib punya minimal satu binding unit");
      return;
    }
    setMenyimpan(true);
    try {
      await api.patch(`/api/users/${editTarget.id}`, {
        nama: editNama.trim(),
        jabatan: editJabatan.trim(),
        role: editRole,
        ...(editSandi.trim() ? { password: editSandi.trim() } : {}),
        bindings: editRole === "ADMIN" ? [] : jadiPayload(selEdit),
      });
      qc.invalidateQueries({ queryKey: qk.users });
      qc.invalidateQueries({ queryKey: qk.aktivitas });
      toast.success(`Data user ${editNama} diperbarui${editSandi.trim() ? " — kata sandi baru berlaku pada login berikutnya" : ""}`);
      setEditTarget(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMenyimpan(false);
    }
  };
