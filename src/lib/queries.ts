"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { bacaAntrean, bacaSnapshot, hapusSnapshot, sesiFallback, simpanSnapshot } from "./offline";
import { bacaMasterCache, cacheKeMasterData, simpanMasterCache } from "./master-cache";
import { useStore } from "./store";
import type { AksiLog, Finding, Inspection, MasterData, SessionUser } from "./types";

export const qk = {
  session: ["session"] as const,
  master: ["master"] as const,
  inspeksi: ["inspeksi"] as const,
  temuan: ["temuan"] as const,
  users: ["users"] as const,
  aktivitas: ["aktivitas"] as const,
  health: ["health"] as const,
};

/** Apakah error berasal dari jaringan (offline), bukan HTTP server? */
function offlineErr(e: unknown): boolean {
  return e instanceof ApiError ? e.status === 0 : (e as { status?: number }).status === 0;
}

export function useSession() {
  return useQuery({
    queryKey: qk.session,
    queryFn: async () => {
      try {
        const data = await api.get<{ authenticated: true; user: SessionUser }>("/api/auth/me");
        simpanSnapshot("session", data);
        return data;
      } catch (e) {
        if ((e as { status?: number }).status === 401) {
          hapusSnapshot("session"); // server menolak token lama — jangan autologin offline
          return { authenticated: false as const, user: null };
        }
        // Offline: token perangkat + sesi cache → tetap masuk tanpa internet
        const fb = sesiFallback();
        if (fb) return fb;
        return { authenticated: false as const, user: null };
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useMaster(enabled = true) {
  return useQuery({
    queryKey: qk.master,
    queryFn: async () => {
      try {
        const data = await api.get<MasterData>("/api/master-data");
        try {
          simpanMasterCache(data); // segarkan cache offline perangkat (best-effort)
          simpanSnapshot("master", data); // snapshot versi penuh (termasuk users)
        } catch {
          /* kuota penuh — cache lama tetap dipakai */
        }
        return data;
      } catch (e) {
        // Kegagalan jaringan (bukan error HTTP terautentikasi) → pakai snapshot/cache perangkat
        if (offlineErr(e)) {
          const snap = bacaSnapshot<MasterData>("master");
          if (snap?.estates) return snap;
        }
        const cache = bacaMasterCache();
        if (cache && offlineErr(e)) return cacheKeMasterData(cache);
        throw e;
      }
    },
    enabled,
    staleTime: 10 * 60_000,
  });
}

// ---------- Gabungkan pemeriksaan yang masih MENGANTRE di perangkat ----------
// Simpan = offline-first (masuk rl_outbox, terkirim lewat "Sinkron Sekarang").
// Agar pemeriksaan buatan lokal langsung terlihat di Riwayat/Peta SEBELUM
// sinkron, hasil antrean disisipkan sebagai baris Inspection sintetis
// (sync "queued") di depan daftar dari server — dedupe berdasarkan ID.
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function inspeksiDariAntrean(): Inspection[] {
  return bacaAntrean()
    .filter((o) => o.metode === "POST" && /^\/api\/inspeksi\/?$/.test(o.path))
    .map((o) => {
      const b = (o.body ?? {}) as {
        id?: string; barakId?: string; picLabel?: string;
        results?: Inspection["results"];
      };
      const { master, session } = useStore.getState();
      const barak = master?.baraks.find((x) => x.id === b.barakId);
      const waktu = new Date(o.dibuat);
      return {
        id: b.id ?? o.id,
        kode: `OFFLINE-${o.id.slice(0, 6).toUpperCase()}`,
        tanggal: waktu.toISOString().slice(0, 10),
        minggu: Math.ceil(waktu.getDate() / 7),
        periode: `${BULAN[waktu.getMonth()]} ${waktu.getFullYear()}`,
        afdelingId: barak?.afdelingId ?? "",
        barakId: b.barakId ?? "",
        auditorId: session?.id ?? "",
        picLabel: b.picLabel === "GM" ? ("GM" as const) : ("EM" as const),
        results: b.results ?? [],
        sync: "queued" as const,
      } satisfies Inspection;
    });
}

function gabungAntrean(daftar: Inspection[]): Inspection[] {
  const antre = inspeksiDariAntrean();
  if (!antre.length) return daftar;
  const idsAntre = new Set(antre.map((a) => a.id));
  return [...antre, ...daftar.filter((i) => !idsAntre.has(i.id))];
}

export function useInspeksi(enabled = true) {
  return useQuery({
    queryKey: qk.inspeksi,
    queryFn: async () => {
      try {
        const data = await api.get<{ inspeksi: Inspection[] }>("/api/inspeksi");
        const gabung = { inspeksi: gabungAntrean(data.inspeksi) };
        simpanSnapshot("inspeksi", gabung);
        return gabung;
      } catch (e) {
        const snap = bacaSnapshot<{ inspeksi: Inspection[] }>("inspeksi");
        if (offlineErr(e) && snap) return { inspeksi: gabungAntrean(snap.inspeksi) };
        throw e;
      }
    },
    enabled,
    select: (d) => d.inspeksi,
  });
}

export function useTemuan(enabled = true) {
  return useQuery({
    queryKey: qk.temuan,
    queryFn: async () => {
      try {
        const data = await api.get<{ temuan: Finding[] }>("/api/temuan");
        simpanSnapshot("temuan", data);
        return data;
      } catch (e) {
        const snap = bacaSnapshot<{ temuan: Finding[] }>("temuan");
        if (offlineErr(e) && snap) return snap;
        throw e;
      }
    },
    enabled,
    select: (d) => d.temuan,
  });
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: qk.users,
    queryFn: async () => {
      try {
        const data = await api.get<{
          users: (import("./types").AppUser & {
            kebunNama: string | null;
            afdelingNama: string | null;
            bindings: string[];
            bindingIds: { estateId: string | null; kebunId: string | null; afdelingId: string | null; barakId: string | null }[];
          })[]
        }>("/api/users");
        simpanSnapshot("users", data);
        return data;
      } catch (e) {
        const snap = bacaSnapshot<{ users: (import("./types").AppUser & { kebunNama: string | null; afdelingNama: string | null; bindings: string[]; bindingIds: { estateId: string | null; kebunId: string | null; afdelingId: string | null; barakId: string | null }[] })[] }>("users");
        if (offlineErr(e) && snap) return snap;
        throw e;
      }
    },
    enabled,
    select: (d) => d.users,
  });
}

export function useAktivitas(enabled = true) {
  return useQuery({
    queryKey: qk.aktivitas,
    queryFn: async () => {
      try {
        const data = await api.get<{ aktivitas: AksiLog[] }>("/api/aktivitas");
        simpanSnapshot("aktivitas", data);
        return data;
      } catch (e) {
        const snap = bacaSnapshot<{ aktivitas: AksiLog[] }>("aktivitas");
        if (offlineErr(e) && snap) return snap;
        throw e;
      }
    },
    enabled,
    select: (d) => d.aktivitas,
  });
}

export function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.inspeksi });
    qc.invalidateQueries({ queryKey: qk.temuan });
    qc.invalidateQueries({ queryKey: qk.aktivitas });
    qc.invalidateQueries({ queryKey: qk.master });
  };
}
