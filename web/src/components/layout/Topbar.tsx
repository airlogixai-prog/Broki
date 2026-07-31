"use client";

import { useState } from "react";
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
} from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { PwaInstallButton } from "@/components/pwa/PwaInstallButton";

interface Props {
  onMenuToggle: () => void;
}

export function Topbar({ onMenuToggle }: Props) {
  const {
    filter,
    setFilter,
    darkMode,
    setDarkMode,
    compactMode,
    setCompactMode,
    loading,
    lastUpdate,
    refreshRef,
    autoRefresh,
    setAutoRefresh,
  } = useApp();

  const [userOpen, setUserOpen] = useState(false);
  const { user, signOut } = useAuth();

  const handleRefresh = () => {
    refreshRef.current?.();
  };

  const updateText = lastUpdate
    ? `Actualizado ${formatRelative(lastUpdate)}`
    : "Actualizando...";

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="md:hidden p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
      >
        <List size={20} />
      </button>

      {/* Search */}
      <div className="flex-1 relative max-w-md">
        <MagnifyingGlass
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          placeholder="Buscar equipo, matrícula, trabajador... (Ctrl+K)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <PwaInstallButton />
        <NotificationsBell />

        {/* Update indicator doubles as the auto-refresh toggle */}
        {lastUpdate && (
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            aria-pressed={autoRefresh}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={
              autoRefresh
                ? "Actualización automática cada 30 s. Clic para pausar."
                : "Actualización automática pausada. Clic para reanudar."
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-500" : "bg-slate-400"}`}
            />
            <span className="hidden lg:inline">
              {autoRefresh ? updateText : "Auto-refresco en pausa"}
            </span>
          </button>
        )}

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Actualizar datos (Ctrl+R)"
        >
          <ArrowsClockwise
            size={18}
            className={loading ? "animate-spin" : ""}
          />
        </button>

        {/* Compact toggle */}
        <button
          onClick={() => setCompactMode(!compactMode)}
          className="hidden md:flex p-2 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Cambiar vista"
        >
          {compactMode ? <SquaresFour size={18} /> : <Rows size={18} />}
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title={darkMode ? "Modo claro" : "Modo oscuro"}
          aria-label={darkMode ? "Activar modo claro" : "Activar modo oscuro"}
          aria-pressed={darkMode}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserOpen((o) => !o)}
            className="flex items-center gap-2 p-1.5 pr-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Cuenta"
          >
            <span className="w-8 h-8 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <User size={16} weight="bold" />
            </span>
            <span className="hidden lg:block text-xs font-medium max-w-[140px] truncate">
              {user?.email ?? "Usuario"}
            </span>
          </button>

          {userOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserOpen(false)}
              />
              <div className="absolute right-0 top-11 z-50 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Sesión activa
                  </p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white mt-1 truncate">
                    {user?.email}
                  </p>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => {
                      setUserOpen(false);
                      void signOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <SignOut size={18} />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function formatRelative(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 10) return "ahora mismo";
  if (diff < 60) return `hace ${diff}s`;
  return `hace ${Math.floor(diff / 60)}min`;
}
