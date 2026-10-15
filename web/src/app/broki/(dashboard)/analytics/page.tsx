"use client";

import dynamic from "next/dynamic";
import { ChartPieSlice, Drop, Wrench, CheckCircle, Clock, Prohibit, WarningOctagon } from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { openEquipment } from "@/lib/hooks/useEquipmentModal";
import { BlockSkeleton } from "@/components/ui/BlockSkeleton";
import { buildFleetAlerts } from "@/lib/analytics/fleetAlerts";
import { computeFleetKpis, usesFuel, hasFuelReading, FUEL_CRITICAL_PCT, GPU_REFUEL_PCT } from "@/lib/equipment/kpis";
import type { DonutSlice } from "@/components/analytics/AnalyticsCharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";

const AnalyticsCharts = dynamic(() => import("@/components/analytics/AnalyticsCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <BlockSkeleton className="h-64" />
      <BlockSkeleton className="h-64" />
    </div>
  ),
});

/** Analytics derives every figure from computeFleetKpis, same as the dashboard. */
export default function AnalyticsPage() {
  const { furgonetas, gse, incidentsMemory, loading, fetchError, refreshRef } = useApp();
  const all = [...furgonetas, ...gse];
  const k = computeFleetKpis(all, incidentsMemory);

  const donutSlices: DonutSlice[] = [
    { value: k.available, color: "var(--broki-success)", label: "Disponibles" },
    { value: k.occupied, color: "var(--broki-warning)", label: "En uso" },
    { value: k.inoperative, color: "var(--broki-danger)", label: "Inoperativos" },
    ...(k.unknown > 0 ? [{ value: k.unknown, color: "var(--broki-neutral)", label: "Sin estado" }] : []),
  ];

  const alerts = buildFleetAlerts(furgonetas, gse);
  const fuelItems = all
    .filter((i): i is typeof i & { fuel: number } => usesFuel(i) && hasFuelReading(i))
    .sort((a, b) => a.fuel - b.fuel);
  const noReading = all.filter((i) => usesFuel(i) && !hasFuelReading(i)).length;

  const openById = (id: string) => {
    const item = all.find((i) => i.id === id);
    if (item) openEquipment(item);
  };

  const initial = loading && all.length === 0;

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="Analítica" subtitle="Indicadores derivados del inventario en tiempo real" icon={<ChartPieSlice size={22} />} />

      {fetchError && <ErrorState message={fetchError} onRetry={() => refreshRef.current?.()} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {initial ? (
          Array.from({ length: 6 }).map((_, i) => <BlockSkeleton key={i} className="h-16" label="Cargando KPI" />)
        ) : (
          <>
            <KpiCard label="Total equipos" value={k.total} icon={<Wrench size={18} />} tone="brand" />
            <KpiCard label="Disponibles" value={k.available} sub={`${k.pct(k.available)} %`} icon={<CheckCircle size={18} />} tone="success" />
            <KpiCard label="En uso" value={k.occupied} sub={`${k.pct(k.occupied)} %`} icon={<Clock size={18} />} tone="warning" />
            <KpiCard label="Inoperativos" value={k.inoperative} sub={`${k.pct(k.inoperative)} %`} icon={<Prohibit size={18} />} tone="danger" />
            <KpiCard label="Con incidencia" value={k.withIssues} sub={`${k.pct(k.withIssues)} %`} icon={<WarningOctagon size={18} />} tone="danger" emphasis={k.withIssues > 0} />
            <KpiCard label="Salud flota" value={`${k.healthPct} %`} icon={<ChartPieSlice size={18} />} tone={k.healthPct >= 80 ? "success" : k.healthPct >= 60 ? "warning" : "danger"} emphasis />
          </>
        )}
      </div>

      <AnalyticsCharts donutSlices={donutSlices} all={all} alerts={alerts} loading={initial} onAlertSelect={openById} />

      <Card
        title={
          <span className="flex items-center gap-2">
            <Drop size={16} className="text-brand-500" aria-hidden /> Combustible (furgonetas, GPU y motorizados)
          </span>
        }
        actions={noReading > 0 ? <span className="text-xs text-fg-muted">{noReading} sin lectura</span> : undefined}
      >
        {fuelItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-muted">Sin lecturas de combustible.</p>
        ) : (
          <ul className="space-y-2.5">
            {fuelItems.map((f) => {
              const pct = f.fuel;
              const threshold = f.type === "furgo" ? FUEL_CRITICAL_PCT : GPU_REFUEL_PCT;
              const tone = pct < FUEL_CRITICAL_PCT ? "bg-danger" : pct < threshold || pct < 50 ? "bg-warning" : "bg-success";
              const text = pct < FUEL_CRITICAL_PCT ? "text-danger-strong" : pct < 50 ? "text-warning-strong" : "text-success-strong";
              return (
                <li key={f.id}>
                  <button type="button" onClick={() => openEquipment(f)} className="flex w-full items-center gap-3 text-left hover:opacity-80" aria-label={`${f.id}: ${pct} % de combustible`}>
                    <span className="w-24 shrink-0 truncate text-xs font-bold text-fg">{f.id}</span>
                    <span className="h-3 flex-1 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <span className={`block h-3 rounded-full ${tone}`} style={{ width: `${pct}%` }} />
                    </span>
                    <span className={`tabular w-12 shrink-0 text-right text-xs font-bold ${text}`}>{pct} %</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
