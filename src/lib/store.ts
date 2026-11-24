"use client";
import { create } from "zustand";
import type {
  Afdeling, Barak, ChecklistItem, DraftTemuan, Foto, MasterData, Mode, MobileScreen,
  SessionUser, StatusNilai, WebPage,
} from "./types";

interface StoreState {
  // UI
  mode: Mode;
  mobileScreen: MobileScreen;
  webPage: WebPage;
  activeInspectionBarakId: string | null;
  activeItemId: string | null;
  activeFindingId: string | null;
  inspectPreselect: { afdelingId: string; barakId: string } | null;
  guidelineTab: "jalur" | "level" | "langkah";
  rekapKebunId: string | null;

  // Sesi & master data (dari server)
  session: SessionUser | null;
  master: MasterData | null;

  // Draft pemeriksaan berjalan (disimpan ke server saat "Simpan")
  draft: {
    barakId: string | null;
    picLabel: "EM" | "GM";
    gps: { lat: number; lng: number; acc: number } | null; // HASIL TAGGING — 1x per pemeriksaan rumah
    results: Record<string, { status: StatusNilai | null; catatan: string; fotos: Foto[] }>;
    temuan: DraftTemuan[];
    kesimpulan: string;
    lastGradedId: string | null; // item terakhir dinilai — acuan lanjut ke item berikutnya
  };

  // Actions
  setMode: (m: Mode) => void;
  setMobileScreen: (s: MobileScreen) => void;
  setWebPage: (p: WebPage) => void;
  setActiveItem: (id: string | null) => void;
  setActiveFinding: (id: string | null) => void;
  setInspectPreselect: (p: { afdelingId: string; barakId: string } | null) => void;
  setGuidelineTab: (t: "jalur" | "level" | "langkah") => void;
  setRekapKebun: (id: string | null) => void;

  setSession: (s: SessionUser | null) => void;
  setMaster: (m: MasterData | null) => void;

  startDraft: (barakId: string, picLabel?: "EM" | "GM") => void;
  discardDraft: () => void;
  setDraftGps: (g: { lat: number; lng: number; acc: number }) => void;
  setDraftStatus: (itemId: string, status: StatusNilai) => void;
  setDraftNote: (itemId: string, note: string) => void;
  addDraftFoto: (itemId: string, foto: Foto) => void;
  removeDraftFoto: (itemId: string, fotoId: string) => void;
  addDraftTemuan: (t: DraftTemuan) => void;
  setDraftKesimpulan: (s: string) => void;
}

const kosong: StoreState["draft"] = {
  barakId: null,
  picLabel: "EM",
  gps: null,
  results: {},
  temuan: [],
  kesimpulan: "",
  lastGradedId: null,
};

export const useStore = create<StoreState>()((set) => ({
  mode: "mobile",
  mobileScreen: "login",
  webPage: "dashboard",
  activeInspectionBarakId: null,
  activeItemId: null,
  activeFindingId: null,
  inspectPreselect: null,
  guidelineTab: "jalur",
  rekapKebunId: null,

  session: null,
  master: null,

  draft: kosong,

  setMode: (m) => set({ mode: m }),
  setMobileScreen: (s) => set({ mobileScreen: s }),
  setWebPage: (p) => set({ webPage: p }),
  setActiveItem: (id) => set({ activeItemId: id }),
  setActiveFinding: (id) => set({ activeFindingId: id }),
  setInspectPreselect: (p) => set({ inspectPreselect: p }),
  setGuidelineTab: (t) => set({ guidelineTab: t }),
  setRekapKebun: (id) => set({ rekapKebunId: id }),

  setSession: (s) => set({ session: s }),
  setMaster: (m) => set({ master: m }),

  startDraft: (barakId, picLabel = "EM") =>
    set({ draft: { ...kosong, barakId, picLabel, results: {} }, activeItemId: null, mobileScreen: "inspect" }),
  discardDraft: () => set({ draft: kosong, activeItemId: null }),
  setDraftGps: (g) => set((s) => ({ draft: { ...s.draft, gps: g } })),
  setDraftStatus: (itemId, status) =>
    set((s) => ({
      draft: {
        ...s.draft,
        lastGradedId: itemId, // catat item terakhir dinilai → daftar lanjut ke item di bawahnya
        results: { ...s.draft.results, [itemId]: { ...(s.draft.results[itemId] ?? { status: null, catatan: "", fotos: [] }), status } },
      },
    })),
  setDraftNote: (itemId, note) =>
    set((s) => ({
      draft: {
        ...s.draft,
        results: { ...s.draft.results, [itemId]: { ...(s.draft.results[itemId] ?? { status: null, catatan: "", fotos: [] }), catatan: note } },
      },
    })),
  addDraftFoto: (itemId, foto) =>
    set((s) => {
      const cur = s.draft.results[itemId] ?? { status: null, catatan: "", fotos: [] };
      return {
        draft: {
          ...s.draft,
          results: { ...s.draft.results, [itemId]: { ...cur, fotos: [...cur.fotos, foto] } },
        },
      };
    }),
  removeDraftFoto: (itemId, fotoId) =>
    set((s) => {
      const cur = s.draft.results[itemId];
      if (!cur) return {};
      return {
        draft: {
          ...s.draft,
          results: { ...s.draft.results, [itemId]: { ...cur, fotos: cur.fotos.filter((f) => f.id !== fotoId) } },
        },
      };
    }),
  addDraftTemuan: (t) => set((s) => ({ draft: { ...s.draft, temuan: [...s.draft.temuan, t] } })),
  setDraftKesimpulan: (kes) => set((s) => ({ draft: { ...s.draft, kesimpulan: kes } })),
}));

// ---------- Helper nama (baca master data aktif) ----------
export function namaAfdeling(id: string) {
  return useStore.getState().master?.afdelings.find((a: Afdeling) => a.id === id)?.nama ?? id;
}
export function namaBarak(id: string) {
  return useStore.getState().master?.baraks.find((b: Barak) => b.id === id)?.nama ?? id;
}
export function labelItem(id: string) {
  return useStore.getState().master?.checklist.find((c: ChecklistItem) => c.id === id)?.label ?? id;
}
