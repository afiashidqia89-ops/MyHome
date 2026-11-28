"use client";
// ============================================================
// RumahLayak — KAMERA BAWAAN APLIKASI (overlay penuh, getUserMedia)
//
// Menggantikan pembukaan aplikasi kamera eksternal: pratinjau langsung
// (video penuh layar) berada DI DALAM aplikasi, dengan tombol jepret,
// ganti kamera depan/belakang, pratinjau hasil + ulangi, dan watermark
// koordinat & waktu yang ditempel otomatis.
//
// Di APK: WebView meminta izin CAMERA lewat Capacitor (dialog sistem
// muncul otomatis, syarat izin terdeklarasi — scripts/apk/terapkan-izin.mjs).
// Di browser: prompt izin kamera bawaan browser.
// Bila getUserMedia tidak tersedia → tombol cadangan memakai
// <input capture> (kamera eksternal) agar fitur tetap berjalan.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilFotoDenganWatermark,
  beriWatermark,
  bukaStreamKamera,
  matikanStream,
  tangkapFrame,
  type Menghadap,
} from "@/lib/perangkat";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, Check, Loader2, RefreshCw, SwitchCamera, X } from "lucide-react";

type Tahap = "menyiapkan" | "langsung" | "pratinjau" | "gagal";

interface KameraBawaanProps {
  /** Baris watermark 1 — mis. "KMS-01 • R-01 Atap". */
  judul: string;
  /** Baris watermark 2 — barak, koordinat tag, waktu. */
  sub: string;
  /** Dipanggil dengan dataURL foto final (terkompres + watermark). */
  onHasil: (dataUrl: string) => void;
  onTutup: () => void;
}

export function KameraBawaan({ judul, sub, onHasil, onTutup }: KameraBawaanProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [menghadap, setMenghadap] = useState<Menghadap>("environment");
  const [percobaan, setPercobaan] = useState(0); // naik → buka ulang kamera
  const [tahap, setTahap] = useState<Tahap>("menyiapkan");
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [alasan, setAlasan] = useState("");

  const hentikan = useCallback(() => {
    matikanStream(streamRef.current);
    streamRef.current = null;
  }, []);

  // Buka kamera tiap masuk overlay, ganti kamera, atau ulangi jepret.
  // Tahap "menyiapkan" diatur di handler ulangi/gantiKamera — state awal
  // memang sudah "menyiapkan", jadi effect tidak memanggil setState sinkron.
  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const s = await bukaStreamKamera(menghadap);
        if (batal) {
          matikanStream(s);
          return;
        }
        streamRef.current = s;
        const v = videoRef.current;
        if (v) {
          v.srcObject = s;
          await v.play().catch(() => { /* autoplay diblokir — ketuk layar video untuk memulai */ });
        }
        if (!batal) setTahap("langsung");
      } catch (e) {
        if (batal) return;
        const pesan = (e as Error)?.message ?? "Kamera tidak dapat dibuka";
        setAlasan(/TidakDidukung/i.test(pesan) ? "Perangkat/WebView ini tidak mendukung kamera di dalam aplikasi." : pesan);
        setTahap("gagal");
      }
    })();
    return () => {
      batal = true;
      hentikan();
    };
  }, [menghadap, percobaan, hentikan]);

  const jepret = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      toast.error("Kamera belum siap — tunggu pratinjau tampil lalu jepret.");
      return;
    }
    try {
      const kanvas = tangkapFrame(v);
      setPratinjau(beriWatermark(kanvas, judul, sub));
      setTahap("pratinjau");
      hentikan(); // matikan sensor saat melihat pratinjau (hemat baterai)
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const ulangi = () => {
    setPratinjau(null);
    setTahap("menyiapkan");
    setPercobaan((p) => p + 1);
  };

  const pakai = () => {
    if (!pratinjau) return;
    onHasil(pratinjau);
    onTutup();
  };

  const gantiKamera = () => {
    setTahap("menyiapkan");
    setMenghadap((m) => (m === "environment" ? "user" : "environment"));
  };

  // Cadangan: kamera eksternal lewat <input capture> (bila getUserMedia gagal)
  const bukaKameraPerangkat = async () => {
    try {
      const dataUrl = await ambilFotoDenganWatermark(judul, sub);
      onHasil(dataUrl);
      onTutup();
    } catch (e) {
      const pesan = (e as Error).message;
      if (!/dibatalkan/i.test(pesan)) toast.error(pesan);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Bilah atas */}
      <div className="flex shrink-0 items-center gap-2 bg-black/80 px-4 py-2.5">
        <Camera className="h-4 w-4 text-gold" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight">Kamera RumahLayak</p>
          <p className="truncate text-[10.5px] text-white/60">{judul}</p>
        </div>
        <button onClick={onTutup} aria-label="Tutup kamera" className="rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Area video / pratinjau */}
      <div className="relative min-h-0 flex-1 bg-black">
        {tahap === "pratinjau" && pratinjau ? (
          <img src={pratinjau} alt="Pratinjau foto" className="h-full w-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onClick={(e) => void e.currentTarget.play()}
            className={tahap === "langsung" ? "h-full w-full object-cover" : "h-full w-full object-cover opacity-0"}
          />
        )}

        {tahap === "menyiapkan" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-white/70" />
            <p className="text-[12px] text-white/70">Menyiapkan kamera...</p>
          </div>
        )}

        {tahap === "gagal" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-center">
            <Camera className="h-10 w-10 text-white/30" />
            <p className="text-[14px] font-bold">Kamera bawaan tidak dapat dibuka</p>
            <p className="text-[12px] leading-relaxed text-white/60">{alasan}</p>
            <Button variant="outline" onClick={() => void bukaKameraPerangkat()} className="mt-1 h-10 border-white/30 bg-transparent text-[13px] text-white hover:bg-white/10">
              <Camera className="mr-1.5 h-4 w-4" /> Buka Kamera Perangkat (cadangan)
            </Button>
            <Button variant="ghost" onClick={onTutup} className="h-9 text-[13px] text-white/70">
              Tutup
            </Button>
          </div>
        )}
      </div>

      {/* Bilah kendali */}
      <div className="shrink-0 bg-black px-6 pb-7 pt-4">
        {tahap === "pratinjau" && pratinjau ? (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={ulangi} className="h-12 flex-1 border-white/30 bg-transparent text-[13.5px] font-bold text-white hover:bg-white/10">
              <RefreshCw className="mr-1.5 h-4 w-4" /> Ulangi
            </Button>
            <Button onClick={pakai} className="h-12 flex-1 bg-forest text-[13.5px] font-bold hover:bg-forest-deep">
              <Check className="mr-1.5 h-4 w-4" /> Pakai Foto
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button onClick={gantiKamera} disabled={tahap !== "langsung"} aria-label="Ganti kamera depan/belakang" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-30">
              <SwitchCamera className="h-5 w-5" />
            </button>
            <button
              onClick={jepret}
              disabled={tahap !== "langsung"}
              aria-label="Jepret foto"
              className="h-16 w-16 rounded-full border-4 border-white bg-white transition active:scale-90 disabled:border-white/40 disabled:bg-white/30"
            />
            {/* Spacer agar tombol jepret tepat di tengah */}
            <span className="h-11 w-11" />
          </div>
        )}
        <p className="mt-3 text-center text-[10.5px] leading-relaxed text-white/40">
          Foto dikompres & diberi watermark otomatis: {sub}
        </p>
      </div>
    </div>
  );
}
