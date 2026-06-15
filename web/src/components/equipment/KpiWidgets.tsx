"use client";

import { Wrench, Warning, Clock, Drop, Gauge, TrendUp } from "@phosphor-icons/react";
import { getStatusCategory } from "@/lib/mappers/equipment";
import { useApp } from "@/context/AppContext";

export function KpiWidgets() {
  const { furgonetas, gse, incidentsMemory } = useApp();

  const all = [...furgonetas, ...gse];
  const total = all.length;
  if (total === 0) return null;

  let operative = 0, withIssues = 0, inUse = 0, lowFuel = 0;
  all.forEach((item) => {
    const cat = getStatusCategory(item.status);
    const hasOpen = !!incidentsMemory[item.id]?.current;
    if (cat === "available" || cat === "occupied") operative++;
    if (cat === "inoperative" || hasOpen) withIssues++;
    if (cat === "occupied") inUse++;
    if (item.fuel !== null && item.fuel !== undefined && item.fuel < 25) lowFuel++;
  });

  const pct = (n: number) => Math.round((n / total) * 100) + "%";
  const health = Math.round(((total - withIssues) / total) * 100) + "%";

  const cards = [
    {
      label: "Total Equipos",
      value: total,
      sub: null,
      Icon: Wrench,
      color: "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
    },
    {
      label: "Operativos",
      value: operative,
      sub: pct(operative),
      Icon: TrendUp,
      color: "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Issues",
      value: withIssues,
      sub: pct(withIssues),
      Icon: Warning,
      color: "bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400",
      valueColor: "text-red-600 dark:text-red-400",
    },
    {
      label: "En Uso",
      value: inUse,
      sub: pct(inUse),
      Icon: Clock,
      color: "bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Comb. Bajo",
      value: lowFuel,
      sub: null,
      Icon: Drop,
      color: "bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400",
    },
    {
      label: "Salud Flota",
      value: health,
      sub: null,
      Icon: Gauge,
      color: "bg-teal-50 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map(({ label, value, sub, Icon, color, valueColor }) => (
        <div
          key={label}
          className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-3"
        >
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">
              {label}
            </p>
            <p className={`text-xl font-bold text-slate-900 dark:text-white ${valueColor ?? ""}`}>
              {value}
            </p>
            {sub && (
              <p className="text-[10px] text-slate-400">{sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
