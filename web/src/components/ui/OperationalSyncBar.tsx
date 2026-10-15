"use client";

import { ArrowsClockwise, Broadcast, WarningCircle } from "@phosphor-icons/react";
import type { OperationalSyncMode } from "@/lib/hooks/useBrokiRealtime";

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface Props {
  syncMode: OperationalSyncMode;
  lastUpdate: Date | null;
  updating?: boolean;
  className?: string;
}

/** Per-domain sync indicator (planner, roster, relays, stock, tooling have their own Realtime channel). */
export function OperationalSyncBar({ syncMode, lastUpdate, updating = false, className = "" }: Props) {
  const status =
    syncMode === "error"
      ? { label: "Sin Realtime: reintentando", cls: "text-danger-strong", Icon: WarningCircle }
      : syncMode === "realtime"
        ? { label: "Realtime activo", cls: "text-success-strong", Icon: Broadcast }
        : syncMode === "polling"
          ? { label: "Actualización automática (30 s)", cls: "text-warning-strong", Icon: ArrowsClockwise }
          : { label: "Conectando…", cls: "text-fg-muted", Icon: ArrowsClockwise };

  const { label, cls, Icon } = status;

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs ${className}`}
      role="status"
      aria-live="polite"
      aria-busy={updating}
    >
      <Icon size={14} className={`${cls} ${updating ? "animate-spin" : ""}`} aria-hidden />
      <span className={`font-semibold ${cls}`}>{label}</span>
      {lastUpdate && <span className="tabular text-fg-muted">· {formatTime(lastUpdate)}</span>}
      {updating && <span className="text-fg-muted">· Actualizando…</span>}
    </div>
  );
}
