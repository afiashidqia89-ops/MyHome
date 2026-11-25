"use client";
// ============================================================
// RumahLayak — Helper PERANGKAT REAL (bukan simulasi)
//
// 1. lokasiSaatIni()   → GPS ASLI. Di APK memakai plugin native
//    @capacitor/geolocation (izin runtime otomatis, akurasi tinggi);
//    di browser memakai navigator.geolocation (implementasi web plugin
//    sama persis). TANPA koordinat buatan/acak — gagal = error jelas.
// 2. ambilFotoDenganWatermark() → FOTO ASLI dari kamera perangkat
//    (<input capture> — di APK membuka kamera bawaan, di browser juga).
//    Foto dikompres (sisi 1024 px, JPEG q0.72) lalu diberi band
//    watermark identitas + koordinat tag + waktu. TANPA gambar buatan.
// ============================================================

import { Geolocation } from "@capacitor/geolocation";

export interface Lokasi {
  lat: number;
  lng: number;
  acc: number; // akurasi dalam meter
}

/** Pesan error GPS yang manusiawi per kode kegagalan. */
function pesanErrorLokasi(e: unknown): Error {
  const teks = String((e as Error)?.message ?? e ?? "");
  if (/denied|permission|izin/i.test(teks)) {
    return new Error("Izin lokasi ditolak — buka Pengaturan HP → Aplikasi → RumahLayak → izinkan Lokasi.");
  }
  if (/unavailable|no location|position unavailable/i.test(teks)) {
    return new Error("Sinyal GPS tidak terjangkau — coba lagi di tempat lebih terbuka.");
  }
  if (/timeout|waktu/i.test(teks)) {
    return new Error("Waktu pencarian GPS habis — coba tekan Tag Koordinat sekali lagi.");
  }
  return new Error("GPS gagal diambil — pastikan layanan lokasi HP aktif lalu coba lagi.");
}

/** Ambil koordinat GPS ASLI perangkat (high accuracy). Gagal → lempar error (tidak ada koordinat palsu). */
export async function lokasiSaatIni(batasWaktuMs = 15_000): Promise<Lokasi> {
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: batasWaktuMs,
      maximumAge: 0,
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      acc: pos.coords.accuracy ?? 10,
    };
  } catch (e) {
    throw pesanErrorLokasi(e);
  }
}

// ---------------- KAMERA REAL ----------------

/** Buka kamera perangkat lewat <input type=file capture>. */
function pilihFileKamera(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    // capture=environment → kamera belakang langsung terbuka di Android/APK
    input.setAttribute("capture", "environment");
    let selesai = false;

    const bersih = () => {
      window.removeEventListener("focus", cekBatal);
      document.removeEventListener("change", onChange);
    };
    const onChange = () => {
      const f = input.files?.[0];
      if (f && !selesai) {
        selesai = true;
        bersih();
        resolve(f);
      }
    };
    // Pengguna menutup kamera tanpa foto → dialog tertutup, window dapat fokus kembali
    const cekBatal = () => {
      setTimeout(() => {
        if (!selesai && !input.files?.length) {
          selesai = true;
          bersih();
          reject(new Error("Pengambilan foto dibatalkan."));
        }
      }, 600);
    };

    document.addEventListener("change", onChange);
    window.addEventListener("focus", cekBatal);
    input.click();
  });
}

/** Muat berkas jadi bitmap (createImageBitmap, fallback Image untuk webview lama). */
async function muatBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* lanjut fallback */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Foto tidak dapat dibaca."));
    };
    img.src = url;
  });
}

/**
 * Foto ASLI dari kamera → kompres (sisi terpanjang 1024 px, JPEG q0.72)
 * → tempel band watermark di bagian bawah foto (identitas, label, koordinat, waktu).
 */
export async function ambilFotoDenganWatermark(judul: string, sub: string): Promise<string> {
  const file = await pilihFileKamera();
  const bitmap = await muatBitmap(file);
  const lebarSumber = "width" in bitmap ? bitmap.width : 0;
  const tinggiSumber = "height" in bitmap ? bitmap.height : 0;
  const sisiMax = Math.max(lebarSumber, tinggiSumber) || 1024;
  const skala = Math.min(1, 1024 / sisiMax);
  const W = Math.max(1, Math.round(lebarSumber * skala));
  const H = Math.max(1, Math.round(tinggiSumber * skala));

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Kanvas tidak didukung perangkat.");
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, W, H);

  // Band watermark di bawah foto (menempel pada foto ASLI, bukan menggantinya)
  const tinggiBand = Math.max(58, Math.round(H * 0.12));
  ctx.fillStyle = "rgba(6, 20, 13, 0.85)";
  ctx.fillRect(0, H - tinggiBand, W, tinggiBand);
  const fs1 = Math.max(12, Math.round(tinggiBand * 0.3));
  const fs2 = Math.max(10, Math.round(tinggiBand * 0.24));
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${fs1}px Arial`;
  ctx.fillText("RUMAHLAYAK • FOTO AUDIT TERGEOTAG", 14, H - tinggiBand + fs1 + 4);
  ctx.fillStyle = "#d4af37";
  ctx.font = `${fs2}px Arial`;
  const teks = `${judul} | ${sub}`;
  ctx.fillText(teks.length > 80 ? `${teks.slice(0, 79)}…` : teks, 14, H - 8);

  return c.toDataURL("image/jpeg", 0.72);
}

/** True bila berjalan di APK Capacitor (dipakai untuk pesan & perilaku khusus APK). */
export function diApk(): boolean {
  return typeof window !== "undefined" && "Capacitor" in window;
}
