"use client";

import { useState } from "react";
import { EquipmentGrid } from "@/components/equipment/EquipmentGrid";
import { EquipmentDetailModal } from "@/components/modals/EquipmentDetailModal";
import { useApp } from "@/context/AppContext";
import { WarningOctagon, CheckCircle } from "@phosphor-icons/react";
import { getStatusCategory } from "@/lib/mappers/equipment";
import type { Equipment } from "@/lib/types/equipment";

export default function IncidenciasPage() {
  const { furgonetas, gse, incidentsMemory } = useApp();
  const [selected, setSelected] = useState<Equipment | null>(null);

  const all = [...furgonetas, ...gse];
  const withOpenIncident = all.filter((item) => !!incidentsMemory[item.id]?.current);
  const inoperative = all.filter(
    (item) =>
      getStatusCategory(item.status) === "inoperative" &&
      !incidentsMemory[item.id]?.current
  );

  const totalActive = withOpenIncident.length + inoperative.length;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <WarningOctagon size={28} className="text-red-500" /> Incidencias
        </h1>
        {totalActive > 0 && (
          <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-sm font-bold px-3 py-1 rounded-full border border-red-200 dark:border-red-800">
            {totalActive} activa{totalActive !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {totalActive === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={36} className="text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            ¡Todo perfecto!
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            No hay incidencias activas en este momento.
          </p>
        </div>
      )}

      {withOpenIncident.length > 0 && (
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-900 rounded-lg p-4 flex items-start gap-3">
            <WarningOctagon size={20} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-bold text-red-900 dark:text-red-200 text-sm">
                Incidencias Abiertas
              </h3>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                {withOpenIncident.length} equipo{withOpenIncident.length !== 1 ? "s" : ""} con
                incidencia activa abierta en el sistema.
              </p>
            </div>
          </div>
          <EquipmentGrid
            items={withOpenIncident}
            onSelect={setSelected}
            sectionTitle="Con incidencia abierta"
            sectionIcon={<WarningOctagon size={16} className="text-red-500" />}
          />
        </div>
      )}

      {inoperative.length > 0 && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900 rounded-lg p-4 flex items-start gap-3">
            <WarningOctagon size={20} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                Equipos Inoperativos
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {inoperative.length} equipo{inoperative.length !== 1 ? "s" : ""} marcado
                {inoperative.length !== 1 ? "s" : ""} como inoperativo sin incidencia registrada.
              </p>
            </div>
          </div>
          <EquipmentGrid
            items={inoperative}
            onSelect={setSelected}
            sectionTitle="Inoperativos sin incidencia"
            sectionIcon={<WarningOctagon size={16} className="text-amber-500" />}
          />
        </div>
      )}

      <EquipmentDetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
