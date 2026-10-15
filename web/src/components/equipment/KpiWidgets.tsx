"use client";

import { useRouter } from "next/navigation";
import { Wrench, Warning, Clock, Drop, Gauge, TrendUp } from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { computeFleetKpis } from "@/lib/equipment/kpis";
import { KpiCard } from "@/components/ui/KpiCard";

/**
 * Six fleet KPIs (legacy `updateKPIWidgets`). Every figure comes from
 * computeFleetKpis so the dashboard, analytics, incidencias and the bell agree.
 * Tiles act as filters: operativos / en uso narrow the grid, issues opens the
 * incidents page, health opens incidents too (legacy "Salud Flota" link).
 */
export function KpiWidgets() {
  const { furgonetas, gse, incidentsMemory, statusFilter, setStatusFilter } = useApp();
  const router = useRouter();
  const k = computeFleetKpis([...furgonetas, ...gse], incidentsMemory);
  if (k.total === 0) return null;

  const toggle = (value: string) => setStatusFilter(statusFilter === value ? "all" : value);
  const healthTone = k.healthPct >= 80 ? "success" : k.healthPct >= 60 ? "warning" : "danger";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores de flota">
      <KpiCard label="Total equipos" value={k.total} icon={<Wrench size={18} />} tone="brand" onClick={() => setStatusFilter("all")} />
      <KpiCard
        label="Operativos"
        value={k.operative}
        sub={`${k.pct(k.operative)} %`}
        icon={<TrendUp size={18} />}
        tone="success"
        onClick={() => toggle("active")}
      />
      <KpiCard
        label="Con incidencia"
        value={k.withIssues}
        sub={`${k.pct(k.withIssues)} %`}
        icon={<Warning size={18} />}
        tone="danger"
        emphasis={k.withIssues > 0}
        onClick={() => router.push("/broki/incidencias")}
      />
      <KpiCard
        label="En uso"
        value={k.occupied}
        sub={`${k.pct(k.occupied)} %`}
        icon={<Clock size={18} />}
        tone="warning"
        onClick={() => toggle("occupied")}
      />
      <KpiCard
        label="Combustible bajo"
        value={k.fuelCritical}
        sub="< 25 %"
        icon={<Drop size={18} />}
        tone={k.fuelCritical > 0 ? "warning" : "neutral"}
        emphasis={k.fuelCritical > 0}
        onClick={() => router.push("/broki/analytics")}
      />
      <KpiCard
        label="Salud flota"
        value={`${k.healthPct} %`}
        icon={<Gauge size={18} />}
        tone={healthTone}
        emphasis
        onClick={() => router.push("/broki/incidencias")}
      />
    </div>
  );
}
