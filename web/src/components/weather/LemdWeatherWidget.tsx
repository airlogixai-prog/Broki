"use client";

import { Cloud, Thermometer, Wind, Gauge, Snowflake } from "@phosphor-icons/react";
import { useLemdWeather } from "@/lib/hooks/useLemdWeather";
import { BlockSkeleton } from "@/components/ui/BlockSkeleton";

/** LEMD current conditions (Open-Meteo). Failure is shown, never hidden. */
export function LemdWeatherWidget({ className = "" }: { className?: string }) {
  const { weather, loading } = useLemdWeather();

  if (loading) return <BlockSkeleton className={`h-14 ${className}`} label="Cargando meteorología" />;
  if (!weather) return null;

  const unavailable = typeof weather.temp !== "number";
  const freezing = typeof weather.temp === "number" && weather.temp <= 0;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border px-4 py-2.5 ${
        freezing ? "border-info/40 bg-info-muted" : "border-border bg-surface"
      } ${className}`}
      role="group"
      aria-label="Meteorología LEMD"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-muted text-info-strong" aria-hidden>
          {freezing ? <Snowflake size={18} /> : <Cloud size={18} />}
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">LEMD</p>
          <p className="font-mono text-xs text-fg-muted">{unavailable ? "Meteo no disponible" : weather.raw}</p>
        </div>
      </div>
      {!unavailable && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <span className="tabular flex items-center gap-1.5 font-bold text-fg">
            <Thermometer size={16} className="text-warning" aria-hidden /> {weather.temp} °C
          </span>
          <span className="tabular flex items-center gap-1.5 font-semibold text-fg-muted">
            <Gauge size={16} className="text-success" aria-hidden /> QNH {weather.qnh}
          </span>
          <span className="tabular flex items-center gap-1.5 font-semibold text-fg-muted">
            <Wind size={16} className="text-info" aria-hidden /> {weather.wind.dir}° / {weather.wind.speed} kt
          </span>
          {freezing && <span className="text-xs font-bold text-info-strong">Riesgo de congelación</span>}
        </div>
      )}
    </div>
  );
}
