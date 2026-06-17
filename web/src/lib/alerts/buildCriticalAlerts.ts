import type { Equipment, IncidentState } from "@/lib/types/equipment";
import { getFamily, toNumber } from "@/lib/mappers/equipment";

export interface WeatherData {
  temp: number | string;
  qnh: number | string;
  wind: { dir: number; speed: number };
  raw: string;
}

export type AlertPriority = "critical" | "high" | "medium" | "low";

export interface CriticalAlert {
  id: string;
  type: "weather" | "fuel" | "incident";
  priority: AlertPriority;
  title: string;
  message: string;
  itemId?: string;
  itemType?: string;
}

function usesFuel(item: Equipment): boolean {
  const family = getFamily(item);
  const modelUpper = (item.model ?? "").toUpperCase();
  const idUpper = (item.id ?? "").toUpperCase();
  const isMotorizedPlatform =
    (family.includes("Plataforma") || modelUpper.includes("PLATAFORMA")) &&
    (modelUpper.includes("MOTORIZADA") ||
      modelUpper.includes("MOTOR") ||
      modelUpper.includes("DIESEL"));
  return (
    item.type === "furgo" ||
    family.includes("GPU") ||
    family.includes("Generador") ||
    modelUpper.includes("GPU") ||
    modelUpper.includes("CAMION") ||
    idUpper.includes("CAZA") ||
    isMotorizedPlatform
  );
}

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
      title: "Riesgo de Congelación",
      message: `Temperatura: ${weather.temp}°C. DRENAR AGUA DE AERONAVES.`,
    });
  }

  allItems
    .filter(
      (item) =>
        item.fuel != null && usesFuel(item) && toNumber(item.fuel) < 25,
    )
    .forEach((item) => {
      alerts.push({
        id: `fuel-${item.id}`,
        type: "fuel",
        priority: "high",
        title: `Combustible Crítico: ${item.id}`,
        message: `${item.model} · ${item.fuel}% restante`,
        itemId: item.id,
        itemType: item.type,
      });
    });

  allItems.forEach((item) => {
    const incident = incidentsMemory[item.id]?.current;
    if (!incident) return;
    const lastMsg =
      incident.messages[incident.messages.length - 1]?.text ?? "Sin detalle";
    alerts.push({
      id: `incident-${item.id}`,
      type: "incident",
      priority: "critical",
      title: `Incidencia Abierta: ${item.id}`,
      message: lastMsg,
      itemId: item.id,
      itemType: item.type,
    });
  });

  const order: Record<AlertPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return alerts.sort((a, b) => order[a.priority] - order[b.priority]);
}
