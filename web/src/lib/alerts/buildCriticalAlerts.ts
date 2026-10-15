import type { Equipment, IncidentState } from "../types/equipment.ts";
import { getStatusCategory } from "../mappers/equipment.ts";
import {
  FUEL_CRITICAL_PCT,
  N2_CRITICAL_PSI,
  hasOpenIncident,
  isFuelCritical,
  isNitrogen,
  nitrogenReadings,
} from "../equipment/kpis.ts";

export interface WeatherData {
  temp: number | string;
  qnh: number | string;
  wind: { dir: number; speed: number };
  raw: string;
}

export type AlertPriority = "critical" | "high" | "medium" | "low";
export type AlertType = "weather" | "fuel" | "incident" | "inoperative" | "nitrogen";

export interface CriticalAlert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  itemId?: string;
  itemType?: string;
}

/** Legacy summarised inoperative equipment above this count (broki.html getCriticalAlerts). */
export const INOPERATIVE_SUMMARY_THRESHOLD = 3;

/**
 * Bell alerts. Mirrors broki.html `getCriticalAlerts`: frost, fuel < 25 %,
 * open incidents, inoperative equipment (≤ 3 listed, > 3 summarised) and
 * nitrogen bottles with 0 < PSI < 500. Thresholds live in lib/equipment/kpis.
 */
export function buildCriticalAlerts(
  furgonetas: Equipment[],
  gse: Equipment[],
  incidentsMemory: Record<string, IncidentState>,
  weather?: WeatherData | null,
): CriticalAlert[] {
  const alerts: CriticalAlert[] = [];
  const allItems = [...furgonetas, ...gse];

  if (weather && typeof weather.temp === "number" && weather.temp <= 0) {
    alerts.push({
      id: "weather-freeze",
      type: "weather",
      priority: "critical",
      title: "Riesgo de congelación",
      message: `Temperatura: ${weather.temp} °C. Drenar agua de aeronaves.`,
    });
  }

  for (const item of allItems) {
    if (isFuelCritical(item, FUEL_CRITICAL_PCT)) {
      alerts.push({
        id: `fuel-${item.id}`,
        type: "fuel",
        priority: "high",
        title: `Combustible crítico: ${item.id}`,
        message: `${item.model} · ${item.fuel}% restante`,
        itemId: item.id,
        itemType: item.type,
      });
    }
  }

  for (const item of allItems) {
    const incident = incidentsMemory[item.id]?.current;
    if (!incident) continue;
    const lastMsg = incident.messages[incident.messages.length - 1]?.text ?? "Sin detalle";
    alerts.push({
      id: `incident-${item.id}`,
      type: "incident",
      priority: "critical",
      title: `Incidencia abierta: ${item.id}`,
      message: lastMsg,
      itemId: item.id,
      itemType: item.type,
    });
  }

  const inoperative = allItems.filter(
    (item) => getStatusCategory(item.status) === "inoperative" && !hasOpenIncident(item, incidentsMemory),
  );
  if (inoperative.length > INOPERATIVE_SUMMARY_THRESHOLD) {
    alerts.push({
      id: "inoperative-summary",
      type: "inoperative",
      priority: "high",
      title: `${inoperative.length} equipos inoperativos`,
      message: inoperative.map((i) => i.id).join(", "),
    });
  } else {
    for (const item of inoperative) {
      alerts.push({
        id: `inoperative-${item.id}`,
        type: "inoperative",
        priority: "high",
        title: `Inoperativo: ${item.id}`,
        message: `${item.model} · ${item.status}`,
        itemId: item.id,
        itemType: item.type,
      });
    }
  }

  for (const item of gse) {
    if (!isNitrogen(item)) continue;
    const low = nitrogenReadings(item).filter((p) => p > 0 && p < N2_CRITICAL_PSI);
    if (low.length === 0) continue;
    alerts.push({
      id: `nitrogen-${item.id}`,
      type: "nitrogen",
      priority: "high",
      title: `Presión N₂ baja: ${item.id}`,
      message: `${low.length} botella${low.length !== 1 ? "s" : ""} por debajo de ${N2_CRITICAL_PSI} PSI (${low.join(", ")})`,
      itemId: item.id,
      itemType: item.type,
    });
  }

  const order: Record<AlertPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return alerts.sort((a, b) => order[a.priority] - order[b.priority]);
}
