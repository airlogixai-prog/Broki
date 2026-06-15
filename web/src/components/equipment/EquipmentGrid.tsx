"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import type { Equipment } from "@/lib/types/equipment";
import { EquipmentCard } from "./EquipmentCard";
import { getFamily, getStatusCategory } from "@/lib/mappers/equipment";
import { useApp } from "@/context/AppContext";

interface Props {
  items: Equipment[];
  onSelect?: (item: Equipment) => void;
  sectionTitle?: string;
  sectionIcon?: React.ReactNode;
}

function applyFilters(
  items: Equipment[],
  filter: string,
  statusFilter: string,
  avionFilter: string,
  familyFilter: string
) {
  return items.filter((item) => {
    const searchStr =
      `${item.id} ${item.model} ${item.plate} ${item.location}`.toLowerCase();
    const matchSearch = !filter || searchStr.includes(filter.toLowerCase());
    const matchAvion = avionFilter === "all" || item.plane === avionFilter;
    const matchFamily =
      familyFilter === "all" || getFamily(item) === familyFilter;

    let matchStatus = true;
    const cat = getStatusCategory(item.status);
    if (statusFilter === "available") matchStatus = cat === "available";
    else if (statusFilter === "occupied") matchStatus = cat === "occupied";
    else if (statusFilter === "active")
      matchStatus = cat === "available" || cat === "occupied";
    else if (statusFilter === "issues") matchStatus = cat === "inoperative";

    return matchSearch && matchAvion && matchFamily && matchStatus;
  });
}

export function EquipmentGrid({ items, onSelect, sectionTitle, sectionIcon }: Props) {
  const { filter, statusFilter, avionFilter, familyFilter, compactMode } = useApp();

  const filtered = applyFilters(items, filter, statusFilter, avionFilter, familyFilter);

  if (filtered.length === 0) {
    return (
      <div className="col-span-full py-16 text-center">
        <div className="bg-slate-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
          <MagnifyingGlass size={32} className="text-slate-300 dark:text-slate-600" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">
          Sin resultados
        </h3>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Ajusta los filtros o la búsqueda
        </p>
      </div>
    );
  }

  const cols = compactMode
    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6";

  return (
    <div>
      {sectionTitle && (
        <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-200 dark:border-slate-600">
          {sectionIcon && <span className="text-slate-500">{sectionIcon}</span>}
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">
            {sectionTitle}
          </h3>
          <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">
            {filtered.length}
          </span>
        </div>
      )}
      <div className={`grid ${cols}`}>
        {filtered.map((item) => (
          <EquipmentCard key={item.id} item={item} onClick={onSelect} />
        ))}
      </div>
    </div>
  );
}
