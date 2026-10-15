"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Equipment, Personnel, Aircraft, IncidentState } from "@/lib/types/equipment";

export type SyncMode = "loading" | "realtime" | "polling" | "error" | "idle";

interface AppState {
  furgonetas: Equipment[];
  gse: Equipment[];
  personal: Personnel[];
  aircraft: Aircraft[];
  incidentsMemory: Record<string, IncidentState>;
  loading: boolean;
  fetchError: string | null;
  lastUpdate: Date | null;
  filter: string;
  avionFilter: string;
  statusFilter: string;
  familyFilter: string;
  compactMode: boolean;
  darkMode: boolean;
  autoRefresh: boolean;
  syncMode: SyncMode;
}

interface AppContextValue extends AppState {
  setFilter: (v: string) => void;
  setAvionFilter: (v: string) => void;
  setStatusFilter: (v: string) => void;
  setFamilyFilter: (v: string) => void;
  setCompactMode: (v: boolean) => void;
  setDarkMode: (v: boolean) => void;
  setAutoRefresh: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  setFetchError: (v: string | null) => void;
  setInventory: (
    data: Partial<Pick<AppState, "furgonetas" | "gse" | "personal" | "aircraft">>
  ) => void;
  setIncidentsMemory: (m: Record<string, IncidentState>) => void;
  /** Functional per-equipment update: safe against stale closures and concurrent refreshes. */
  patchIncidentState: (itemId: string, state: IncidentState) => void;
  setSyncMode: (m: SyncMode | ((current: SyncMode) => SyncMode)) => void;
  patchEquipment: (id: string, patch: Partial<Equipment>) => void;
  setAircraft: (aircraft: Aircraft[]) => void;
  restoreInventory: (data: Pick<AppState, "furgonetas" | "gse">) => void;
  refreshRef: React.MutableRefObject<(() => void) | null>;
}

const AppContext = createContext<AppContextValue | null>(null);

function getInitialDark(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("broki_dark_mode") === "true";
}
function getInitialCompact(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("broki_compact_mode") === "true";
}
function getInitialAutoRefresh(): boolean {
  if (typeof window === "undefined") return true;
  // Polling is on unless the user turned it off.
  return localStorage.getItem("broki_auto_refresh") !== "false";
}

function getInitialFilters() {
  if (typeof window === "undefined") {
    return { filter: "", avionFilter: "all", statusFilter: "all", familyFilter: "all" };
  }
  try {
    const saved = JSON.parse(localStorage.getItem("broki_filters") || "{}");
    return {
      filter: saved.search ?? "",
      avionFilter: saved.avion ?? "all",
      statusFilter: saved.status ?? "all",
      familyFilter: saved.family ?? "all",
    };
  } catch {
    return { filter: "", avionFilter: "all", statusFilter: "all", familyFilter: "all" };
  }
}

function saveFilters(filters: {
  filter: string;
  avionFilter: string;
  statusFilter: string;
  familyFilter: string;
}) {
  localStorage.setItem(
    "broki_filters",
    JSON.stringify({
      search: filters.filter,
      status: filters.statusFilter,
      avion: filters.avionFilter,
      family: filters.familyFilter,
    }),
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    const initialFilters = getInitialFilters();
    return {
    furgonetas: [],
    gse: [],
    personal: [],
    aircraft: [],
    incidentsMemory: {},
    loading: false,
    fetchError: null,
    lastUpdate: null,
    filter: initialFilters.filter,
    avionFilter: initialFilters.avionFilter,
    statusFilter: initialFilters.statusFilter,
    familyFilter: initialFilters.familyFilter,
    compactMode: getInitialCompact(),
    darkMode: getInitialDark(),
    autoRefresh: getInitialAutoRefresh(),
    syncMode: "loading",
    };
  });

  const refreshRef = useRef<(() => void) | null>(null);

  const setFilter = useCallback((v: string) => {
    setState((s) => {
      saveFilters({ ...s, filter: v });
      return { ...s, filter: v };
    });
  }, []);
  const setAvionFilter = useCallback((v: string) => {
    setState((s) => {
      saveFilters({ ...s, avionFilter: v });
      return { ...s, avionFilter: v };
    });
  }, []);
  const setStatusFilter = useCallback((v: string) => {
    setState((s) => {
      saveFilters({ ...s, statusFilter: v });
      return { ...s, statusFilter: v };
    });
  }, []);
  const setFamilyFilter = useCallback((v: string) => {
    setState((s) => {
      saveFilters({ ...s, familyFilter: v });
      return { ...s, familyFilter: v };
    });
  }, []);
  const setCompactMode = useCallback((v: boolean) => {
    localStorage.setItem("broki_compact_mode", String(v));
    setState((s) => ({ ...s, compactMode: v }));
  }, []);
  const setDarkMode = useCallback((v: boolean) => {
    localStorage.setItem("broki_dark_mode", String(v));
    document.documentElement.classList.toggle("dark", v);
    setState((s) => ({ ...s, darkMode: v }));
  }, []);
  const setAutoRefresh = useCallback((v: boolean) => {
    localStorage.setItem("broki_auto_refresh", String(v));
    setState((s) => ({ ...s, autoRefresh: v }));
  }, []);
  const setLoading = useCallback(
    (v: boolean) => setState((s) => ({ ...s, loading: v })),
    []
  );
  const setFetchError = useCallback(
    (v: string | null) => setState((s) => ({ ...s, fetchError: v })),
    []
  );
  const setInventory = useCallback(
    (data: Partial<Pick<AppState, "furgonetas" | "gse" | "personal" | "aircraft">>) =>
      setState((s) => ({ ...s, ...data, lastUpdate: new Date() })),
    []
  );
  const setIncidentsMemory = useCallback(
    (m: Record<string, IncidentState>) =>
      setState((s) => ({ ...s, incidentsMemory: m })),
    []
  );
  const patchIncidentState = useCallback(
    (itemId: string, incident: IncidentState) =>
      setState((s) => ({ ...s, incidentsMemory: { ...s.incidentsMemory, [itemId]: incident } })),
    []
  );
  const setSyncMode = useCallback(
    (next: SyncMode | ((current: SyncMode) => SyncMode)) =>
      setState((s) => ({ ...s, syncMode: typeof next === "function" ? next(s.syncMode) : next })),
    []
  );
  const patchEquipment = useCallback((id: string, patch: Partial<Equipment>) => {
    setState((s) => ({
      ...s,
      furgonetas: s.furgonetas.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      gse: s.gse.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }, []);
  const setAircraft = useCallback((aircraft: Aircraft[]) => setState((s) => ({ ...s, aircraft })), []);
  const restoreInventory = useCallback(
    (data: Pick<AppState, "furgonetas" | "gse">) =>
      setState((s) => ({ ...s, ...data })),
    []
  );

  return (
    <AppContext.Provider
      value={{
        ...state,
        setFilter,
        setAvionFilter,
        setStatusFilter,
        setFamilyFilter,
        setCompactMode,
        setDarkMode,
        setAutoRefresh,
        setLoading,
        setFetchError,
        setInventory,
        setIncidentsMemory,
        patchIncidentState,
        setSyncMode,
        patchEquipment,
        setAircraft,
        restoreInventory,
        refreshRef,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
