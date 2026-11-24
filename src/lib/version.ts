// ============================================================
// RumahLayak — Versi aplikasi (satu sumber kebenaran untuk UI,
// endpoint /api/app-version, dan pembanding "Periksa Update")
// ============================================================

export const VERSI_APLIKASI = "1.0.0";

/** Bandingkan dua nomor versi semver ("1.0" vs "1.0.0" dianggap sama). Hasil: 1 | 0 | -1. */
export function bandingkanVersi(a: string, b: string): number {
  const pecah = (v: string) =>
    v
      .trim()
      .replace(/^v/i, "")
      .split(".")
      .map((x) => parseInt(x, 10) || 0);
  const pa = pecah(a);
  const pb = pecah(b);
  for (let i = 0; i < 3; i++) {
    const xa = pa[i] ?? 0;
    const xb = pb[i] ?? 0;
    if (xa !== xb) return xa > xb ? 1 : -1;
  }
  return 0;
}
