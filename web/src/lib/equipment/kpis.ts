import type { Equipment, IncidentState } from "../types/equipment.ts";
import { getFamily, getStatusCategory, toNumber } from "../mappers/equipment.ts";

/**
 * Single source of truth for fleet figures. Dashboard KPIs, analytics,
 * incidencias and the alert bell all derive from here so their numbers agree.
 * Rules mirror broki.html `updateKPIWidgets` / `getCriticalAlerts`.
 */

export const FUEL_CRITICAL_PCT = 25;
export const FUEL_NOTIFY_PCT = 10;
export const GPU_REFUEL_PCT = 50;
export const N2_LOW_PSI = 1000;
export const N2_CRITICAL_PSI = 500;

/** Equipment whose fuel level is operationally meaningful (legacy rule). */
export function usesFuel(item: Equipment): boolean {
  const family = getFamily(item);
  const model = (item.model ?? "").toUpperCase();
  const id = (item.id ?? "").toUpperCase();
  const motorizedPlatform =
    (family.includes("Plataforma") || model.includes("PLATAFORMA")) &&
    ["MOTORIZADA", "MOTOR", "ELEVADORA", "AUTOPROPULSADA", "DIESEL", "GASOLINA"].some((k) => model.includes(k));
  return (
    item.type === "furgo" ||
    family.includes("GPU") ||
    family.includes("Generador") ||
    ["GPU", "GENERADOR", "GRUPO", "CAMION", "CAMIÓN"].some((k) => model.includes(k)) ||
    id.includes("CAZA") ||
    motorizedPlatform
  );
}

export function hasFuelReading(item: Equipment): item is Equipment & { fuel: number } {
  return item.fuel !== null && item.fuel !== undefined && Number.isFinite(item.fuel);
}

export function isFuelCritical(item: Equipment, threshold = FUEL_CRITICAL_PCT): boolean {
  return hasFuelReading(item) && usesFuel(item) && toNumber(item.fuel) < threshold;
}

export function isNitrogen(item: Equipment): boolean {
  return getFamily(item).toUpperCase().includes("NITR");
}

/** Bottle readings that exist (null/undefined are unknown, not zero). */
export function nitrogenReadings(item: Equipment): number[] {
  const raw = [item.botella_1, item.botella_2, item.botella_3, item.botella_4];
  const explicit = raw.filter((v): v is number => v !== null && v !== undefined);
  if (explicit.length > 0) return explicit;
  return (item.pressures ?? []).filter((p) => Number.isFinite(p));
}

export function hasOpenIncident(item: Equipment, incidents: Record<string, IncidentState>): boolean {
  return !!incidents[item.id]?.current;
}

export interface FleetKpis {
  total: number;
  available: number;
  occupied: number;
  inoperative: number;
  unknown: number;
  /** available + occupied (legacy "Operativos"). */
  operative: number;
  /** inoperative ∪ open incident (legacy "Incidencias"/"Issues"). */
  withIssues: number;
  openIncidents: number;
  fuelCritical: number;
  /** 0-100, (total - withIssues) / total. */
  healthPct: number;
  pct: (n: number) => number;
}

export function computeFleetKpis(items: Equipment[], incidents: Record<string, IncidentState>): FleetKpis {
  const total = items.length;
  let available = 0, occupied = 0, inoperative = 0, unknown = 0, withIssues = 0, openIncidents = 0, fuelCritical = 0;
  for (const item of items) {
    const cat = getStatusCategory(item.status);
    if (cat === "available") available++;
    else if (cat === "occupied") occupied++;
    else if (cat === "inoperative") inoperative++;
    else unknown++;
    const open = hasOpenIncident(item, incidents);
    if (open) openIncidents++;
    if (cat === "inoperative" || open) withIssues++;
    if (isFuelCritical(item)) fuelCritical++;
  }
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  return {
    total,
    available,
    occupied,
    inoperative,
    unknown,
    operative: available + occupied,
    withIssues,
    openIncidents,
    fuelCritical,
    healthPct: total === 0 ? 0 : Math.round(((total - withIssues) / total) * 100),
    pct,
  };
}

/** Items listed on /broki/incidencias: open incident or inoperative status. */
export function splitIssues(items: Equipment[], incidents: Record<string, IncidentState>) {
  const withOpenIncident = items.filter((i) => hasOpenIncident(i, incidents));
  const inoperativeOnly = items.filter(
    (i) => getStatusCategory(i.status) === "inoperative" && !hasOpenIncident(i, incidents),
  );
  return { withOpenIncident, inoperativeOnly, total: withOpenIncident.length + inoperativeOnly.length };
}
