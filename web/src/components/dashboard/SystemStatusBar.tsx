"use client";

import { ArrowsClockwise, WarningCircle, Broadcast, WifiSlash } from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { useHydrated } from "@/lib/hooks/useHydrated";

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/**
 * Compact sync strip (legacy `#lblEstado` "Sincronizado (hh:mm:ss)"). Text and
 * icon carry the state, colour is secondary.
 */
export function SystemStatusBar({ className = "" }: { className?: string }) {
  const { syncMode, lastUpdate, fetchError, autoRefresh: storedAutoRefresh, loading, setAutoRefresh } = useApp();
  const hydrated = useHydrated();
  const autoRefresh = hydrated ? storedAutoRefresh : true;

  const status = fetchError
    ? { label: "Error de sincronización", cls: "text-danger-strong", Icon: WarningCircle }
    : syncMode === "realtime"
      ? { label: "Realtime activo", cls: "text-success-strong", Icon: Broadcast }
      : syncMode === "polling" || autoRefresh
        ? { label: "Actualización automática (30 s)", cls: "text-warning-strong", Icon: ArrowsClockwise }
        : syncMode === "loading" || loading
          ? { label: "Sincronizando…", cls: "text-fg-muted", Icon: ArrowsClockwise }
          : { label: "Actualización automática en pausa", cls: "text-fg-muted", Icon: WifiSlash };

  const { label, cls, Icon } = status;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs ${className}`}
      role="status"
      aria-live="polite"
    >
      <Icon size={16} className={`${cls} ${loading ? "animate-spin" : ""}`} aria-hidden />
      <span className={`font-semibold ${cls}`}>{label}</span>
      {lastUpdate && (
        <span className="tabular text-fg-muted">
          · Sincronizado {formatTime(lastUpdate)}
        </span>
      )}
      <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-fg-muted">
        <input
          type="checkbox"
          checked={autoRefresh}
          onChange={(e) => setAutoRefresh(e.target.checked)}
          className="h-4 w-4 accent-brand-600"
        />
        Auto-refresco
      </label>
    </div>
  );
}
