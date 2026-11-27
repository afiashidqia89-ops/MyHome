"use client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useStore, namaAfdeling } from "@/lib/store";
import { useInspeksi, useTemuan } from "@/lib/queries";
import { fmtTanggal } from "@/lib/utils-rl";

export function PetaKlien({ filterAfdeling, kebunAktif }: { filterAfdeling: string; kebunAktif: string | null }) {
  const { master } = useStore();
  const { data: inspections = [] } = useInspeksi(true);
  const { data: findings = [] } = useTemuan(true);

  const afdIds = new Set((master?.afdelings ?? []).filter((a) => !kebunAktif || a.kebunId === kebunAktif).map((a) => a.id));
  const dataBarak = (master?.baraks ?? [])
    .filter((b) => afdIds.has(b.afdelingId) && (filterAfdeling === "SEMUA" || b.afdelingId === filterAfdeling))
    .map((b) => {
      const audits = inspections.filter((i) => i.barakId === b.id && i.results.some((r) => r.status !== null)).sort((a, z) => z.tanggal.localeCompare(a.tanggal));
      const last = audits[0];
      let status: "H" | "M" | "N" = "N";
      if (last) status = last.results.some((r) => r.status === "M") ? "M" : "H";
      const tndAktif = findings.filter((f) => f.barakId === b.id && f.status !== "CLOSED");
      const itemM = last ? last.results.filter((r) => r.status === "M").map((r) => master?.checklist.find((c) => c.id === r.itemId)?.label ?? r.itemId) : [];
      const warna = status === "H" ? "#1F7A41" : status === "M" ? "#D93025" : "#94a3b8";
      const ikon = L.divIcon({
        className: "",
        html: `<div class="rl-pin" style="background:${warna}">${status === "N" ? "?" : status}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      return { ...b, last, status, tndAktif, itemM, ikon };
    });

  // Perumahan tanpa koordinat (dikosongkan saat pendaftaran) tidak punya titik di peta
  const bertitik = dataBarak.filter((b): b is typeof b & { koordinat: { lat: number; lng: number } } => b.koordinat !== null);
  const pusat = bertitik.length ? [bertitik[0].koordinat.lat, bertitik[0].koordinat.lng] : [-0.052, 109.322];

  return (
    <MapContainer center={pusat as [number, number]} zoom={14} scrollWheelZoom className="h-[430px] w-full rounded-xl">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {bertitik.map((b) => (
        <Marker key={b.id} position={[b.koordinat.lat, b.koordinat.lng]} icon={b.ikon}>
          <Popup>
            <div className="min-w-[220px]">
              <p className="text-[13px] font-bold text-slate-800">{b.nama}</p>
              <p className="text-[11px] text-slate-500">{b.tipe} • {namaAfdeling(b.afdelingId)} • kapasitas {b.kapasitas} org</p>
              <p className="mt-1 font-mono text-[10px] text-slate-400">{b.koordinat.lat.toFixed(5)}, {b.koordinat.lng.toFixed(5)}</p>
              {b.last ? (
                <div className="mt-1.5 border-t pt-1.5">
                  <p className="text-[11px] text-slate-700"><b>Audit terakhir:</b> {b.last.kode} ({fmtTanggal(b.last.tanggal)}, PIC {b.last.picLabel})</p>
                  <p className="text-[11px] text-slate-700">
                    Status: <b style={{ color: b.status === "M" ? "#D93025" : "#1F7A41" }}>{b.status === "M" ? "MERAH — ada temuan" : "HIJAU — layak"}</b>
                  </p>
                  {b.itemM.length > 0 && <p className="text-[10.5px] text-red-700">Item M: {b.itemM.join(", ")}</p>}
                  <p className="text-[11px] text-slate-700"><b>Temuan aktif:</b> {b.tndAktif.length}</p>
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] italic text-slate-500">Belum pernah diaudit — masuk jadwal Kamishibai</p>
              )}
              <p className="mt-1 text-[9px] text-slate-400">{master?.kartu.length ?? 4} kartu • 27 item per pemeriksaan</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
