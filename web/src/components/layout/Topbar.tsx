"use client";

import { useEffect, useRef, useState } from "react";
import {
  List,
  ArrowsClockwise,
  MagnifyingGlass,
  Moon,
  Sun,
  Rows,
  SquaresFour,
  SignOut,
  User,
  Palette,
  Check,
  X,
} from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { PwaInstallButton } from "@/components/pwa/PwaInstallButton";
import { IconButton } from "@/components/ui/Button";
import { applyThemeToDocument, parseTheme, type ThemeId } from "@/lib/preferences/storage";
import { useHydrated } from "@/lib/hooks/useHydrated";

const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: "default", label: "AirLogix", swatch: "#f97316" },
  { id: "oceanic", label: "Oceanic", swatch: "#0ea5e9" },
  { id: "forest", label: "Forest", swatch: "#10b981" },
  { id: "sunset", label: "Sunset", swatch: "#f43f5e" },
  { id: "midnight", label: "Midnight", swatch: "#6366f1" },
  { id: "monochrome", label: "Monochrome", swatch: "#71717a" },
];

interface Props {
  onMenuToggle: () => void;
}

export function Topbar({ onMenuToggle }: Props) {
  const { filter, setFilter, darkMode, setDarkMode, compactMode, setCompactMode, loading, lastUpdate, refreshRef, autoRefresh, setAutoRefresh, syncMode, fetchError } = useApp();
  const [userOpen, setUserOpen] = useState(false);
  // Lazy init: the value only renders inside the (initially closed) menu, so
  // reading localStorage here cannot cause a hydration mismatch.
  const [theme, setTheme] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return "default";
    try {
      return parseTheme(localStorage.getItem("broki_theme"));
    } catch {
      return "default";
    }
  });
  const [tick, setTick] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const hydrated = useHydrated();
  // Preferences come from localStorage; render server defaults until hydrated.
  const dark = hydrated && darkMode;
  const compact = hydrated && compactMode;
  const auto = hydrated ? autoRefresh : true;

  // Keep the "hace Xs" label honest without re-rendering the whole app.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!userOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setUserOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setUserOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [userOpen]);

  const chooseTheme = (id: ThemeId) => {
    applyThemeToDocument(id);
    setTheme(id);
  };

  void tick;
  const syncLabel = fetchError
    ? "Error de sincronización"
    : syncMode === "realtime"
      ? "Realtime"
      : syncMode === "polling" || auto
        ? "Polling 30 s"
        : "Auto-refresco en pausa";
  const syncDot = fetchError ? "bg-danger" : syncMode === "realtime" ? "bg-success" : auto ? "bg-warning" : "bg-neutral";
  const updateText = lastUpdate ? formatRelative(lastUpdate) : "sin datos";

  const search = (
    <div className="broki-topbar__search">
      <MagnifyingGlass size={16} className="broki-topbar__search-icon" aria-hidden />
      <input
        type="search"
        placeholder="Buscar equipo, matrícula, trabajador…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="broki-input"
        aria-label="Buscar en el dashboard"
        aria-keyshortcuts="Control+K /"
      />
      {hydrated && filter && (
        <button type="button" onClick={() => setFilter("")} className="broki-topbar__search-clear" aria-label="Limpiar búsqueda">
          <X size={14} />
        </button>
      )}
    </div>
  );

  return (
    <header className="broki-topbar">
      <div className="broki-topbar__row">
        <IconButton label="Abrir menú" className="md:hidden" onClick={onMenuToggle}>
          <List size={20} />
        </IconButton>

        <div className="hidden flex-1 sm:block">{search}</div>

        <div className="broki-topbar__actions">
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            aria-pressed={auto}
            className="flex min-h-9 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:bg-subtle sm:px-3"
            title={`${syncLabel} · ${updateText}. ${auto ? "Clic para pausar la actualización automática." : "Clic para reanudar la actualización automática."}`}
            aria-label={`${syncLabel}, actualizado ${updateText}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${syncDot}`} aria-hidden />
            <span className="hidden lg:inline">{syncLabel}</span>
            <span className="tabular hidden text-fg-subtle sm:inline"><span className="hidden lg:inline">· </span>{updateText}</span>
          </button>

          <IconButton label="Actualizar datos (Ctrl+R)" onClick={() => refreshRef.current?.()}>
            <ArrowsClockwise size={18} className={loading ? "animate-spin" : ""} />
          </IconButton>

          <span className="hidden sm:inline-flex">
            <PwaInstallButton />
          </span>
          <NotificationsBell />

          <IconButton label={compact ? "Vista normal" : "Vista compacta"} className="hidden md:inline-flex" onClick={() => setCompactMode(!compactMode)} aria-pressed={compact}>
            {compact ? <SquaresFour size={18} /> : <Rows size={18} />}
          </IconButton>

          <IconButton label={dark ? "Activar modo claro" : "Activar modo oscuro"} onClick={() => setDarkMode(!darkMode)} aria-pressed={dark}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setUserOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg p-1 pr-2 text-fg-muted hover:bg-subtle"
              aria-expanded={userOpen}
              aria-haspopup="menu"
              aria-label="Cuenta y preferencias"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-300">
                <User size={16} weight="bold" />
              </span>
              <span className="hidden max-w-[150px] truncate text-xs font-medium lg:block">{user?.email ?? "Usuario"}</span>
            </button>

            {userOpen && (
              <div className="absolute right-0 top-11 z-[60] w-72 overflow-hidden rounded-xl border border-border bg-surface shadow-xl" role="menu">
                <div className="border-b border-border-subtle p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-fg-subtle">Sesión activa</p>
                  <p className="mt-1 truncate text-sm font-medium text-fg">{user?.email}</p>
                </div>
                <div className="border-b border-border-subtle p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
                    <Palette size={12} /> Tema de color
                  </p>
                  <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Tema de color">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={theme === t.id}
                        onClick={() => chooseTheme(t.id)}
                        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs ${
                          theme === t.id ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "border-border text-fg-muted hover:bg-subtle"
                        }`}
                      >
                        <span className="h-3 w-3 rounded-full" style={{ background: t.swatch }} aria-hidden />
                        <span className="truncate">{t.label}</span>
                        {theme === t.id && <Check size={12} className="ml-auto shrink-0" aria-hidden />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUserOpen(false);
                      void signOut();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-danger-strong hover:bg-danger-muted"
                    role="menuitem"
                  >
                    <SignOut size={18} />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="broki-topbar__row broki-topbar__row--search">{search}</div>
    </header>
  );
}

function formatRelative(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 10) return "ahora";
  if (diff < 60) return `hace ${diff} s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
