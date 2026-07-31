"use client";

import { useState, type ReactNode } from "react";
import { FilterBar } from "@/components/equipment/FilterBar";
import { EquipmentGrid } from "@/components/equipment/EquipmentGrid";
import { EquipmentDetailModal } from "@/components/modals/EquipmentDetailModal";
import type { Equipment } from "@/lib/types/equipment";

type Props = {
  title: string;
  icon: ReactNode;
  items: Equipment[];
};

export function EquipmentListPage({ title, icon, items }: Props) {
  const [selected, setSelected] = useState<Equipment | null>(null);
  return (
    <div className="space-y-4 pb-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
        {icon} {title}
      </h1>
      <FilterBar />
      <EquipmentGrid items={items} onSelect={setSelected} />
      <EquipmentDetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
