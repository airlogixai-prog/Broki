"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type {
  Equipment,
  Personnel,
  Aircraft,
  Theme,
  IncidentState,
} from "@/lib/types/equipment";

export type ViewId =
  | "dashboard"
  | "furgonetas"
  | "gse"
  | "aviones"
  | "incidencias"
  | "analytics"
  | "planner"
  | "roster"
  | "fleet"
  | "stock"
  | "tooling"
  | "mapa";

interface AppState {
  furgonetas: Equipment[];
  gse: Equipment[];
  personal: Personnel[];
  aircraft: Aircraft[];
  incidentsMemory: Record<string, IncidentState>;
  loading: boolean;
  lastUpdate: Date | null;
  filter: string;
  avionFilter: string;
  statusFilter: string;
  familyFilter: string;
  compactMode: boolean;
  theme: Theme;
  darkMode: boolean;
}

interface AppContextValue extends AppState {
  setFilter: (v: string) => void;
  setAvionFilter: (v: string) => void;
  setStatusFilter: (v: string) => void;
  setFamilyFilter: (v: string) => void;
  setCompactMode: (v: boolean) => void;
  setTheme: (t: Theme) => void;
  setDarkMode: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  setInventory: (
    data: Pick<AppState, "furgonetas" | "gse" | "personal" | "aircraft">
  ) => void;
  setIncidentsMemory: (m: Record<string, IncidentState>) => void;
  refreshRef: React.MutableRefObject<(() => void) | null>;
}

const AppContext = createContext<AppContextValue | null>(null);

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "default";
  return (localStorage.getItem("broki_theme") as Theme) ?? "default";
}
function getInitialDark(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("broki_dark_mode") === "true";
}
function getInitialCompact(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("broki_compact_mode") === "true";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    furgonetas: [],
    gse: [],
    personal: [],
    aircraft: [],
    incidentsMemory: {},
    loading: false,
    lastUpdate: null,
    filter: "",
    avionFilter: "all",
    statusFilter: "all",
    familyFilter: "all",
    compactMode: getInitialCompact(),
    theme: getInitialTheme(),
    darkMode: getInitialDark(),
  });

  const refreshRef = useRef<(() => void) | null>(null);

  const setFilter = useCallback((v: string) => setState((s) => ({ ...s, filter: v })), []);
  const setAvionFilter = useCallback(
    (v: string) => setState((s) => ({ ...s, avionFilter: v })),
    []
  );
  const setStatusFilter = useCallback(
    (v: string) => setState((s) => ({ ...s, statusFilter: v })),
    []
  );
  const setFamilyFilter = useCallback(
    (v: string) => setState((s) => ({ ...s, familyFilter: v })),
    []
  );
  const setCompactMode = useCallback((v: boolean) => {
    localStorage.setItem("broki_compact_mode", String(v));
    setState((s) => ({ ...s, compactMode: v }));
  }, []);
  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem("broki_theme", t);
    document.documentElement.setAttribute("data-theme", t === "default" ? "" : t);
    setState((s) => ({ ...s, theme: t }));
  }, []);
  const setDarkMode = useCallback((v: boolean) => {
    localStorage.setItem("broki_dark_mode", String(v));
    document.documentElement.classList.toggle("dark", v);
    setState((s) => ({ ...s, darkMode: v }));
  }, []);
  const setLoading = useCallback(
    (v: boolean) => setState((s) => ({ ...s, loading: v })),
    []
  );
  const setInventory = useCallback(
    (data: Pick<AppState, "furgonetas" | "gse" | "personal" | "aircraft">) =>
      setState((s) => ({ ...s, ...data, lastUpdate: new Date() })),
    []
  );
  const setIncidentsMemory = useCallback(
    (m: Record<string, IncidentState>) =>
      setState((s) => ({ ...s, incidentsMemory: m })),
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
        setTheme,
        setDarkMode,
        setLoading,
        setInventory,
        setIncidentsMemory,
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
