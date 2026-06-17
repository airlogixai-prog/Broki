"use client";

import { FilterBar } from "@/components/equipment/FilterBar";
import { EquipmentGrid } from "@/components/equipment/EquipmentGrid";
import { useApp } from "@/context/AppContext";
import { Airplane } from "@phosphor-icons/react";

export default function AvionesPage() {
  const { furgonetas, gse, avionFilter, setAvionFilter } = useApp();

  const all = [...furgonetas, ...gse];
  const planes = [...new Set(all.map((i) => i.plane).filter(Boolean))].sort();

  return (
    <div className="space-y-4 pb-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
        <Airplane size={28} /> Por Avión
      </h1>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setAvionFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            avionFilter === "all"
              ? "bg-brand-600 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          Todos
        </button>
        {planes.map((p) => (
          <button
            key={p}
            onClick={() => setAvionFilter(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              avionFilter === p
                ? "bg-brand-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <FilterBar />
      <EquipmentGrid items={all} />
    </div>
  );
}
