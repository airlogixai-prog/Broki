"use client";

import { useState } from "react";
import { FilterBar } from "@/components/equipment/FilterBar";
import { EquipmentGrid } from "@/components/equipment/EquipmentGrid";
import { EquipmentDetailModal } from "@/components/modals/EquipmentDetailModal";
import { useApp } from "@/context/AppContext";
import { Van } from "@phosphor-icons/react";
import type { Equipment } from "@/lib/types/equipment";

export default function FurgonetasPage() {
  const { furgonetas } = useApp();
  const [selected, setSelected] = useState<Equipment | null>(null);
  return (
    <div className="space-y-4 pb-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
        <Van size={28} /> Furgonetas
      </h1>
      <FilterBar />
      <EquipmentGrid items={furgonetas} onSelect={setSelected} />
      <EquipmentDetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
