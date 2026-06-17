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
import type { Theme } from "@/lib/types/equipment";

const THEMES: { id: Theme; label: string; desc: string; colors: string[] }[] = [
  {
    id: "default",
    label: "AirLogix Orange",
    desc: "Estilo original",
    colors: ["bg-orange-500", "bg-orange-300"],
  },
  {
    id: "oceanic",
    label: "Oceanic Blue",
    desc: "Limpio y moderno",
    colors: ["bg-blue-500", "bg-cyan-400"],
  },
  {
    id: "forest",
    label: "Forest Green",
    desc: "Corporativo y fresco",
    colors: ["bg-green-500", "bg-emerald-400"],
  },
  {
    id: "sunset",
    label: "Sunset Purple",
    desc: "Moderno y creativo",
    colors: ["bg-purple-500", "bg-pink-400"],
  },
  {
    id: "midnight",
    label: "Midnight Dark",
    desc: "Elegante premium",
    colors: ["bg-slate-600", "bg-indigo-400"],
  },
  {
    id: "monochrome",
    label: "Monochrome",
    desc: "Minimalista clásico",
    colors: ["bg-neutral-600", "bg-neutral-900"],
  },
];

interface Props {
  onMenuToggle: () => void;
}

export function Topbar({ onMenuToggle }: Props) {
  const {
    filter,
    setFilter,
    darkMode,
    setDarkMode,
    theme,
    setTheme,
    compactMode,
    setCompactMode,
    loading,
    lastUpdate,
    refreshRef,
  } = useApp();

  const [themeOpen, setThemeOpen] = useState(false);
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

        {/* Update indicator */}
        {lastUpdate && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="hidden lg:inline">{updateText}</span>
          </div>
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

        {/* Theme selector */}
        <div className="relative">
          <button
            onClick={() => setThemeOpen((o) => !o)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Cambiar tema"
          >
            <span className="w-4 h-4 rounded-full bg-brand-500 block" />
          </button>

          {themeOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setThemeOpen(false)}
              />
              <div className="absolute right-0 top-10 z-50 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Paleta de Color
                  </p>
                </div>
                <div className="p-2 space-y-1">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id);
                        setThemeOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group"
                    >
                      <div className="flex gap-1">
                        <div
                          className={`w-6 h-6 rounded-md ${t.colors[0]} shadow-sm`}
                        />
                        <div className={`w-2 h-6 rounded-sm ${t.colors[1]}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm text-slate-900 dark:text-white">
                          {t.label}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t.desc}
                        </p>
                      </div>
                      {theme === t.id && (
                        <span className="text-brand-500 text-xs font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {darkMode ? (
                        <Sun size={18} className="text-slate-300" />
                      ) : (
                        <Moon size={18} className="text-slate-600" />
                      )}
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Modo Oscuro
                      </span>
                    </div>
                    <div
                      className={`w-10 h-6 rounded-full transition-colors ${
                        darkMode ? "bg-brand-500" : "bg-slate-300"
                      } relative`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          darkMode ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Dark mode quick toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
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
