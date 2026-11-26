// ============================================================
// RumahLayak — Konfigurasi alamat server (dipisah dari api.ts
// agar bisa dipakai lapisan offline tanpa impor melingkar)
//
// Prioritas alamat API:
//   1. "Set IP" perangkat (localStorage) — diisi lewat ikon gear
//      di layar login / menu Pengaturan.
//   2. NEXT_PUBLIC_DEFAULT_SERVER — ditanam saat build APK
//      (workflow GitHub: variabel repo APP_SERVER_URL, opsional).
//   3. Kosong = relatif "/" — artinya portal web yang dilayani
//      server yang sama (Vercel / localhost dev).
// ============================================================

import { Capacitor } from "@capacitor/core";

const SERVER_KEY = "rl_server_url";

/** Alamat bawaan yang ditanam saat build APK (kosong di portal web). */
const SERVER_BAKU = (process.env.NEXT_PUBLIC_DEFAULT_SERVER ?? "").trim().replace(/\/+$/, "");

export function getToken(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem("rl_token");
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    window.localStorage.setItem("rl_token", token);
  } catch {
    /* penyimpanan tidak tersedia — cookie masih jadi cadangan */
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem("rl_token");
  } catch {
    /* abaikan */
  }
}

/** URL server kustom yang disimpan perangkat ("Set IP"), atau null bila bawaan. */
export function getServerUrl(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(SERVER_KEY);
  } catch {
    return null;
  }
}

export function setServerUrl(url: string | null) {
  try {
    if (url) window.localStorage.setItem(SERVER_KEY, url);
    else window.localStorage.removeItem(SERVER_KEY);
  } catch {
    /* penyimpanan tidak tersedia — abaikan */
  }
}

/** Alamat aktif: Set IP → bawaan build → relatif (portal web). */
export function alamatAktif(): string | null {
  return getServerUrl() || SERVER_BAKU || null;
}

/** True bila ada alamat API yang bisa dipakai (Set IP / bawaan build / portal web). */
export function serverTerpasang(): boolean {
  if (typeof window === "undefined") return true;
  // Portal web (bukan APK): TANPA alamat pun path relatif selalu valid —
  // server ada di origin yang sama (regresi login web: dulu terbalik).
  // Sebaliknya di APK (WebView) tanpa Set IP / bawaan build tidak ada
  // server yang bisa dihubungi → wajib isi Set IP.
  // Pakai isNativePlatform(): "Capacitor" in window juga TRUE di browser
  // karena @capacitor/core mendefinisikan window.Capacitor di web.
  if (!alamatAktif()) return !Capacitor.isNativePlatform();
  return true;
}

/** Normalisasi input "Set IP" — terima "192.168.1.10:3000" maupun URL penuh. */
export function normalisasiServerUrl(input: string): string | null {
  const s = input.trim().replace(/\/+$/, "");
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `http://${s}`;
  try {
    const u = new URL(withScheme);
    if (!u.host) return null;
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

/** Gabungkan alamat server aktif dengan path API. */
export function apiUrl(path: string): string {
  const base = alamatAktif();
  return base ? `${base}${path}` : path;
}
