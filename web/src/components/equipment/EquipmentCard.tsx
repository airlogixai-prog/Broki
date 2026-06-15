"use client";

import { Airplane, MapPin, User, GasPump, Wrench, Van, Warning } from "@phosphor-icons/react";
import { getStatusClass, getStatusCategory } from "@/lib/mappers/equipment";
import type { Equipment } from "@/lib/types/equipment";
import { useApp } from "@/context/AppContext";

const FAMILY_ICONS: Record<string, React.ElementType> = {
  Nitrógeno: GasPump,
  Oxígeno: GasPump,
  default: Wrench,
};

function FamilyIcon({ family }: { family: string }) {
  const Icon = FAMILY_ICONS[family] ?? FAMILY_ICONS.default;
  return <Icon size={18} />;
}

function NitrogenBottles({ pressures }: { pressures: number[] }) {
  return (
    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700 w-full">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
        Presión Botellas (PSI)
      </p>
      <div className="flex gap-2 justify-between">
        {pressures.map((p, i) => {
          const color =
            p > 1500
              ? "bg-emerald-500"
              : p > 500
              ? "bg-amber-500"
              : "bg-red-500";
          const height = Math.max(10, (p / 3000) * 100);
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-md h-12 relative flex items-end overflow-hidden border border-slate-200 dark:border-slate-600">
                <div
                  className={`${color} w-full opacity-80 transition-all`}
                  style={{ height: `${height}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300 z-10">
                  {p}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 font-medium">#{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FuelBar({ fuel }: { fuel: number }) {
  const color =
    fuel > 70
      ? "bg-emerald-500"
      : fuel > 30
      ? "bg-amber-500"
      : "bg-red-500";
  return (
    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700 w-full">
      <div className="flex justify-between items-end mb-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Combustible
        </span>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          {fuel}%
        </span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <div
          className={`${color} h-1.5 rounded-full transition-all duration-500`}
          style={{ width: `${fuel}%` }}
        />
      </div>
    </div>
  );
}

interface Props {
  item: Equipment;
  onClick?: (item: Equipment) => void;
}

export function EquipmentCard({ item, onClick }: Props) {
  const { incidentsMemory } = useApp();
  const hasIncident = !!incidentsMemory[item.id]?.current;
  const borderClass = hasIncident
    ? "border-red-500 shadow-red-100 dark:shadow-red-900/20"
    : "border-slate-200 dark:border-slate-600";
  const statusClass = getStatusClass(item.status);

  return (
    <div
      onClick={() => onClick?.(item)}
      className={`group card-hoverable equipment-card bg-white dark:bg-slate-800 rounded-xl p-4 border ${borderClass} shadow-sm flex flex-col h-full relative overflow-hidden cursor-pointer hover:border-brand-300 dark:hover:border-brand-500 transition-colors`}
    >
      {hasIncident && (
        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-bl-lg z-20 animate-pulse" />
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="shrink-0 h-10 w-10 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-center border border-slate-100 dark:border-slate-600 text-slate-500 dark:text-slate-400 group-hover:bg-brand-50 dark:group-hover:bg-slate-600 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {item.type === "furgo" ? <Van size={20} /> : <FamilyIcon family={item.family} />}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-white leading-tight text-lg truncate flex items-center gap-2">
              {item.id}
              {hasIncident && (
                <Warning size={14} className="text-red-500 animate-pulse" />
              )}
            </h3>
            <p
              className="text-xs text-slate-500 dark:text-slate-400 truncate"
              title={item.model}
            >
              {item.model || "Sin detalle"}
            </p>
          </div>
        </div>

        <div className="shrink-0 h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-center border border-slate-100 dark:border-slate-600 text-slate-400 dark:text-slate-500">
          <FamilyIcon family={item.family} />
        </div>
      </div>

      {/* Status + location + worker */}
      <div className="space-y-1.5 mb-3 flex-1">
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border shadow-sm block w-full text-center ${statusClass}`}
        >
          {item.status}
        </span>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 pt-1">
          <MapPin size={14} className="text-slate-400 shrink-0" />
          <span className="truncate font-medium">
            {item.location || item.parking}
          </span>
        </div>
        {item.worker && (
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <User size={14} className="text-slate-400 shrink-0" />
            <span className="truncate">{item.worker}</span>
          </div>
        )}
      </div>

      {/* Plane tag */}
      {item.plane ? (
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-100 dark:border-blue-800 w-full justify-center">
          <Airplane size={14} />
          {item.plane}
        </div>
      ) : (
        <div className="mt-2 h-7" />
      )}

      {/* Footer */}
      {item.type === "furgo" && item.fuel !== null && item.fuel !== undefined && (
        <FuelBar fuel={item.fuel} />
      )}
      {item.family === "Nitrógeno" && item.pressures.length > 0 && (
        <NitrogenBottles pressures={item.pressures} />
      )}
    </div>
  );
}
