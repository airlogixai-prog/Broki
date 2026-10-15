"use client";

import { useMemo } from "react";
import { CheckCircle, Gauge } from "@phosphor-icons/react";
import { getFamily } from "@/lib/mappers/equipment";
import type { Equipment } from "@/lib/types/equipment";
import type { FleetAlert } from "@/lib/analytics/fleetAlerts";
import { Card } from "@/components/ui/Card";

export type { FleetAlert } from "@/lib/analytics/fleetAlerts";
export { buildFleetAlerts } from "@/lib/analytics/fleetAlerts";

export interface DonutSlice {
  value: number;
  /** CSS colour (token var or hex). */
  color: string;
  label: string;
}

function arcOffsets(lengths: number[]): number[] {
  const offsets: number[] = [];
  let running = 0;
  for (const length of lengths) {
    offsets.push(running);
    running += length;
  }
  return offsets;
}

export function DonutChart({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <div className="flex h-48 items-center justify-center text-sm text-fg-muted">Sin datos</div>;

  const r = 70;
  const cx = 90;
  const cy = 90;
  const circ = 2 * Math.PI * r;
  const offsets = arcOffsets(slices.map((s) => (s.value / total) * circ));
  const summary = slices.map((s) => `${s.label} ${s.value}`).join(", ");

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 180 180" className="h-44 w-44" role="img" aria-label={`Estado de la flota: ${summary}`}>
        <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="var(--broki-bg-subtle)" strokeWidth={24} />
        {slices.map((s, i) => {
          const dash = (s.value / total) * circ;
          return (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="transparent"
              stroke={s.color}
              strokeWidth={24}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offsets[i]}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: 22, fontWeight: 700, fill: "var(--broki-text)" }}>
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 10, fill: "var(--broki-text-subtle)", fontWeight: 600 }}>
          TOTAL
        </text>
      </svg>
      <ul className="flex flex-wrap justify-center gap-3">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label} <span className="tabular font-bold text-fg">({s.value}{total ? ` · ${Math.round((s.value / total) * 100)} %` : ""})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FamilyBars({ items }: { items: Equipment[] }) {
  const entries = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((i) => {
      const f = getFamily(i);
      counts[f] = (counts[f] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [items]);

  if (entries.length === 0) return <div className="flex h-48 items-center justify-center text-sm text-fg-muted">Sin datos</div>;
  const max = Math.max(...entries.map((e) => e[1]), 1);

  return (
    <ul className="space-y-3" aria-label="Distribución por familia">
      {entries.map(([name, count]) => (
        <li key={name}>
          <div className="mb-1 flex justify-between text-xs font-medium text-fg-muted">
            <span className="max-w-[200px] truncate">{name}</span>
            <span className="tabular ml-2 font-bold text-fg">{count}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-subtle" role="presentation">
            <div className="h-2.5 rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${(count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FleetAlertsPanel({ alerts, onSelect }: { alerts: FleetAlert[]; onSelect?: (id: string) => void }) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success-muted text-success" aria-hidden>
          <CheckCircle size={28} />
        </div>
        <p className="font-medium text-fg">Sin alertas de flota</p>
        <p className="mt-1 text-xs text-fg-muted">Combustible y presiones dentro de umbrales.</p>
      </div>
    );
  }

  return (
    <ul className="max-h-72 space-y-2 overflow-y-auto">
      {alerts.map((a) => (
        <li key={`${a.id}-${a.msg}`}>
          <button
            type="button"
            onClick={() => onSelect?.(a.id)}
            className="flex w-full items-center gap-4 rounded-lg border border-border-subtle bg-muted p-3 text-left hover:border-brand-300"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${a.tone === "danger" ? "bg-danger-muted text-danger-strong" : "bg-warning-muted text-warning-strong"}`} aria-hidden>
              <a.Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-fg">{a.id}</span>
              <span className="block truncate text-xs text-fg-muted">{a.model}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="tabular inline-block rounded bg-subtle px-2 py-0.5 text-xs font-bold text-fg">{a.val}</span>
              <span className={`mt-0.5 block text-[11px] font-medium ${a.tone === "danger" ? "text-danger-strong" : "text-warning-strong"}`}>{a.msg}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

type PanelProps = {
  donutSlices: DonutSlice[];
  all: Equipment[];
  alerts: FleetAlert[];
  loading: boolean;
  onAlertSelect: (id: string) => void;
};

export default function AnalyticsChartsPanel({ donutSlices, all, alerts, loading, onAlertSelect }: PanelProps) {
  const loader = <div className="flex h-44 items-center justify-center text-sm text-fg-muted">Cargando…</div>;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Estado de la flota">{loading ? loader : <DonutChart slices={donutSlices} />}</Card>
        <Card title="Distribución por familia">{loading ? loader : <FamilyBars items={all} />}</Card>
      </div>
      <Card
        title={
          <span className="flex items-center gap-2">
            <Gauge size={16} className="text-warning" aria-hidden /> Alertas de flota
          </span>
        }
      >
        <FleetAlertsPanel alerts={alerts} onSelect={onAlertSelect} />
      </Card>
    </>
  );
}
