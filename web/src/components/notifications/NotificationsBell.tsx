"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Snowflake,
  Drop,
  WarningOctagon,
} from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { brokiApi } from "@/lib/api/broki";
import {
  buildCriticalAlerts,
  type CriticalAlert,
  type WeatherData,
} from "@/lib/alerts/buildCriticalAlerts";

const ICONS = {
  weather: Snowflake,
  fuel: Drop,
  incident: WarningOctagon,
};

export function NotificationsBell() {
  const { furgonetas, gse, incidentsMemory } = useApp();
  const [open, setOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    brokiApi
      .fetchWeather()
      .then((data) => setWeather(data as WeatherData))
      .catch(() => null);
  }, [furgonetas.length, gse.length]);

  const alerts = useMemo(
    () => buildCriticalAlerts(furgonetas, gse, incidentsMemory, weather),
    [furgonetas, gse, incidentsMemory, weather],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-notifications-root]")) setOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  return (
    <div className="relative" data-notifications-root>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
        title="Notificaciones"
      >
        <Bell size={18} />
        {alerts.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
          <div className="p-3 border-b border-slate-100 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Alertas críticas
            </p>
          </div>
          {alerts.length === 0 ? (
            <p className="p-6 text-sm text-slate-400 text-center italic">
              Sin alertas activas
            </p>
          ) : (
            <ul>
              {alerts.map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: CriticalAlert }) {
  const Icon = ICONS[alert.type];
  const colors =
    alert.priority === "critical"
      ? "border-red-400 bg-red-50 dark:bg-red-900/20"
      : "border-amber-400 bg-amber-50 dark:bg-amber-900/20";

  return (
    <li
      className={`p-4 border-l-4 ${colors} hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors`}
    >
      <div className="flex gap-3">
        <Icon
          size={20}
          className={
            alert.type === "weather"
              ? "text-blue-500"
              : alert.type === "fuel"
                ? "text-amber-500"
                : "text-red-500"
          }
        />
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {alert.title}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            {alert.message}
          </p>
        </div>
      </div>
    </li>
  );
}
