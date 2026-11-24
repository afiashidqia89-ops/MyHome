import { VERSI_APLIKASI } from "@/lib/version";

export const runtime = "nodejs";

/**
 * Info versi terbaru untuk tombol "Periksa Update" di panel Pengaturan
 * Perangkat (layar login). Versi server bisa dioverride saat rilis baru
 * lewat env RUMAHLAYAK_VERSI_TERBARU dan tautan APK lewat RUMAHLAYAK_URL_APK.
 */
export async function GET() {
  const versi = process.env.RUMAHLAYAK_VERSI_TERBARU || VERSI_APLIKASI;
  const adaUpdate = versi !== VERSI_APLIKASI;
  return Response.json({
    versi,
    terpasang: VERSI_APLIKASI,
    waktu: new Date().toISOString(),
    urlUnduh: process.env.RUMAHLAYAK_URL_APK || null,
    catatan: adaUpdate
      ? "Pembaruan tersedia — unduh APK baru atau muat ulang aplikasi (PWA)."
      : "Tidak ada pembaruan.",
  });
}
