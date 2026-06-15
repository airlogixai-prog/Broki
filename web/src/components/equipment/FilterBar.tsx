"use client";

import { useApp } from "@/context/AppContext";
import { getFamily } from "@/lib/mappers/equipment";

export function FilterBar() {
  const {
    avionFilter,
    setAvionFilter,
    statusFilter,
    setStatusFilter,
    familyFilter,
    setFamilyFilter,
    furgonetas,
    gse,
    aircraft,
  } = useApp();

  const all = [...furgonetas, ...gse];

  const planes = [
    "all",
    ...[...new Set(all.map((i) => i.plane).filter(Boolean))].sort(),
  ];

  const families = [
    "all",
    ...[...new Set(all.map((i) => getFamily(i)))].sort(),
  ];

  const statuses = [
    { value: "all", label: "Todos" },
    { value: "available", label: "Disponible" },
    { value: "occupied", label: "En Uso" },
    { value: "active", label: "Activos" },
    { value: "issues", label: "Issues" },
  ];

  const select =
    "text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className={select}
      >
        {statuses.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        value={avionFilter}
        onChange={(e) => setAvionFilter(e.target.value)}
        className={select}
      >
        {planes.map((p) => (
          <option key={p} value={p}>
            {p === "all" ? "Todos los aviones" : p}
          </option>
        ))}
      </select>

      <select
        value={familyFilter}
        onChange={(e) => setFamilyFilter(e.target.value)}
        className={select}
      >
        {families.map((f) => (
          <option key={f} value={f}>
            {f === "all" ? "Todas las familias" : f}
          </option>
        ))}
      </select>

      {(statusFilter !== "all" || avionFilter !== "all" || familyFilter !== "all") && (
        <button
          onClick={() => {
            setStatusFilter("all");
            setAvionFilter("all");
            setFamilyFilter("all");
          }}
          className="text-xs text-brand-600 dark:text-brand-400 hover:underline px-2"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
