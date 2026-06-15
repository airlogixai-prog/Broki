"use client";

import { CheckCircle, WarningCircle, PencilSimple, FloppyDisk } from "@phosphor-icons/react";

interface Props {
  name: string;
  locationId: string;
  full: number;
  empty: number;
  color: "brand" | "blue";
  editing: boolean;
  onFullChange: (v: number) => void;
  onEmptyChange: (v: number) => void;
}

export function NitroStockCard({
  name,
  locationId,
  full,
  empty,
  color,
  editing,
  onFullChange,
  onEmptyChange,
}: Props) {
  const total = full + empty;
  const pct = total > 0 ? Math.round((full / total) * 100) : 0;
  const circumference = 251.2;
  const offset = circumference - (circumference * pct) / 100;

  const ringColor =
    color === "brand"
      ? "text-brand-500 dark:text-brand-400"
      : "text-blue-500 dark:text-blue-400";
  const ringBg =
    color === "brand"
      ? "text-brand-100 dark:text-brand-900/30"
      : "text-blue-100 dark:text-blue-900/30";
  const barColor =
    color === "brand" ? "bg-brand-500" : "bg-blue-500";
  const themeText =
    color === "brand"
      ? "text-brand-600 dark:text-brand-400"
      : "text-blue-600 dark:text-blue-400";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
      <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-9xl ${themeText}`}>
        N₂
      </div>

      <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 relative z-10">
        <span className={`w-1 h-6 rounded-full ${barColor}`} />
        {name}
      </h4>

      <div className="flex items-center gap-8 relative z-10">
        {/* Circular gauge */}
        <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="48" cy="48" r="40"
              strokeWidth="8" fill="transparent"
              stroke="currentColor" className={ringBg}
            />
            <circle
              cx="48" cy="48" r="40"
              strokeWidth="8" fill="transparent"
              stroke="currentColor" className={ringColor}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-800 dark:text-white">
            <span className="text-xl font-bold">{pct}%</span>
            <span className="text-[10px] uppercase text-slate-400 font-bold">Llenas</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-3">
          <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-md">
                <CheckCircle size={16} weight="fill" />
              </div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Llenas</span>
            </div>
            {editing ? (
              <input
                type="number"
                min={0}
                value={full}
                onChange={(e) => onFullChange(Number(e.target.value))}
                className="w-20 text-center font-bold text-lg border-b-2 border-slate-300 dark:border-slate-600 bg-transparent outline-none focus:border-brand-500 transition-colors text-slate-900 dark:text-white"
              />
            ) : (
              <span className="text-xl font-bold text-slate-900 dark:text-white">{full}</span>
            )}
          </div>

          <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-md">
                <WarningCircle size={16} weight="fill" />
              </div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Vacías</span>
            </div>
            {editing ? (
              <input
                type="number"
                min={0}
                value={empty}
                onChange={(e) => onEmptyChange(Number(e.target.value))}
                className="w-20 text-center font-bold text-lg border-b-2 border-slate-300 dark:border-slate-600 bg-transparent outline-none focus:border-brand-500 transition-colors text-slate-900 dark:text-white"
              />
            ) : (
              <span className="text-xl font-bold text-slate-900 dark:text-white">{empty}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
