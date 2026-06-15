"use client";

import { useState } from "react";
import { KpiWidgets } from "@/components/equipment/KpiWidgets";
import { FilterBar } from "@/components/equipment/FilterBar";
import { EquipmentGrid } from "@/components/equipment/EquipmentGrid";
import { EquipmentDetailModal } from "@/components/modals/EquipmentDetailModal";
import { useApp } from "@/context/AppContext";
import { Van, Wrench, ArrowsClockwise } from "@phosphor-icons/react";
import type { Equipment } from "@/lib/types/equipment";

export default function DashboardPage() {
  const { furgonetas, gse, loading } = useApp();
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
