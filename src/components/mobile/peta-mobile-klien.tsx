"use client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useStore, namaAfdeling } from "@/lib/store";
import { useInspeksi, useTemuan } from "@/lib/queries";
import { fmtTanggal } from "@/lib/utils-rl";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/** Peta blok/perumahan milik kebun pengguna — pola aplikasi cek blok:
 *  tap titik di peta -> mulai pemeriksaan perumahan tersebut. */
export function PetaMobileKlien() {
  const { master, session, setInspectPreselect, setMobileScreen } = useStore();
  const { data: inspections = [] } = useInspeksi(true);
  const { data: findings = [] } = useTemuan(true);
  const auditor = session?.role === "AUDITOR";

  const baraks = master?.baraks ?? [];
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
                <p className="text-[13px] font-bold text-slate-800">{b.nama}</p>
                <p className="text-[11px] text-slate-500">{namaAfdeling(b.afdelingId)} • {b.tipe}</p>
                <p className="text-[11px] text-slate-500">Kapasitas {b.kapasitas} orang</p>
                {last ? (
                  <p className="mt-1 text-[11px] text-slate-700">
                    Audit terakhir <b>{last.kode}</b> ({fmtTanggal(last.tanggal)}) —{" "}
                    <b style={{ color: status === "M" ? "#D93025" : "#1F7A41" }}>{status === "M" ? "MERAH" : "HIJAU"}</b>
                    {tndAktif > 0 ? ` • ${tndAktif} temuan aktif` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] italic text-slate-500">Belum pernah diaudit</p>
                )}
                {auditor ? (
                  <Button onClick={() => mulai(b.afdelingId, b.id)} className="mt-2 h-8 w-full bg-forest text-[11px] hover:bg-forest-deep">
                    Mulai Pemeriksaan Perumahan Ini
                  </Button>
                ) : (
                  <p className="mt-2 rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-500">Hanya AUDITOR yang memulai pemeriksaan</p>
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
