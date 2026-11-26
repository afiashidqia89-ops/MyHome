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
  const [role, setRole] = useState<Role>("AUDITEE");
  const [sel, setSel] = useState<SetBinding>({ e: new Set(), k: new Set(), a: new Set(), b: new Set() });
  const [menyimpan, setMenyimpan] = useState(false);

  // Dialog ubah binding user eksisting
  const [editTarget, setEditTarget] = useState<{ id: string; nama: string; role: string } | null>(null);
  const [selEdit, setSelEdit] = useState<SetBinding>({ e: new Set(), k: new Set(), a: new Set(), b: new Set() });

  // Dialog HAPUS user permanen (tombol di kolom Aksi tabel)
  const [hapusTarget, setHapusTarget] = useState<{ id: string; nama: string; username: string } | null>(null);
  const [menghapus, setMenghapus] = useState(false);

  const totalPilihan = sel.e.size + sel.k.size + sel.a.size + sel.b.size;

  const bukaDialogBaru = () => {
    setNama("");
    setJabatan("");
    setRole("AUDITEE");
    setSel({ e: new Set(), k: new Set(), a: new Set(), b: new Set() });
    setOpen(true);
  };

  const simpan = async () => {
    if (!nama.trim() || !jabatan.trim()) {
      toast.error("Nama dan jabatan wajib diisi");
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

  const simpanBinding = async () => {
    if (!editTarget) return;
    setMenyimpan(true);
    try {
      await api.patch(`/api/users/${editTarget.id}`, { bindings: jadiPayload(selEdit) });
      qc.invalidateQueries({ queryKey: qk.users });
      qc.invalidateQueries({ queryKey: qk.aktivitas });
      toast.success(`Binding unit ${editTarget.nama} diperbarui`);
      setEditTarget(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMenyimpan(false);
    }
  };

  const setStatus = async (id: string, status: "ACTIVE" | "REJECTED", namaU: string) => {
    try {
      await api.patch(`/api/users/${id}`, { status });
      qc.invalidateQueries({ queryKey: qk.users });
      qc.invalidateQueries({ queryKey: qk.aktivitas });
      toast.success(status === "ACTIVE" ? `${namaU} disetujui — akun aktif` : `${namaU} ditolak`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  /** HAPUS PERMANEN akun user (API DELETE /api/users/[id]) —
   *  server menolak bila akun masih terkait data pemeriksaan/temuan. */
  const hapusUser = async () => {
    if (!hapusTarget) return;
    setMenghapus(true);
    try {
      await api.del(`/api/users/${hapusTarget.id}`);
      qc.invalidateQueries({ queryKey: qk.users });
      qc.invalidateQueries({ queryKey: qk.aktivitas });
      toast.success(`Akun ${hapusTarget.nama} dihapus permanen dari sistem`);
      setHapusTarget(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMenghapus(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Total Pengguna" value={users.length} icon={<UserPlus className="h-4 w-4" />} />
        <StatCard title="Aktif" value={aktif.length} sub="auditor, auditee & admin" icon={<UserCheck className="h-4 w-4" />} accent="sky" />
        <StatCard title="Menunggu Persetujuan" value={pending.length} sub="perlu keputusan admin" icon={<ShieldCheck className="h-4 w-4" />} accent="gold" />
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
          <h3 className="text-[13px] font-bold text-amber-800">Persetujuan Pendaftaran ({pending.length})</h3>
          <p className="text-[11px] text-amber-700">Pengguna yang mendaftar perlu disetujui admin sebelum akses aktif. Binding unit mengikuti data pendaftaran.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {pending.map((u) => (
              <div key={u.id} className="rounded-lg border border-amber-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-[11px] font-bold text-white">{u.nama.split(" ").map((w) => w[0]).join("")}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-bold text-slate-800">{u.nama}</p>
                    <p className="truncate text-[10px] text-slate-500">{u.jabatan}</p>
                  </div>
                  <span className={cn("ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold", ROLE_STYLE[u.role])}>{u.role}</span>
                </div>
                <p className="mt-1.5 truncate text-[10px] text-slate-400">@{u.username}</p>
                <p className="text-[10px] text-slate-400">Mendaftar: {fmtTanggal(u.createdAt)}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => setStatus(u.id, "ACTIVE", u.nama)} className="h-8 flex-1 bg-forest text-[11px] hover:bg-forest-deep">
                    <Check className="mr-1 h-3.5 w-3.5" /> Setujui
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(u.id, "REJECTED", u.nama)} className="h-8 flex-1 border-red-200 text-[11px] text-red-600">
                    <X className="mr-1 h-3.5 w-3.5" /> Tolak
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-bold text-slate-800">Daftar Pengguna</h3>
            <p className="text-[11px] text-slate-500">Pendaftaran hanya oleh admin — tanpa email; user bisa diberi lebih dari satu estate/kebun/afdeling/perumahan (centang)</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={bukaDialogBaru} className="bg-forest text-[12px] font-semibold hover:bg-forest-deep"><UserPlus className="mr-1.5 h-4 w-4" /> Tambah User</Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle className="text-[15px]">Tambah Pengguna Baru</DialogTitle>
                <DialogDescription className="text-[12px]">
                  Tanpa email — nama pengguna dibuat otomatis dari nama. Akun langsung aktif; sandi awal <b>rumahlayak123</b>. Centang unit yang boleh diakses — boleh lebih dari satu (centang induk mencakup seluruh isinya; centang level lebih rinci untuk membatasi).
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px]">Nama Lengkap</Label>
                    <Input value={nama} onChange={(e) => setNama(e.target.value)} className="mt-1 h-9 text-[12px]" placeholder="cth: Samsul Bahri" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Jabatan</Label>
                    <Input value={jabatan} onChange={(e) => setJabatan(e.target.value)} className="mt-1 h-9 text-[12px]" placeholder="cth: Asisten Afdeling I" />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px]">Role / Akses</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                    <SelectTrigger className="mt-1 h-9 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUDITOR">AUDITOR — pemeriksa</SelectItem>
                      <SelectItem value="AUDITEE">AUDITEE — tindak lanjut</SelectItem>
                      <SelectItem value="ADMIN">ADMIN — portal web</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {role !== "ADMIN" ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px]">Binding Unit (boleh pilih banyak)</Label>
                      <span className="rounded bg-forest-soft px-1.5 py-0.5 text-[9.5px] font-bold text-forest">{totalPilihan} tercentang</span>
                    </div>
                    {master ? (
                      <div className="mt-1">
                        <PohonBinding master={master} sel={sel} setSel={setSel} />
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">Memuat data master...</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500">ADMIN corporate — tanpa binding (melihat seluruh kebun)</div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} className="h-9 text-[12px]">Batal</Button>
                <Button onClick={simpan} disabled={menyimpan} className="h-9 bg-forest text-[12px] hover:bg-forest-deep">
                  {menyimpan ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Simpan User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-[11px]">Nama</TableHead>
                <TableHead className="text-[11px]">Nama Pengguna</TableHead>
                <TableHead className="text-[11px]">Role</TableHead>
                <TableHead className="text-[11px]">Jabatan</TableHead>
                <TableHead className="text-[11px]">Binding Unit</TableHead>
                <TableHead className="text-[11px]">Terdaftar</TableHead>
                <TableHead className="text-[11px]">Status</TableHead>
                <TableHead className="text-[11px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="py-6 text-center text-[12px] text-slate-400"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Memuat...</TableCell></TableRow>
              )}
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="text-[12px] font-semibold text-slate-700">{u.nama}</TableCell>
                  <TableCell className="font-mono text-[11.5px] text-slate-500">@{u.username}</TableCell>
                  <TableCell><span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", ROLE_STYLE[u.role])}>{u.role}</span></TableCell>
                  <TableCell className="text-[11.5px] text-slate-600">{u.jabatan}</TableCell>
                  <TableCell className="max-w-[240px] text-[11px] text-slate-600">
                    {u.bindings?.length ? u.bindings.join(" • ") : (u.kebunNama ?? "—")}
                  </TableCell>
                  <TableCell className="text-[11.5px] text-slate-500">{fmtTanggal(u.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[10px]", u.status === "ACTIVE" ? "border-green-200 bg-green-50 text-green-700" : u.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-600")}>
                      {u.status === "ACTIVE" ? "AKTIF" : u.status === "PENDING" ? "MENUNGGU" : "DITOLAK"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.role !== "ADMIN" && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px] text-forest"
                          onClick={() => {
                            setEditTarget({ id: u.id, nama: u.nama, role: u.role });
                            setSelEdit(dariIds(u.bindingIds));
                          }}
                        >
                          Ubah Binding
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 border-red-200 px-2 text-[10px] text-red-600 hover:bg-red-50"
                          onClick={() => setHapusTarget({ id: u.id, nama: u.nama, username: u.username })}
                        >
                          <Trash2 className="mr-1 h-3 w-3" /> Hapus
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          Tombol <b>Hapus</b> menghapus akun secara permanen (hanya akun tanpa data pemeriksaan/temuan). Akun yang masih terkait data sebaiknya nonaktifkan lewat status DITOLAK agar riwayat papan &amp; audit trail tetap utuh.
        </p>
      </div>

      {/* Dialog konfirmasi HAPUS user permanen */}
      <AlertDialog open={!!hapusTarget} onOpenChange={(v) => !v && setHapusTarget(null)}>
        <AlertDialogContent className="rounded-xl sm:max-w-[430px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Hapus Akun — {hapusTarget?.nama}?</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              Akun <b>@{hapusTarget?.username}</b> beserta binding unitnya akan dihapus permanen dari sistem. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-[12px]">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={hapusUser}
              disabled={menghapus}
              className="h-9 bg-red-600 text-[12px] hover:bg-red-700"
            >
              {menghapus ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
              {menghapus ? "Menghapus..." : "Ya, Hapus Permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog ubah binding user eksisting */}
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="rounded-xl sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Ubah Binding Unit — {editTarget?.nama}</DialogTitle>
            <DialogDescription className="text-[12px]">
              Centang unit yang boleh diakses user ini. Boleh lebih dari satu estate/kebun/afdeling/perumahan; perubahan berlaku pada login berikutnya.
            </DialogDescription>
          </DialogHeader>
          <div className="py-1">
            {master ? (
              <PohonBinding master={master} sel={selEdit} setSel={setSelEdit} />
            ) : (
              <p className="text-[11px] text-slate-400">Memuat data master...</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} className="h-9 text-[12px]">Batal</Button>
            <Button onClick={simpanBinding} disabled={menyimpan} className="h-9 bg-forest text-[12px] hover:bg-forest-deep">
              {menyimpan ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Simpan Binding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
