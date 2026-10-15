"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Snowflake, Drop, WarningOctagon, Prohibit, Gauge, CheckCircle } from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { useLemdWeather } from "@/lib/hooks/useLemdWeather";
import { buildCriticalAlerts, type AlertType, type CriticalAlert } from "@/lib/alerts/buildCriticalAlerts";
import { openEquipmentById } from "@/lib/hooks/useEquipmentModal";
import { useBrowserNotifications } from "@/lib/hooks/useBrowserNotifications";

const ICONS: Record<AlertType, typeof Bell> = {
  weather: Snowflake,
  fuel: Drop,
  incident: WarningOctagon,
  inoperative: Prohibit,
  nitrogen: Gauge,
};

const ICON_CLS: Record<AlertType, string> = {
  weather: "text-info",
  fuel: "text-warning",
  incident: "text-danger",
  inoperative: "text-danger",
  nitrogen: "text-warning",
};

export function NotificationsBell() {
  const { furgonetas, gse, incidentsMemory } = useApp();
  const [open, setOpen] = useState(false);
  const { weather } = useLemdWeather();
  const rootRef = useRef<HTMLDivElement>(null);

  const alerts = useMemo(
    () => buildCriticalAlerts(furgonetas, gse, incidentsMemory, weather),
    [furgonetas, gse, incidentsMemory, weather],
  );
  const critical = alerts.filter((a) => a.priority === "critical").length;
  const browser = useBrowserNotifications(alerts);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" data-notifications-root ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg"
        aria-label={alerts.length === 0 ? "Alertas: ninguna activa" : `Alertas: ${alerts.length} activas${critical ? `, ${critical} críticas` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Alertas operativas"
      >
        <Bell size={18} />
        {alerts.length > 0 && (
          <span
            className={`tabular absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white ${
              critical ? "bg-danger" : "bg-warning"
            }`}
            aria-hidden
          >
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 z-[60] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
          role="dialog"
          aria-label="Alertas operativas"
        >
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-fg-subtle">Alertas operativas</p>
            <span className="tabular text-xs text-fg-muted">{alerts.length}</span>
          </div>
          {alerts.length === 0 ? (
            <p className="flex items-center justify-center gap-2 p-6 text-sm text-fg-muted">
              <CheckCircle size={18} className="text-success" aria-hidden /> Sin alertas activas
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {alerts.map((alert) => (
                <AlertRow key={alert.id} alert={alert} onDone={() => setOpen(false)} />
              ))}
            </ul>
          )}
          {browser.permission !== "unsupported" && (
            <div className="border-t border-border-subtle bg-muted px-4 py-2.5">
              <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-fg-muted">
                <span>
                  Avisos del navegador
                  <span className="block text-[11px] text-fg-subtle">
                    {browser.permission === "denied" ? "Bloqueados en el navegador" : "Congelación, combustible < 10 % e incidencias nuevas, con la pestaña en segundo plano"}
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={browser.enabled}
                  checked={browser.enabled}
                  disabled={browser.permission === "denied"}
                  onChange={() => void browser.toggle()}
                  className="h-4 w-4 shrink-0 accent-brand-600"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert, onDone }: { alert: CriticalAlert; onDone: () => void }) {
  const router = useRouter();
  const Icon = ICONS[alert.type];
  const border = alert.priority === "critical" ? "border-danger" : "border-warning";
  const go = () => {
    onDone();
    if (alert.id === "inoperative-summary") {
      router.push("/broki/incidencias");
      return;
    }
    if (!alert.itemId) return;
    openEquipmentById(alert.itemId);
  };

  return (
    <li>
      <button
        type="button"
        onClick={go}
        disabled={!alert.itemId && alert.id !== "inoperative-summary"}
        className={`flex w-full gap-3 border-l-4 px-4 py-3 text-left hover:bg-subtle disabled:cursor-default disabled:opacity-80 ${border}`}
      >
        <Icon size={20} className={`mt-0.5 shrink-0 ${ICON_CLS[alert.type]}`} aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-bold text-fg">{alert.title}</p>
          <p className="mt-0.5 break-words text-xs text-fg-muted">{alert.message}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            {alert.priority === "critical" ? "Crítica" : "Alta"}
          </p>
        </div>
      </button>
    </li>
  );
}
