"use client";

import { useState } from "react";
import { MapPin, Van, Wrench } from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { getStatusCategory } from "@/lib/mappers/equipment";
import { EquipmentDetailModal } from "@/components/modals/EquipmentDetailModal";
import type { Equipment } from "@/lib/types/equipment";

type MapId = "t4" | "t4s" | "t123";

interface Zone {
  range: [number, number];
  x?: number;
  y?: number;
  xStart?: number;
  xEnd?: number;
  yStart?: number;
  yEnd?: number;
}

interface MapConfig {
  name: string;
  zones: Zone[];
}

const MAPS: Record<MapId, MapConfig> = {
  t4: {
    name: "Terminal 4",
    zones: [
      { range: [300, 322], x: 32, yStart: 25, yEnd: 40 },
      { range: [324, 340], x: 42, yStart: 25, yEnd: 45 },
      { range: [342, 358], x: 42, yStart: 45, yEnd: 65 },
      { range: [360, 380], x: 42, yStart: 65, yEnd: 90 },
      { range: [380, 399], x: 48, yStart: 25, yEnd: 90 },
      { range: [400, 418], y: 12, xStart: 25, xEnd: 60 },
      { range: [420, 428], x: 65, yStart: 28, yEnd: 40 },
      { range: [430, 450], x: 65, yStart: 45, yEnd: 75 },
      { range: [451, 499], x: 65, yStart: 75, yEnd: 90 },
      { range: [10, 30],   x: 80, yStart: 5,  yEnd: 20 },
    ],
  },
  t4s: {
    name: "Terminal 4S",
    zones: [
      { range: [518, 536], x: 22, yStart: 20, yEnd: 45 },
      { range: [500, 517], x: 22, yStart: 45, yEnd: 80 },
      { range: [537, 541], y: 15, xStart: 25, xEnd: 35 },
      { range: [542, 560], x: 38, yStart: 20, yEnd: 45 },
      { range: [562, 580], x: 38, yStart: 45, yEnd: 80 },
      { range: [600, 610], x: 60, yStart: 20, yEnd: 35 },
      { range: [612, 630], x: 60, yStart: 48, yEnd: 80 },
    ],
  },
  t123: {
    name: "Terminal 1, 2, 3",
    zones: [
      { range: [1,  20],  x: 20, yStart: 10, yEnd: 30 },
      { range: [21, 50],  x: 35, yStart: 30, yEnd: 50 },
      { range: [100,150], xStart: 20, xEnd: 50, yStart: 60, yEnd: 80 },
      { range: [200,299], x: 70, yStart: 60, yEnd: 80 },
      { range: [300,399], x: 80, yStart: 40, yEnd: 60 },
    ],
  },
};

function getMapPosition(
  parkingStr: string | undefined | null,
  config: MapConfig
): { x: number; y: number } | null {
  const m = String(parkingStr ?? "").match(/(\d+)/);
  if (!m) return null;
  const num = parseInt(m[1], 10);

  for (const zone of config.zones) {
    if (num < zone.range[0] || num > zone.range[1]) continue;
    const pct =
      zone.range[1] > zone.range[0]
        ? (num - zone.range[0]) / (zone.range[1] - zone.range[0])
        : 0.5;

    let x: number;
    let y: number;

    if (zone.y != null) {
      y = zone.y;
      x = (zone.xStart ?? 0) + pct * ((zone.xEnd ?? 100) - (zone.xStart ?? 0));
    } else if (zone.x != null) {
      x = zone.x;
      y = (zone.yStart ?? 0) + pct * ((zone.yEnd ?? 100) - (zone.yStart ?? 0));
    } else {
      x = (zone.xStart ?? 0) + pct * ((zone.xEnd ?? 100) - (zone.xStart ?? 0));
      y = (zone.yStart ?? 0) + pct * ((zone.yEnd ?? 100) - (zone.yStart ?? 0));
    }

    return { x: Math.min(95, Math.max(5, x)), y: Math.min(95, Math.max(5, y)) };
  }
  return null;
}

export default function MapaPage() {
  const { furgonetas, gse } = useApp();
  const [mapId, setMapId] = useState<MapId>("t4");
  const [selected, setSelected] = useState<Equipment | null>(null);

  const config = MAPS[mapId];
  const all = [...furgonetas, ...gse];
  const occupiedItems = all.filter(
    (item) => getStatusCategory(item.status) === "occupied"
  );

  const pins = occupiedItems
    .map((item) => {
      const pos = getMapPosition(item.parking || item.location, config);
      return pos ? { item, pos } : null;
    })
    .filter(Boolean) as { item: Equipment; pos: { x: number; y: number } }[];

  const mapBtns: { id: MapId; label: string }[] = [
    { id: "t123", label: "T1, T2, T3" },
    { id: "t4",   label: "Terminal 4" },
    { id: "t4s",  label: "Terminal 4S" },
  ];

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <MapPin size={28} className="text-brand-500" /> Mapa de Equipos
        </h1>

        {/* Terminal tabs */}
        <div className="flex gap-2">
          {mapBtns.map((b) => (
            <button
              key={b.id}
              onClick={() => setMapId(b.id)}
              className={`px-4 py-2 text-sm font-bold rounded-lg border transition-all ${
                mapId === b.id
                  ? "bg-brand-600 text-white border-brand-600 shadow-md"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
          <span className="w-3 h-3 rounded-full bg-amber-500" /> Furgoneta en uso
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
          <span className="w-3 h-3 rounded-full bg-brand-500" /> GSE en uso
        </div>
      </div>

      {/* Map viewport */}
      <div className="relative w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
           style={{ minHeight: 480 }}>

        {/* Placeholder airport map grid */}
        <div className="absolute inset-0 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-300 dark:text-slate-700 select-none">
              <MapPin size={64} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium opacity-50">{config.name}</p>
              <p className="text-xs opacity-30 mt-1">
                {pins.length} equipo{pins.length !== 1 ? "s" : ""} en plataforma
              </p>
            </div>
          </div>
        </div>

        {/* Terminal label */}
        <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm z-10">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm">{config.name}</h3>
        </div>

        {/* Pins */}
        {pins.map(({ item, pos }) => {
          const isFurgo = item.type === "furgo";
          return (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="absolute group/pin -translate-x-1/2 -translate-y-1/2 z-20"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div
                className={`w-7 h-7 rounded-full border-2 border-white dark:border-slate-800 shadow-lg flex items-center justify-center text-white text-xs hover:scale-125 transition-transform ${
                  isFurgo ? "bg-amber-500" : "bg-brand-500"
                }`}
              >
                {isFurgo ? <Van size={12} /> : <Wrench size={12} />}
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/pin:block bg-slate-800 text-white text-[10px] px-2 py-1.5 rounded whitespace-nowrap z-50 shadow-xl pointer-events-none">
                <span className="font-bold block">{item.id}</span>
                <span className="opacity-80 block text-[9px]">{item.model}</span>
                <span className="text-amber-300 font-bold tracking-wider uppercase text-[9px]">
                  En Uso
                </span>
              </div>
            </button>
          );
        })}

        {pins.length === 0 && occupiedItems.length === 0 && (
          <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none">
            <p className="text-xs text-slate-400 dark:text-slate-600 italic">
              No hay equipos en uso en este momento.
            </p>
          </div>
        )}
      </div>

      {/* Items list for this map */}
      {pins.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Equipos detectados en {config.name}
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {pins.map(({ item }) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 ${
                    item.type === "furgo" ? "bg-amber-500" : "bg-brand-500"
                  }`}
                >
                  {item.type === "furgo" ? <Van size={14} /> : <Wrench size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{item.id}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {item.model}
                    {item.worker && ` · ${item.worker}`}
                  </p>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                  {item.parking || item.location || "—"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <EquipmentDetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
