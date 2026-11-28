"use client";
import { useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useStore, namaAfdeling } from "@/lib/store";
import { useInspeksi, useTemuan } from "@/lib/queries";
import { fmtTanggal } from "@/lib/utils-rl";
import { lokasiSaatIni } from "@/lib/perangkat";
import { Button } from "@/components/ui/button";
import { Loader2, LocateFixed } from "lucide-react";
import { toast } from "sonner";

/** Kontrol di dalam peta: tombol "Lokasi Saya" — ambil GPS ASLI perangkat,
 *  tampilkan titik biru posisi pengguna & geser peta ke situ.
 *  (GPS gagal → pesan jelas; TANPA koordinat acak.) */
function LokasiSaya() {
  const map = useMap();
  const [posisi, setPosisi] = useState<[number, number] | null>(null);
  const [mencari, setMencari] = useState(false);

  const cari = async () => {
    setMencari(true);
    try {
      const lok = await lokasiSaatIni();
      setPosisi([lok.lat, lok.lng]);
      map.flyTo([lok.lat, lok.lng], Math.max(map.getZoom(), 16), { duration: 0.9 });
      toast.success(`Lokasi perangkat ditemukan (±${lok.acc.toFixed(0)} m) — titik biru di peta`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMencari(false);
    }
  };

  return (
    <>
      {posisi && (
        <CircleMarker
          center={posisi}
          radius={9}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2563EB", fillOpacity: 1 }}
        >
          <Popup>
            <p className="text-[13px] font-bold text-slate-800">Posisi Perangkat Anda</p>
            <p className="text-[12px] text-slate-500">GPS asli perangkat — bukan koordinat perumahan.</p>
          </Popup>
        </CircleMarker>
      )}
      <div className="leaflet-top leaflet-right">
        <div className="leaflet-control leaflet-bar" style={{ margin: "10px 10px 0 0" }}>
          <button
            onClick={cari}
            disabled={mencari}
            aria-label="Tampilkan lokasi perangkat"
            title="Tampilkan lokasi perangkat (GPS)"
            style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", cursor: "pointer" }}
          >
            {mencari ? (
              <Loader2 className="h-4 w-4 animate-spin text-forest" />
            ) : (
              <LocateFixed className={`h-4 w-4 ${posisi ? "text-[#2563EB]" : "text-forest"}`} />
            )}
          </button>
        </div>
      </div>
    </>
  );
}

/** Peta blok/perumahan milik kebun pengguna — pola aplikasi cek blok:
 *  tap titik di peta -> mulai pemeriksaan perumahan tersebut.
 *  Tombol "Lokasi Saya" (kanan-atas peta) menampilkan posisi GPS perangkat. */
export function PetaMobileKlien() {
  const { master, session, setInspectPreselect, setMobileScreen } = useStore();
  const { data: inspections = [] } = useInspeksi(true);
  const { data: findings = [] } = useTemuan(true);
  const auditor = session?.role === "AUDITOR";

  // Hanya perumahan yang punya koordinat yang bisa digambar di peta
  const baraks = (master?.baraks ?? []).filter(
    (b): b is NonNullable<typeof b> & { koordinat: { lat: number; lng: number } } => b.koordinat !== null,
  );
  const pusat = baraks.length ? [baraks[0].koordinat.lat, baraks[0].koordinat.lng] : [-0.052, 109.322];

  const mulai = (afdelingId: string, barakId: string) => {
    setInspectPreselect({ afdelingId, barakId });
    setMobileScreen("inspect-new");
  };

  return (
    <MapContainer center={pusat as [number, number]} zoom={14} scrollWheelZoom className="h-[280px] w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LokasiSaya />
      {baraks.map((b) => {
        const audits = inspections
          .filter((i) => i.barakId === b.id && i.results.some((r) => r.status !== null))
          .sort((a, z) => z.tanggal.localeCompare(a.tanggal));
        const last = audits[0];
        const status = last ? (last.results.some((r) => r.status === "M") ? "M" : "H") : "N";
        const tndAktif = findings.filter((f) => f.barakId === b.id && f.status !== "CLOSED").length;
        const warna = status === "H" ? "#1F7A41" : status === "M" ? "#D93025" : "#94a3b8";
        const ikon = L.divIcon({
          className: "",
          html: `<div class="rl-pin" style="background:${warna}">${status === "N" ? "?" : status}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        return (
          <Marker key={b.id} position={[b.koordinat.lat, b.koordinat.lng]} icon={ikon}>
            <Popup>
              <div className="min-w-[210px]">
                <p className="text-[14px] font-bold text-slate-800">{b.nama}</p>
                <p className="text-[12px] text-slate-500">{namaAfdeling(b.afdelingId)} • {b.tipe}</p>
                <p className="text-[12px] text-slate-500">Kapasitas {b.kapasitas} orang</p>
                {last ? (
                  <p className="mt-1 text-[12px] text-slate-700">
                    Audit terakhir <b>{last.kode}</b> ({fmtTanggal(last.tanggal)}) —{" "}
                    <b style={{ color: status === "M" ? "#D93025" : "#1F7A41" }}>{status === "M" ? "MERAH" : "HIJAU"}</b>
                    {tndAktif > 0 ? ` • ${tndAktif} temuan aktif` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-[12px] italic text-slate-500">Belum pernah diaudit</p>
                )}
                {auditor ? (
                  <Button onClick={() => mulai(b.afdelingId, b.id)} className="mt-2 h-8 w-full bg-forest text-[12px] hover:bg-forest-deep">
                    Mulai Pemeriksaan Perumahan Ini
                  </Button>
                ) : (
                  <p className="mt-2 rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">Hanya AUDITOR yang memulai pemeriksaan</p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

// Ekspor loader agar tidak memicu bundling Leaflet di server
export const PetaMobileKlienDefault = Loader2;
