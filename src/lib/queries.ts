"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { bacaSnapshot, hapusSnapshot, sesiFallback, simpanSnapshot } from "./offline";
import { bacaMasterCache, cacheKeMasterData, simpanMasterCache } from "./master-cache";
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

export function useInspeksi(enabled = true) {
  return useQuery({
    queryKey: qk.inspeksi,
    queryFn: async () => {
      try {
        const data = await api.get<{ inspeksi: Inspection[] }>("/api/inspeksi");
        simpanSnapshot("inspeksi", data);
        return data;
      } catch (e) {
        const snap = bacaSnapshot<{ inspeksi: Inspection[] }>("inspeksi");
        if (offlineErr(e) && snap) return snap;
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
