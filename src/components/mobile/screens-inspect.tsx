"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, namaAfdeling, namaBarak } from "@/lib/store";
import { api } from "@/lib/api";
import { qk, useInspeksi, useRefresh } from "@/lib/queries";
import { fmtKoor, fmtTanggal, namaBarakSingkat } from "@/lib/utils-rl";
import { lokasiSaatIni } from "@/lib/perangkat";
import { ScreenHeader } from "@/components/mobile/frame";
import { KameraBawaan } from "@/components/mobile/kamera";
import { ChipStatus } from "@/components/rl-bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Crosshair, Flag, ImageOff, Loader2, MapPin, Save, ShieldAlert, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraftTemuan } from "@/lib/types";

// ============ FORM PEMERIKSAAN (estate → kebun → afdeling → perumahan) ============
// PIC papan kamishibai dihapus — pemeriksa cukup mengisi unit yang diperiksa;
// daftar unit hanya memuat yang terikat dengan akun (multi binding).
export function InspectNewScreen() {
  const store = useStore();
  const { session, master, startDraft, setMobileScreen, inspectPreselect } = store;
  const { data: inspections = [] } = useInspeksi(true);

  // Preselect dari Peta Blok: turunkan estate/kebun dari afdeling yang dipilih.
  const pre = (() => {
    if (!inspectPreselect || !master) return null;
    const afd = master.afdelings.find((a) => a.id === inspectPreselect.afdelingId);
    const kb = master.kebuns.find((k) => k.id === afd?.kebunId);
    const es = master.estates.find((e) => e.id === kb?.estateId);
    return { estateId: es?.id ?? "", kebunId: kb?.id ?? "", afdelingId: afd?.id ?? "" };
  })();

  const [estateId, setEstateId] = useState<string>(pre?.estateId ?? master?.estates[0]?.id ?? "");
  const [kebunId, setKebunId] = useState<string>(pre?.kebunId ?? (master?.kebuns ?? []).find((k) => k.estateId === (pre?.estateId ?? master?.estates[0]?.id))?.id ?? "");
  const [afdelingId, setAfdelingId] = useState<string>(pre?.afdelingId ?? (master?.afdelings ?? []).find((a) => a.kebunId === kebunId)?.id ?? "");
  const [barakId, setBarakId] = useState<string | null>(inspectPreselect?.barakId ?? null);

  // Bersihkan preselect saat layar ditutup — buka ulang form mulai lagi dari default.
  useEffect(
    () => () => {
      if (useStore.getState().inspectPreselect) useStore.getState().setInspectPreselect(null);
    },
    [],
  );

  if (!session) return null;

  const kebunList = (master?.kebuns ?? []).filter((k) => k.estateId === estateId);
  const afdList = (master?.afdelings ?? []).filter((a) => a.kebunId === kebunId);
  const barakList = (master?.baraks ?? []).filter((b) => b.afdelingId === afdelingId);
  const afdDipilih = (master?.afdelings ?? []).find((a) => a.id === afdelingId);

  const pilihEstate = (id: string) => {
    setEstateId(id);
    const kb = (master?.kebuns ?? []).find((k) => k.estateId === id);
    setKebunId(kb?.id ?? "");
    const af = (master?.afdelings ?? []).find((a) => a.kebunId === kb?.id);
    setAfdelingId(af?.id ?? "");
    setBarakId(null);
  };
  const pilihKebun = (id: string) => {
    setKebunId(id);
    const af = (master?.afdelings ?? []).find((a) => a.kebunId === id);
    setAfdelingId(af?.id ?? "");
    setBarakId(null);
  };
  const pilihAfdeling = (id: string) => {
    setAfdelingId(id);
    setBarakId(null);
  };

  const auditTerakhir = (bid: string) => {
    const list = inspections.filter((i) => i.barakId === bid && i.results.some((r) => r.status !== null));
    return list[0];
  };

  const mulai = () => {
    if (!barakId) return;
    startDraft(barakId); // tanpa PIC kamishibai — langsung ke form penilaian
    toast.success(`Pemeriksaan dimulai — ${namaBarakSingkat(namaBarak(barakId), afdDipilih?.nama)} (27 item)`);
  };
  const labelBarak = (nama: string) => namaBarakSingkat(nama, afdDipilih?.nama);

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Mulai Pemeriksaan" sub="Isi unit yang diperiksa: estate → kebun → afdeling → perumahan" onBack={() => setMobileScreen("peta")} />
      <div className="flex-1 overflow-y-auto thin-scroll p-3">
        {/* FORM: unit yang diperiksa */}
        <div className="rounded-xl border bg-white p-3">
          <p className="text-[10px] font-bold text-slate-500">UNIT YANG DIPERIKSA</p>
          <div className="mt-2 space-y-2">
            <div>
              <Label className="text-[10px] font-semibold text-slate-500">ESTATE PERIKSA</Label>
              <Select value={estateId} onValueChange={pilihEstate}>
                <SelectTrigger className="mt-1 h-9 text-[12px]"><SelectValue placeholder="Pilih estate" /></SelectTrigger>
                <SelectContent>
                  {(master?.estates ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-semibold text-slate-500">KEBUN PERIKSA</Label>
              <Select value={kebunId} onValueChange={pilihKebun}>
                <SelectTrigger className="mt-1 h-9 text-[12px]"><SelectValue placeholder="Pilih kebun" /></SelectTrigger>
                <SelectContent>
                  {kebunList.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-semibold text-slate-500">AFDELING PERIKSA</Label>
              <Select value={afdelingId} onValueChange={pilihAfdeling}>
                <SelectTrigger className="mt-1 h-9 text-[12px]"><SelectValue placeholder="Pilih afdeling" /></SelectTrigger>
                <SelectContent>
                  {afdList.map((a) => <SelectItem key={a.id} value={a.id}>{a.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <p className="mb-2 mt-4 text-[11px] font-semibold text-slate-500">PERUMAHAN YANG DIPERIKSA{afdDipilih ? "" : " — PILIH AFDELING DULU"}</p>
        <div className="space-y-2">
          {barakList.map((b) => {
            const last = auditTerakhir(b.id);
            return (
              <button key={b.id} onClick={() => setBarakId(b.id)} className={cn("w-full rounded-xl border p-3 text-left transition", barakId === b.id ? "border-forest bg-forest-soft ring-1 ring-forest" : "border-slate-200 bg-white hover:border-forest/50")}>
                <div className="flex items-center justify-between">
                  {/* Afdeling sudah dipilih — nama tampil tanpa prefix afdeling */}
                  <span className="text-[13px] font-bold text-slate-800">{labelBarak(b.nama)}</span>
                  {last ? <ChipStatus s={last.results.some((r) => r.status === "M") ? "M" : "H"} className="scale-90" /> : <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">Belum diaudit</span>}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">kapasitas {b.kapasitas} orang</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><MapPin className="h-3 w-3" /> {fmtKoor(b.koordinat?.lat, b.koordinat?.lng)}{last ? ` • audit ${fmtTanggal(last.tanggal)}` : ""}</p>
              </button>
            );
          })}
          {!barakList.length && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-[11px] text-slate-400">Belum ada perumahan pada afdeling ini.</p>
          )}
        </div>
      </div>
      <div className="shrink-0 border-t bg-white p-3">
        <Button onClick={mulai} disabled={!barakId} className="h-12 w-full bg-forest text-[13px] font-bold hover:bg-forest-deep">
          <Camera className="mr-1.5 h-4 w-4" /> Mulai Pemeriksaan — 27 Item
        </Button>
      </div>
    </div>
  );
}

// ============ FORM PERIKSA ============
export function InspectScreen() {
  const store = useStore();
  const { session, master, draft, setMobileScreen, discardDraft } = store;
  const qc = useQueryClient();
  const refresh = useRefresh();
  const [menyimpan, setMenyimpan] = useState(false);
  const [menandai, setMenandai] = useState(false);
  const refItem = useRef<Record<string, HTMLButtonElement | null>>({});

  const barak = master?.baraks.find((b) => b.id === draft.barakId) ?? null;
  const afdNama = barak ? namaAfdeling(barak.afdelingId) : "";
  const results = (master?.checklist ?? []).map((it) => ({
    itemId: it.id,
    status: draft.results[it.id]?.status ?? null,
    catatan: draft.results[it.id]?.catatan || "",
    fotos: draft.results[it.id]?.fotos ?? [],
  }));
  const dinilai = results.filter((r) => r.status !== null).length;
  const hijau = results.filter((r) => r.status === "H").length;
  const merah = results.filter((r) => r.status === "M").length;

  // Item berikutnya: setelah item terakhir dinilai → lanjut ke item DI BAWAHNYA
  // (bukan kembali ke paling atas); sisa di atas baru diambil setelah bawah habis.
  const itemBerikutnya = (() => {
    const urut = master?.checklist ?? [];
    const dinilaiMap = new Map(results.map((r) => [r.itemId, r.status]));
    const mulai = draft.lastGradedId ? urut.findIndex((c) => c.id === draft.lastGradedId) + 1 : 0;
    for (let i = mulai; i < urut.length; i++) if (dinilaiMap.get(urut[i].id) === null) return urut[i];
    for (let i = 0; i < mulai; i++) if (dinilaiMap.get(urut[i].id) === null) return urut[i];
    return null;
  })();
  const kartuTarget = itemBerikutnya?.kartu ?? "KMS-01";

  // Saat layar terbuka (atau kembali dari item), buka kartu & arahkan tampilan
  // ke item berikutnya yang belum dinilai.
  const [kartuTerbuka, setKartuTerbuka] = useState<string[]>([kartuTarget]);
  useEffect(() => {
    if (!itemBerikutnya) return;
    setKartuTerbuka((p) => (p.includes(itemBerikutnya.kartu) ? p : [...p, itemBerikutnya.kartu]));
    const t = setTimeout(() => {
      refItem.current[itemBerikutnya.id]?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 150);
    return () => clearTimeout(t);
  }, []);

  // Perumahan hilang dari draft → kembali ke peta
  useEffect(() => {
    if (session && master && !barak) setMobileScreen("peta");
  }, [session, master, barak, setMobileScreen]);

  if (!session || !master || !barak) return null;

  // ---------- TAG KOORDINAT REAL (GPS perangkat, 1x per pemeriksaan rumah) ----------
  // Tanpa estimasi/acakan: GPS gagal → error jelas + tombol coba lagi.
  // Di APK dialog izin lokasi muncul di sini (izin diminta eksplisit oleh
  // lokasiSaatIni → checkPermissions/requestPermissions).
  const tagKoordinat = async () => {
    setMenandai(true);
    try {
      const lok = await lokasiSaatIni();
      store.setDraftGps(lok);
      toast.success(`Koordinat GPS asli ditag — akurasi ±${lok.acc.toFixed(1)} m. Berlaku untuk semua item rumah ini.`);
      if (lok.acc > 30) {
        toast.warning("Akurasi rendah (>30 m) — pindah ke tempat terbuka, lalu tag ulang bila perlu.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMenandai(false);
    }
  };

  const simpan = async () => {
    if (dinilai === 0) {
      toast.error("Belum ada item yang dinilai");
      return;
    }
    if (!draft.gps) {
      toast.error("Tag koordinat pemeriksaan dulu — cukup 1 kali di depan rumah");
      return;
    }
    setMenyimpan(true);
    try {
      // OFFLINE-FIRST: POST /api/inspeksi otomatis disimpan di antrean perangkat
      // (balasan sintetis offline:true) — TIDAK menunggu server. Pengiriman
      // nyata ke server lewat tombol "Sinkron Sekarang" (Beranda/Profil) atau
      // otomatis saat login/buka aplikasi. Tidak ada lagi error 500 saat simpan.
      const res = await api.post<{ inspeksi: { kode: string }; temuanDibuat: number; offline?: boolean }>("/api/inspeksi", {
        barakId: barak.id,
        picLabel: draft.picLabel,
        lat: draft.gps.lat,
        lng: draft.gps.lng,
        results,
        temuan: draft.temuan,
      });
      qc.invalidateQueries({ queryKey: qk.inspeksi });
      qc.invalidateQueries({ queryKey: qk.temuan });
      refresh();
      discardDraft();
      if (res.offline) {
        toast.success(`Aman di perangkat sebagai ${res.inspeksi.kode}${res.temuanDibuat ? ` • ${res.temuanDibuat} temuan dicatat` : ""} — kirim lewat "Sinkron Sekarang" di Beranda/Profil`);
      } else {
        toast.success(`Tersimpan ke server sebagai ${res.inspeksi.kode}${res.temuanDibuat ? ` • ${res.temuanDibuat} temuan dibuat` : ""}`);
      }
      setMobileScreen("peta"); // kembali ke peta untuk memeriksa perumahan berikutnya
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        title="Pemeriksaan Baru"
        sub={`${namaBarakSingkat(namaBarak(barak.id), afdNama)} • ${master.kebuns.find((k) => k.id === master.afdelings.find((a) => a.id === barak.afdelingId)?.kebunId)?.nama ?? "-"} / ${afdNama}`}
        onBack={() => { discardDraft(); setMobileScreen("peta"); }}
        right={<span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-bold">DRAFT</span>}
      />
      <div className="flex-1 overflow-y-auto thin-scroll p-3">
        {/* TAG KOORDINAT — wajib sebelum simpan; cukup 1x per rumah */}
        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500">KOORDINAT PEMERIKSAAN (TAG 1x)</p>
            {draft.gps && <span className="rounded bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-700">SUDAH DITAG</span>}
          </div>
          {draft.gps ? (
            <>
              <p className="mt-1 font-mono text-[12px] text-slate-700">{fmtKoor(draft.gps.lat, draft.gps.lng)}</p>
              <p className="text-[10px] text-slate-400">Akurasi ± {draft.gps.acc.toFixed(1)} m • ditag sekali untuk seluruh item &amp; foto rumah ini</p>
              {/* RE-TAGGING: ulangi pengambilan GPS bila akurasi rendah (di dalam gedung/
                  di bawah atap) — koordinat lama diganti dengan yang lebih presisi. */}
              <Button onClick={tagKoordinat} disabled={menandai} variant="outline" className="mt-2 h-9 w-full border-dashed text-[11px] text-forest hover:bg-forest-soft">
                {menandai ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Crosshair className="mr-1.5 h-3.5 w-3.5" />}
                {menandai ? "Mengambil koordinat baru..." : "Tag Ulang Koordinat (perbaiki akurasi)"}
              </Button>
            </>
          ) : (
            <>
              <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">Tekan tombol saat Anda berada di perumahan. Koordinat diambil <b>1 kali</b> per pemeriksaan rumah — bukan dari koordinat foto.</p>
              <Button onClick={tagKoordinat} disabled={menandai} className="mt-2 h-10 w-full bg-forest text-[12px] font-bold hover:bg-forest-deep">
                {menandai ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Crosshair className="mr-1.5 h-4 w-4" />}
                {menandai ? "Menandai koordinat..." : "Tag Koordinat Sekarang"}
              </Button>
            </>
          )}
        </div>

        <div className="mt-3 rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Progres penilaian</span>
            <span className="font-bold text-forest">{dinilai}/27 item</span>
          </div>
          <Progress value={(dinilai / 27) * 100} className="mt-2 h-2" />
          <div className="mt-2 flex gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> {hijau} layak</span>
            <span className="flex items-center gap-1 text-red-600"><X className="h-3.5 w-3.5" /> {merah} tidak layak</span>
            <span className="ml-auto text-slate-400">Auditor: {session.nama}</span>
          </div>
          {draft.temuan.length > 0 && (
            <p className="mt-2 flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700"><Flag className="h-3 w-3" /> {draft.temuan.length} temuan akan dibuat saat disimpan</p>
          )}
          {itemBerikutnya && dinilai > 0 && (
            <p className="mt-2 border-t pt-2 text-[10px] text-slate-400">Berikutnya: <b className="text-forest">{itemBerikutnya.id}</b> — {itemBerikutnya.label}</p>
          )}
        </div>

        <Accordion type="multiple" value={kartuTerbuka} onValueChange={(v) => setKartuTerbuka(v as string[])} className="mt-3 space-y-2">
          {master.kartu.map((k) => {
            const items = master.checklist.filter((c) => c.kartu === k.id);
            const nilai = results.filter((r) => items.some((it) => it.id === r.itemId) && r.status !== null);
            const merahKartu = results.filter((r) => items.some((it) => it.id === r.itemId) && r.status === "M");
            return (
              <AccordionItem key={k.id} value={k.id} className="rounded-xl border bg-white px-3">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex items-center gap-2 text-left">
                    <span className="text-[12px] font-bold text-slate-700">{k.nama}</span>
                    <span className="ml-auto mr-2 flex items-center gap-1">
                      {merahKartu.length > 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">{merahKartu.length} M</span>}
                      <span className="text-[10px] text-slate-400">{nilai.length}/{items.length}</span>
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <div className="divide-y">
                    {items.map((it) => {
                      const r = results.find((x) => x.itemId === it.id);
                      return (
                        <button
                          key={it.id}
                          ref={(el) => { refItem.current[it.id] = el; }}
                          onClick={() => { store.setActiveItem(it.id); setMobileScreen("inspect-item"); }}
                          className="flex w-full items-center gap-2 py-2.5 text-left hover:bg-slate-50"
                        >
                          <span className="text-[11px] text-slate-400">{it.id}</span>
                          <span className="flex-1 text-[12px] font-medium text-slate-700">{it.label}</span>
                          {r && r.fotos.length > 0 && <span className="text-[10px] text-forest">{r.fotos.length} foto</span>}
                          {r?.catatan ? <span className="h-1.5 w-1.5 rounded-full bg-gold" title="Ada catatan" /> : null}
                          <ChipStatus s={r?.status ?? "-"} />
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
      <div className="shrink-0 space-y-1.5 border-t bg-white p-3">
        <Button onClick={simpan} disabled={menyimpan} className="h-11 w-full bg-forest text-[12px] font-bold hover:bg-forest-deep">
          {menyimpan ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {menyimpan ? "Menyimpan..." : "Simpan Pemeriksaan"}
        </Button>
        <p className="text-center text-[10px] leading-relaxed text-slate-400">Data langsung AMAN di perangkat (tanpa menunggu server) — terkirim lewat tombol "Sinkron Sekarang" di Beranda/Profil atau otomatis saat online</p>
      </div>
    </div>
  );
}

// ============ DETAIL ITEM ============
export function InspectItemScreen() {
  const store = useStore();
  const { session, master, draft, activeItemId, setMobileScreen, setActiveItem, setActiveFinding, setDraftStatus, setDraftNote, addDraftFoto, removeDraftFoto, addDraftTemuan } = store;
  const [level, setLevel] = useState<1 | 2 | 3 | 4>(1);
  const [uraian, setUraian] = useState("");
  const [mitigasi, setMitigasi] = useState("");
  const [noWO, setNoWO] = useState("");
  // Kamera bawaan aplikasi: overlay getUserMedia — judul/sub dipakai untuk watermark foto
  const [kamera, setKamera] = useState<{ judul: string; sub: string } | null>(null);

  if (!session || !master) return null;
  const item = master.checklist.find((c) => c.id === activeItemId);
  const barak = master.baraks.find((b) => b.id === draft.barakId);
  if (!item || !barak) {
    setMobileScreen("inspect");
    return null;
  }
  const r = draft.results[item.id];
  const kartu = master.kartu.find((k) => k.id === item.kartu);
  const temuanAda = draft.temuan.find((t) => t.itemId === item.id);
  const matriks = master.matriks;

  // Koordinat = hasil TAGGING sekali di depan rumah (draft.gps) — bukan dari foto.
  const koordinat = draft.gps ?? (barak.koordinat ? { lat: barak.koordinat.lat, lng: barak.koordinat.lng, acc: 5 } : null);

  // FOTO ASLI dari KAMERA BAWAAN APLIKASI (overlay getUserMedia) —
  // dikompres + watermark koordinat tag & waktu. Tidak lagi membuka
  // aplikasi kamera eksternal HP.
  const bukaKamera = () => {
    // Judul foto pakai NAMA KARTU (mis. "Hunian") — bukan kode internal "KMS-xx".
    setKamera({
      judul: `${kartu?.singkat ?? kartu?.nama ?? "Kartu"} • ${item.id} ${item.label}`,
      sub: `${namaBarakSingkat(namaBarak(barak.id), namaAfdeling(barak.afdelingId))} • ${fmtKoor(koordinat?.lat, koordinat?.lng)} • ${new Date().toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`,
    });
  };

  const simpanFoto = (dataUrl: string) => {
    addDraftFoto(item.id, { id: `f-${Date.now()}`, dataUrl, lat: koordinat?.lat ?? 0, lng: koordinat?.lng ?? 0, timestamp: new Date().toISOString(), label: item.label });
    setKamera(null);
    toast.success("Foto kamera bawaan aplikasi tersimpan dengan watermark koordinat tag & waktu");
  };

  const catatTemuan = () => {
    const isi = uraian.trim() || (r?.catatan ?? "").trim();
    if (!isi) {
      toast.error("Uraian temuan wajib diisi");
      return;
    }
    const lvl = matriks.find((a) => a.level === level)!;
    const t: DraftTemuan = {
      itemId: item.id,
      uraian: isi,
      level,
      mitigasiDarurat: level >= 3 ? mitigasi.trim() || undefined : undefined,
      noWO: noWO.trim() || undefined,
    };
    addDraftTemuan(t);
    toast.success(`Temuan dicatat — ${lvl.jalur}, Final approval: ${lvl.final}. Temuan terkirim ke server saat pemeriksaan disimpan.`);
    setMobileScreen("inspect");
  };

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        title={`${item.id} — ${item.label}`}
        sub={kartu?.nama ?? ""}
        onBack={() => { setActiveItem(null); setMobileScreen("inspect"); }}
        right={<span className="rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-bold">{kartu?.singkat}</span>}
      />
      <div className="flex-1 space-y-3 overflow-y-auto thin-scroll p-3">
        <div className="rounded-xl border border-dashed border-forest/40 bg-forest-soft p-3">
          <p className="text-[10px] font-bold text-forest">STANDAR LAYAK (HIJAU)</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{item.standar}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { setDraftStatus(item.id, "H"); toast.success("Item dinilai LAYAK (Hijau)"); }} className={cn("rounded-xl border-2 p-3 text-center transition", r?.status === "H" ? "border-green-600 bg-green-50" : "border-slate-200 bg-white hover:border-green-400")}>
            <CheckCircle2 className={cn("mx-auto h-6 w-6", r?.status === "H" ? "text-green-600" : "text-slate-300")} />
            <p className={cn("mt-1 text-[12px] font-bold", r?.status === "H" ? "text-green-700" : "text-slate-500")}>HIJAU — Layak</p>
          </button>
          <button onClick={() => setDraftStatus(item.id, "M")} className={cn("rounded-xl border-2 p-3 text-center transition", r?.status === "M" ? "border-red-600 bg-red-50" : "border-slate-200 bg-white hover:border-red-400")}>
            <X className={cn("mx-auto h-6 w-6", r?.status === "M" ? "text-red-600" : "text-slate-300")} />
            <p className={cn("mt-1 text-[12px] font-bold", r?.status === "M" ? "text-red-700" : "text-slate-500")}>MERAH — Tidak Layak</p>
          </button>
        </div>

        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500">KOORDINAT PEMERIKSAAN (TAG 1x)</p>
            {draft.gps ? <span className="rounded bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-700">TERKUNCI</span> : <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">BELUM DITAG</span>}
          </div>
          <p className="mt-1 font-mono text-[12px] text-slate-700">{fmtKoor(koordinat?.lat, koordinat?.lng)}</p>
          <p className="text-[10px] text-slate-400">Ditag sekali di depan rumah — otomatis menempel pada setiap foto (bukan koordinat foto)</p>
        </div>

        <div className="rounded-xl border bg-white p-3">
          <p className="text-[10px] font-bold text-slate-500">FOTO PEMERIKSAAN (WAJIB UNTUK STATUS MERAH)</p>
          <Button onClick={bukaKamera} variant="outline" className="mt-2 h-10 w-full border-dashed text-[12px] text-forest">
            <Camera className="mr-1.5 h-4 w-4" />
            Ambil Foto (Kamera Bawaan Aplikasi)
          </Button>
          {r?.fotos.length ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {r.fotos.map((f) => (
                <div key={f.id} className="group relative">
                  <img src={f.dataUrl} alt={`Foto ${item.label}`} className="h-20 w-full rounded-lg border object-cover" />
                  <button onClick={() => removeDraftFoto(item.id, f.id)} aria-label="Hapus foto" className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-1 text-white"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400"><ImageOff className="h-3 w-3" /> Belum ada foto pada item ini</p>
          )}
        </div>

        <div className="rounded-xl border bg-white p-3">
          <Label className="text-[10px] font-bold text-slate-500">CATATAN AUDITOR</Label>
          <Textarea value={r?.catatan ?? ""} onChange={(e) => setDraftNote(item.id, e.target.value)} placeholder="Kondisi lapangan, lokasi detail di perumahan, kebutuhan material..." className="mt-1.5 min-h-[70px] text-[12px]" />
        </div>

        {r?.status === "M" && (
          <div className="rounded-xl border-2 border-red-200 bg-red-50/60 p-3">
            {temuanAda ? (
              <div className="flex w-full items-center gap-2 rounded-lg bg-white p-2.5">
                <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
                <span className="text-[11px] text-slate-700">Temuan <b>Level {temuanAda.level}</b> sudah dicatat untuk item ini — akan dibuat saat disimpan</span>
              </div>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-red-700"><Flag className="h-4 w-4" /> CATAT TEMUAN & TETAPKAN JALUR APPROVAL (WAJIB)</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {matriks.map((a) => (
                    <button key={a.level} onClick={() => setLevel(a.level)} className={cn("rounded-lg border p-2 text-left", level === a.level ? "border-forest bg-forest-soft" : "border-slate-200 bg-white")}>
                      <span className="text-[11px] font-bold text-forest">Lv.{a.level}</span>
                      <p className="text-[9.5px] leading-tight text-slate-600">{a.jalur}</p>
                      <p className="text-[9px] text-slate-400">{a.sla.split("(")[0]}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  <Label className="text-[10px] font-bold text-slate-500">URAIAN TEMUAN</Label>
                  <Textarea value={uraian || r?.catatan || ""} onChange={(e) => setUraian(e.target.value)} placeholder="Jelaskan temuan, dampak, dan lokasi detail..." className="mt-1 min-h-[64px] bg-white text-[12px]" />
                </div>
                {level >= 3 && (
                  <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2">
                    <p className="text-[10px] font-bold text-amber-700">MITIGASI DARURAT (WAJIB — Langkah 2 Guideline)</p>
                    <Textarea value={mitigasi} onChange={(e) => setMitigasi(e.target.value)} placeholder="Tindakan sementara hari itu juga: suplai air tangki, pasang terpal, genset cadangan..." className="mt-1 min-h-[54px] bg-white text-[11px]" />
                    <Label className="mt-1.5 block text-[10px] font-bold text-slate-500">NO. WO / RAB (opsional)</Label>
                    <input value={noWO} onChange={(e) => setNoWO(e.target.value)} placeholder="contoh: WO-014" className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-[11px]" />
                  </div>
                )}
                <Button onClick={catatTemuan} className="mt-2 h-10 w-full bg-red-600 text-[12px] font-bold hover:bg-red-700">
                  <Flag className="mr-1.5 h-4 w-4" /> Catat Temuan — Kartu Kamishibai Dibalik ke MERAH
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      {/* Overlay kamera bawaan aplikasi (getUserMedia) — menutupi seluruh layar */}
      {kamera && <KameraBawaan judul={kamera.judul} sub={kamera.sub} onHasil={simpanFoto} onTutup={() => setKamera(null)} />}
    </div>
  );
}
