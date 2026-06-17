"use client";

import { useState } from "react";
import { KpiWidgets } from "@/components/equipment/KpiWidgets";
import { FilterBar } from "@/components/equipment/FilterBar";
import { EquipmentGrid } from "@/components/equipment/EquipmentGrid";
import { EquipmentDetailModal } from "@/components/modals/EquipmentDetailModal";
import { LemdWeatherWidget } from "@/components/weather/LemdWeatherWidget";
import { useApp } from "@/context/AppContext";
import { Van, Wrench, ArrowsClockwise, WarningCircle } from "@phosphor-icons/react";
import type { Equipment } from "@/lib/types/equipment";

export default function DashboardPage() {
  const { furgonetas, gse, loading, fetchError, refreshRef } = useApp();
  const [selected, setSelected] = useState<Equipment | null>(null);

  if (loading && furgonetas.length === 0 && gse.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <ArrowsClockwise size={40} className="text-brand-500 animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          Cargando datos...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {fetchError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3"
        >
          <WarningCircle
            size={20}
            className="text-red-500 shrink-0 mt-0.5"
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">
              Error al cargar datos
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5 break-words">
              {fetchError}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refreshRef.current?.()}
            className="shrink-0 text-xs font-bold text-red-700 dark:text-red-300 hover:underline"
          >
            Reintentar
          </button>
        </div>
      )}
      <LemdWeatherWidget />
      <KpiWidgets />
      <FilterBar />

      {furgonetas.length > 0 && (
        <EquipmentGrid
          items={furgonetas}
          sectionTitle="Furgonetas"
          sectionIcon={<Van size={20} />}
          onSelect={setSelected}
        />
      )}

      {gse.length > 0 && (
        <div className="mt-8">
          <EquipmentGrid
            items={gse}
            sectionTitle="Equipos GSE"
            sectionIcon={<Wrench size={20} />}
            onSelect={setSelected}
          />
        </div>
      )}

      {furgonetas.length === 0 && gse.length === 0 && !loading && (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          No hay datos disponibles. Comprueba la conexión.
        </div>
      )}

      <EquipmentDetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
