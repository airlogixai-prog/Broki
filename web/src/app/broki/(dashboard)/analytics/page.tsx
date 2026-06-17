"use client";

import { Drop, Lightning, Gauge, CheckCircle } from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { getStatusCategory, getFamily } from "@/lib/mappers/equipment";
import type { Equipment } from "@/lib/types/equipment";

/* ── SVG Donut ────────────────────────────────────────── */
interface DonutSlice {
  value: number;
  color: string;
  label: string;
}

function DonutChart({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0)
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm italic">
        Sin datos
      </div>
    );

  const r = 70;
  const cx = 90;
  const cy = 90;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const paths = slices.map((s) => {
    const pct = s.value / total;
    const dash = pct * circ;
    const el = (
      <circle
        key={s.label}
        cx={cx}
        cy={cy}
        r={r}
        fill="transparent"
        stroke={s.color}
        strokeWidth={24}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={-offset}
        className="transition-all duration-500"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    );
    offset += dash;
    return el;
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 180 180" className="w-44 h-44">
        <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="currentColor" strokeWidth={24} className="text-slate-100 dark:text-slate-700" />
        {paths}
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-2xl font-bold fill-slate-900 dark:fill-white" style={{ fontSize: 22, fontWeight: 700, fill: "currentColor" }}>
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
          Total
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-3">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
            {s.label} <span className="font-bold text-slate-800 dark:text-slate-200">({s.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Polar / Bar horizontal ────────────────────────────── */
function FamilyBars({ items }: { items: Equipment[] }) {
  const counts: Record<string, number> = {};
  items.forEach((i) => {
    const f = getFamily(i);
    counts[f] = (counts[f] ?? 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map((e) => e[1]), 1);
  const COLORS = ["#3b82f6", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e", "#0ea5e9", "#10b981", "#f59e0b"];

  return (
    <div className="space-y-3">
      {entries.map(([name, count], i) => (
        <div key={name}>
          <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            <span className="truncate max-w-[180px]">{name}</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 ml-2">{count}</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${(count / max) * 100}%`, background: COLORS[i % COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Alert item ────────────────────────────────────────── */
interface Alert {
  id: string;
  model: string;
  val: string;
  msg: string;
  Icon: React.ElementType;
  colorCls: string;
}

function buildAlerts(furgonetas: Equipment[], gse: Equipment[]): Alert[] {
  const alerts: Alert[] = [];

  furgonetas.forEach((f) => {
    if (f.fuel != null && f.fuel < 25) {
      alerts.push({ id: f.id, model: f.model, val: `${f.fuel}%`, msg: "Combustible Crítico", Icon: Drop, colorCls: "text-red-600 bg-red-50 dark:bg-red-900/20" });
    }
  });

  gse.forEach((g) => {
    const fam = getFamily(g);
    if (fam === "GPUs y Generadores" && g.fuel != null && g.fuel < 50) {
      alerts.push({ id: g.id, model: g.model, val: `${g.fuel}%`, msg: "Repostaje Recomendado", Icon: Lightning, colorCls: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" });
    }
    if (fam === "Nitrógeno" && g.pressures?.length) {
      const low = g.pressures.filter((p) => p < 1000);
      if (low.length > 0) {
        alerts.push({ id: g.id, model: g.model, val: `${low.length} botellas`, msg: "Presión Baja (<1000 PSI)", Icon: Gauge, colorCls: "text-red-600 bg-red-50 dark:bg-red-900/20" });
      }
    }
  });

  return alerts;
}

/* ── KPI strip ─────────────────────────────────────────── */
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{label}</p>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const { furgonetas, gse, loading } = useApp();
  const all = [...furgonetas, ...gse];

  const available = all.filter((x) => getStatusCategory(x.status) === "available").length;
  const occupied  = all.filter((x) => getStatusCategory(x.status) === "occupied").length;
  const inop      = all.filter((x) => getStatusCategory(x.status) === "inoperative").length;
  const unknown   = all.filter((x) => getStatusCategory(x.status) === "unknown").length;

  const donutSlices: DonutSlice[] = [
    { value: available, color: "#10b981", label: "Disponibles" },
    { value: occupied,  color: "#f59e0b", label: "En Uso" },
    { value: inop,      color: "#ef4444", label: "Inoperativos" },
    ...(unknown > 0 ? [{ value: unknown, color: "#94a3b8", label: "Desconocido" }] : []),
  ];

  const alerts = buildAlerts(furgonetas, gse);

  return (
    <div className="space-y-8 pb-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total equipos" value={all.length}      color="#6366f1" />
        <StatCard label="Disponibles"   value={available}       color="#10b981" />
        <StatCard label="En Uso"        value={occupied}        color="#f59e0b" />
        <StatCard label="Inoperativos"  value={inop}            color="#ef4444" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status donut */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-5 text-sm uppercase tracking-wide">
            Estado de la Flota
          </h3>
          {loading && all.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-slate-400 text-sm">Cargando…</div>
          ) : (
            <DonutChart slices={donutSlices} />
          )}
        </div>

        {/* Family bars */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-5 text-sm uppercase tracking-wide">
            Distribución por Familia
          </h3>
          {loading && all.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-slate-400 text-sm">Cargando…</div>
          ) : (
            <FamilyBars items={all} />
          )}
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="font-bold text-slate-800 dark:text-white mb-5 text-sm uppercase tracking-wide flex items-center gap-2">
          <Gauge size={16} className="text-amber-500" /> Alertas de Flota
        </h3>

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-3">
              <CheckCircle size={28} className="text-emerald-500" />
            </div>
            <p className="font-medium text-slate-600 dark:text-slate-300">Sin Alertas Activas</p>
            <p className="text-xs text-slate-400 mt-1">Todos los niveles óptimos</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {alerts.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-600 hover:border-brand-200 dark:hover:border-brand-700 transition-colors"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${a.colorCls}`}>
                  <a.Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{a.id}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{a.model}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                    {a.val}
                  </span>
                  <p className="text-[10px] text-red-500 font-medium mt-0.5">{a.msg}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Furgonetas fuel strip */}
      {furgonetas.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-5 text-sm uppercase tracking-wide flex items-center gap-2">
            <Drop size={16} className="text-brand-500" /> Combustible Furgonetas
          </h3>
          <div className="space-y-3">
            {furgonetas
              .filter((f) => f.fuel != null)
              .sort((a, b) => (a.fuel ?? 0) - (b.fuel ?? 0))
              .map((f) => {
                const pct = f.fuel ?? 0;
                const color =
                  pct < 25 ? "#ef4444" : pct < 50 ? "#f59e0b" : "#10b981";
                return (
                  <div key={f.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-20 truncate shrink-0">
                      {f.id}
                    </span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                    <span className="text-xs font-bold w-10 text-right shrink-0" style={{ color }}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
