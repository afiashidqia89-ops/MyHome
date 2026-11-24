"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
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

export function useSession() {
  return useQuery({
    queryKey: qk.session,
    queryFn: async () => {
      try {
        return await api.get<{ authenticated: true; user: SessionUser }>("/api/auth/me");
      } catch (e) {
        if ((e as { status?: number }).status === 401) return { authenticated: false as const, user: null };
        throw e;
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
        } catch {
          /* kuota penuh — cache lama tetap dipakai */
        }
        return data;
      } catch (e) {
        // Kegagalan jaringan (bukan error HTTP terautentikasi) → pakai cache pra-unduh
        const cache = bacaMasterCache();
        if (cache && (e as { status?: number }).status === undefined) return cacheKeMasterData(cache);
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
    queryFn: () => api.get<{ inspeksi: Inspection[] }>("/api/inspeksi"),
    enabled,
    select: (d) => d.inspeksi,
  });
}

export function useTemuan(enabled = true) {
  return useQuery({
    queryKey: qk.temuan,
    queryFn: () => api.get<{ temuan: Finding[] }>("/api/temuan"),
    enabled,
    select: (d) => d.temuan,
  });
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: qk.users,
    queryFn: () =>
      api.get<{
        users: (import("./types").AppUser & {
          kebunNama: string | null;
          afdelingNama: string | null;
          bindings: string[];
          bindingIds: { estateId: string | null; kebunId: string | null; afdelingId: string | null; barakId: string | null }[];
        })[]
      }>("/api/users"),
    enabled,
    select: (d) => d.users,
  });
}

export function useAktivitas(enabled = true) {
  return useQuery({
    queryKey: qk.aktivitas,
    queryFn: () => api.get<{ aktivitas: AksiLog[] }>("/api/aktivitas"),
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
