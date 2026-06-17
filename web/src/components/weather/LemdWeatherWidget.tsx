"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  Thermometer,
  Wind,
  Gauge,
} from "@phosphor-icons/react";
import { brokiApi } from "@/lib/api/broki";
import type { WeatherData } from "@/lib/alerts/buildCriticalAlerts";

export function LemdWeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    brokiApi
      .fetchWeather()
      .then((data) => {
        if (active) setWeather(data as WeatherData);
      })
      .catch(() => {
        if (active) {
          setWeather({
            temp: "--",
            qnh: "----",
            wind: { dir: 0, speed: 0 },
            raw: "WEATHER UNAVAILABLE",
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse h-24" />
    );
  }

  if (!weather) return null;

  return (
    <div className="bg-gradient-to-r from-sky-50 to-blue-50 dark:from-slate-800 dark:to-slate-800/80 rounded-xl border border-sky-200 dark:border-slate-700 p-4 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
            <Cloud size={22} className="text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              Meteorología LEMD
            </p>
            <p className="text-sm font-mono text-slate-700 dark:text-slate-300">
              {weather.raw}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Thermometer size={18} className="text-orange-500" />
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {weather.temp}°C
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Gauge size={18} className="text-emerald-500" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              QNH {weather.qnh}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Wind size={18} className="text-blue-500" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {weather.wind.dir}° / {weather.wind.speed} kt
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
