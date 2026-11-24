// ============================================================
// RumahLayak — Klien REST (token Bearer + cookie httpOnly)
// Token disimpan di localStorage sehingga sesi tetap hidup di
// dalam iframe preview (cookie lintas-situs diblokir browser)
// dan di WebView Capacitor nantinya.
// ============================================================

const TOKEN_KEY = "rl_token";
const SERVER_KEY = "rl_server_url";

export function getToken(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* penyimpanan tidak tersedia — cookie masih jadi cadangan */
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* abaikan */
  }
}

// ---------- Set IP (alamat server kustom dari layar login) ----------

/** URL server kustom yang disimpan perangkat, atau null bila memakai server bawaan. */
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

/** Gabungkan alamat server kustom (Set IP) dengan path API. */
export function apiUrl(path: string): string {
  const base = getServerUrl();
  return base ? `${base}${path}` : path;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function proses<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    if (res.status === 401) clearToken(); // sesi kedaluwarsa/invalid — bersihkan token lokal
    throw new ApiError(res.status, body.error ?? `Kesalahan server (${res.status})`);
  }
  return body as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  return proses<T>(res);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: "POST", body: payload === undefined ? undefined : JSON.stringify(payload) }),
  patch: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: "PATCH", body: payload === undefined ? undefined : JSON.stringify(payload) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** POST multipart/form-data (unggah file) — Content-Type diset browser otomatis (boundary). */
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const res = await fetch(apiUrl(path), {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: formData,
      cache: "no-store",
    });
    return proses<T>(res);
  },
};

/** Unduh file dari endpoint export via blob (tetap terautentikasi dengan token). */
export async function unduhExport(path: string, namaFile: string) {
  const res = await fetch(apiUrl(path), { credentials: "include", headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Gagal mengunduh (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
