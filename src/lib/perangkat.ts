"use client";
// ============================================================
// RumahLayak — Helper PERANGKAT REAL (bukan simulasi)
//
// 1. lokasiSaatIni()   → GPS ASLI. Di APK izin lokasi DIMINTA
//    EKSPLISIT lebih dulu (checkPermissions → requestPermissions)
//    sehingga dialog izin Android pasti muncul; di browser
//    navigator.geolocation memunculkan prompt bawaan Chrome.
//    TANPA koordinat buatan/acak — gagal = error jelas.
// 2. KAMERA BAWAAN APLIKASI: bukaStreamKamera() + tangkapFrame()
//    memakai getUserMedia DI DALAM aplikasi (overlay KameraBawaan)
//    — tidak lagi membuka aplikasi kamera eksternal. Di APK,
//    Capacitor otomatis memunculkan dialog izin kamera saat WebView
//    meminta VIDEO_CAPTURE (syarat: izin CAMERA terdeklarasi di
//    AndroidManifest — dipatch oleh scripts/apk/terapkan-izin.mjs).
//    ambilFotoDenganWatermark() (<input capture>) hanya jadi
//    cadangan bila getUserMedia tidak tersedia.
//    Foto selalu dikompres (sisi 1024 px, JPEG q0.72) + band
//    watermark identitas + koordinat tag + waktu. TANPA gambar buatan.
// ============================================================

import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export interface Lokasi {
  lat: number;
  lng: number;
  acc: number; // akurasi dalam meter
}

/** True bila berjalan di APK Capacitor (bukan browser).
 *  PENTING: jangan pakai "Capacitor" in window — @capacitor/core
 *  juga mendefinisikan window.Capacitor di browser, sehingga cek itu
 *  selalu true dan portal web ikut tampil seperti mobile. */
export function diApk(): boolean {
  return Capacitor.isNativePlatform();
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

/** Minta izin lokasi SECARA EKSPLISIT di APK — dialog izin sistem muncul
 *  di sini bila belum diizinkan (syarat: izin ACCESS_FINE/COARSE_LOCATION
 *  terdeklarasi di AndroidManifest — dipatch oleh terapkan-izin.mjs).
 *  Di browser dilewati: prompt muncul otomatis saat getCurrentPosition. */
async function pastikanIzinLokasi(): Promise<void> {
  if (!diApk()) return;
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location === "granted" || status.coarseLocation === "granted") return;
    const minta = await Geolocation.requestPermissions({
      permissions: ["location", "coarseLocation"],
    });
    const diizinkan = minta.location === "granted" || minta.coarseLocation === "granted";
    if (!diizinkan) throw new Error("denied");
  } catch (e) {
    const teks = String((e as Error)?.message ?? e ?? "");
    if (/denied|ditolak/i.test(teks)) {
      throw new Error("Izin lokasi ditolak — buka Pengaturan HP → Aplikasi → RumahLayak → izinkan Lokasi.");
    }
    throw e; // kegagalan lain biarkan muncul apa adanya
  }
}

/** Ambil koordinat GPS ASLI perangkat (high accuracy). Gagal → lempar error (tidak ada koordinat palsu). */
export async function lokasiSaatIni(batasWaktuMs = 15_000): Promise<Lokasi> {
  await pastikanIzinLokasi(); // dialog izin muncul di sini bila belum diizinkan
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

// ---------------- KAMERA BAWAAN APLIKASI (getUserMedia) ----------------

export type Menghadap = "environment" | "user";

/** Kamera in-app tersedia di lingkungan ini? (WebView modern & browser ya). */
export function kameraTersedia(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/** Buka aliran kamera DI DALAM aplikasi (getUserMedia).
 *  Di APK Capacitor otomatis memunculkan dialog izin kamera (CAMERA
 *  harus terdeklarasi di AndroidManifest — lihat terapkan-izin.mjs). */
export async function bukaStreamKamera(menghadap: Menghadap): Promise<MediaStream> {
  if (!kameraTersedia()) throw new Error("TidakDidukung");
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: menghadap },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  });
}

/** Matikan semua trek kamera — wajib dipanggil saat menutup overlay. */
export function matikanStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Tangkap frame <video> hidup menjadi kanvas beresolusi penuh video. */
export function tangkapFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const W = video.videoWidth || 1280;
  const H = video.videoHeight || 720;
  const kanvas = document.createElement("canvas");
  kanvas.width = W;
  kanvas.height = H;
  const ctx = kanvas.getContext("2d");
  if (!ctx) throw new Error("Kanvas tidak didukung perangkat.");
  ctx.drawImage(video, 0, 0, W, H);
  return kanvas;
}

/** Kompres kanvas (sisi terpanjang 1024 px) + band watermark bawah → dataURL JPEG. */
export function beriWatermark(sumber: HTMLCanvasElement, judul: string, sub: string): string {
  const lebarSumber = sumber.width;
  const tinggiSumber = sumber.height;
  const sisiMax = Math.max(lebarSumber, tinggiSumber) || 1024;
  const skala = Math.min(1, 1024 / sisiMax);
  const W = Math.max(1, Math.round(lebarSumber * skala));
  const H = Math.max(1, Math.round(tinggiSumber * skala));

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Kanvas tidak didukung perangkat.");
  ctx.drawImage(sumber, 0, 0, W, H);

  // Band watermark di bawah foto (menempel pada foto ASLI, bukan menggantinya).
  // KECIL (permintaan pengguna): ~4,5% tinggi foto (dulu 12% → terlalu besar),
  // tidak menutupi detail lapangan namun tetap terbaca.
  const tinggiBand = Math.max(30, Math.round(H * 0.045));
  ctx.fillStyle = "rgba(6, 20, 13, 0.82)";
  ctx.fillRect(0, H - tinggiBand, W, tinggiBand);
  const fs1 = Math.max(9, Math.round(tinggiBand * 0.30));
  const fs2 = Math.max(8, Math.round(tinggiBand * 0.26));
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${fs1}px Arial`;
  ctx.fillText("RUMAHLAYAK • FOTO AUDIT TERGEOTAG", 10, H - tinggiBand + fs1 + 2);
  ctx.fillStyle = "#d4af37";
  ctx.font = `${fs2}px Arial`;
  const teks = `${judul} | ${sub}`;
  ctx.fillText(teks.length > 80 ? `${teks.slice(0, 79)}…` : teks, 10, H - 5);

  return c.toDataURL("image/jpeg", 0.72);
}

// ---------------- KAMERA CADANGAN (<input capture>) ----------------
// Dipakai hanya bila getUserMedia tidak tersedia (WebView sangat lama).
// Di Android ini membuka aplikasi kamera eksternal — itu sebabnya hanya
// jadi jalan terakhir.

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
 * CADANGAN: foto lewat kamera eksternal (<input capture>) → kompres +
 * band watermark. Utamakan overlay KameraBawaan (getUserMedia) di atas ini.
 */
export async function ambilFotoDenganWatermark(judul: string, sub: string): Promise<string> {
  const file = await pilihFileKamera();
  const bitmap = await muatBitmap(file);
  const lebarSumber = "width" in bitmap ? bitmap.width : 0;
  const tinggiSumber = "height" in bitmap ? bitmap.height : 0;

  const mentah = document.createElement("canvas");
  mentah.width = Math.max(1, lebarSumber);
  mentah.height = Math.max(1, tinggiSumber);
  const ctxMentah = mentah.getContext("2d");
  if (!ctxMentah) throw new Error("Kanvas tidak didukung perangkat.");
  ctxMentah.drawImage(bitmap as CanvasImageSource, 0, 0, mentah.width, mentah.height);

  return beriWatermark(mentah, judul, sub);
}
