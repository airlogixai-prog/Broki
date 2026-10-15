"use client";

import { useEffect, useState } from "react";
import { fetchLemdWeather } from "@/lib/api/weather";
import type { WeatherData } from "@/lib/alerts/buildCriticalAlerts";

const TTL_MS = 10 * 60_000;

let cache: { at: number; data: WeatherData } | null = null;
let inFlight: Promise<WeatherData> | null = null;

function isFresh(): boolean {
  return !!cache && Date.now() - cache.at < TTL_MS;
}

/** One Open-Meteo request shared by the widget and the alert bell (10 min cache). */
export function useLemdWeather(): { weather: WeatherData | null; loading: boolean } {
  const [weather, setWeather] = useState<WeatherData | null>(() => (isFresh() ? cache!.data : null));
  const [loading, setLoading] = useState(() => !isFresh());

  useEffect(() => {
    let active = true;
    // Fresh cache was already picked up by the lazy initialisers above.
    if (isFresh()) return;
    inFlight ??= fetchLemdWeather().then((data) => {
      cache = { at: Date.now(), data };
      inFlight = null;
      return data;
    });
    void inFlight.then((data) => {
      if (!active) return;
      setWeather(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { weather, loading };
}
