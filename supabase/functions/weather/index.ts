import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";

const LEMD_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=40.49&longitude=-3.56&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m&daily=temperature_2m_min,temperature_2m_max&timezone=Europe/Madrid&wind_speed_unit=kn&forecast_days=2";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  try {
    const res = await fetch(LEMD_URL, {
      headers: { Accept: "application/json" },
    });
    const data = await res.json();
    const curr = data.current ?? {};
    const temp = Math.round(curr.temperature_2m ?? 0);
    const qnh = Math.round(curr.surface_pressure ?? 0);
    const windDir = curr.wind_direction_10m ?? 0;
    const windSpeed = Math.round(curr.wind_speed_10m ?? 0);

    return jsonResponse(req, {
      temp,
      qnh,
      wind: { dir: windDir, speed: windSpeed },
      raw: `LEMD ${temp}°C WIND ${windDir}°/${windSpeed}KT`,
    });
  } catch {
    return jsonResponse(req, {
      temp: "--",
      qnh: "----",
      wind: { dir: 0, speed: 0 },
      raw: "WEATHER UNAVAILABLE",
    });
  }
});
