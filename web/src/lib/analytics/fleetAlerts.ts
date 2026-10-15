import type { ElementType } from "react";
import { Drop, Lightning, Gauge } from "@phosphor-icons/react";
import { getFamily } from "@/lib/mappers/equipment";
import type { Equipment } from "@/lib/types/equipment";
import { FUEL_CRITICAL_PCT, GPU_REFUEL_PCT, N2_LOW_PSI, isNitrogen, nitrogenReadings } from "@/lib/equipment/kpis";

export interface FleetAlert {
  id: string;
  model: string;
  val: string;
  msg: string;
  Icon: ElementType;
  tone: "danger" | "warning";
}

/** Analytics "Alertas de flota" list (legacy): van fuel < 25, GPU < 50, N₂ < 1000 PSI. */
export function buildFleetAlerts(furgonetas: Equipment[], gse: Equipment[]): FleetAlert[] {
  const alerts: FleetAlert[] = [];
  furgonetas.forEach((f) => {
    if (f.fuel != null && f.fuel < FUEL_CRITICAL_PCT) {
      alerts.push({ id: f.id, model: f.model, val: `${f.fuel}%`, msg: "Combustible crítico", Icon: Drop, tone: "danger" });
    }
  });
  gse.forEach((g) => {
    const fam = getFamily(g);
    if (fam === "GPUs y Generadores" && g.fuel != null && g.fuel < GPU_REFUEL_PCT) {
      alerts.push({ id: g.id, model: g.model, val: `${g.fuel}%`, msg: "Repostaje recomendado", Icon: Lightning, tone: "warning" });
    }
    if (isNitrogen(g)) {
      const low = nitrogenReadings(g).filter((p) => p > 0 && p < N2_LOW_PSI);
      if (low.length > 0) {
        alerts.push({ id: g.id, model: g.model, val: `${low.length} botella${low.length !== 1 ? "s" : ""}`, msg: `Presión baja (< ${N2_LOW_PSI} PSI)`, Icon: Gauge, tone: "danger" });
      }
    }
  });
  return alerts;
}
