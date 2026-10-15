"use client";

import { onTabListKeyDown } from "@/lib/a11y/tablist";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { MapTrifold, Van, Wrench, Question, CheckCircle, Clock, Prohibit } from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { getStatusCategory } from "@/lib/mappers/equipment";
import { openEquipment } from "@/lib/hooks/useEquipmentModal";
import { BlockSkeleton } from "@/components/ui/BlockSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import type { MapPin as MapPinType, MapImage } from "@/components/mapa/EquipmentMapLeaflet";
import type { Equipment, StatusCategory } from "@/lib/types/equipment";

const EquipmentMapLeaflet = dynamic(() => import("@/components/mapa/EquipmentMapLeaflet").then((m) => m.EquipmentMapLeaflet), {
  ssr: false,
  loading: () => <BlockSkeleton className="h-[60vh] min-h-[420px] w-full" label="Cargando plano" />,
});

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
  short: string;
  image: MapImage;
  zones: Zone[];
}

/** Zones are the legacy parking→percentage tables (broki.html MAPS); positions are schematic, not GPS. */
const MAPS: Record<MapId, MapConfig> = {
  t123: {
    name: "Terminales 1, 2 y 3",
    short: "T1·T2·T3",
    image: { src: "/maps/t123.webp", srcSmall: "/maps/t123-sm.webp", width: 2400, height: 3399 },
    zones: [
      { range: [1, 20], x: 20, yStart: 10, yEnd: 30 },
      { range: [21, 50], x: 35, yStart: 30, yEnd: 50 },
      { range: [100, 150], xStart: 20, xEnd: 50, yStart: 60, yEnd: 80 },
      { range: [200, 299], x: 70, yStart: 60, yEnd: 80 },
      { range: [300, 399], x: 80, yStart: 40, yEnd: 60 },
    ],
  },
  t4: {
    name: "Terminal 4",
    short: "T4",
    image: { src: "/maps/t4.webp", srcSmall: "/maps/t4-sm.webp", width: 2400, height: 3399 },
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
      { range: [10, 30], x: 80, yStart: 5, yEnd: 20 },
    ],
  },
  t4s: {
    name: "Terminal 4 Satélite",
    short: "T4S",
    image: { src: "/maps/t4s.webp", srcSmall: "/maps/t4s-sm.webp", width: 2400, height: 3399 },
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
};

export function getMapPosition(parkingStr: string | undefined | null, config: Pick<MapConfig, "zones">): { x: number; y: number } | null {
  const m = String(parkingStr ?? "").match(/(\d+)/);
  if (!m) return null;
  const num = parseInt(m[1], 10);

  for (const zone of config.zones) {
    if (num < zone.range[0] || num > zone.range[1]) continue;
    const pct = zone.range[1] > zone.range[0] ? (num - zone.range[0]) / (zone.range[1] - zone.range[0]) : 0.5;
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

const LEGEND: { cat: StatusCategory; label: string; cls: string; Icon: typeof CheckCircle }[] = [
  { cat: "available", label: "Disponible (D)", cls: "bg-success", Icon: CheckCircle },
  { cat: "occupied", label: "En uso (U)", cls: "bg-warning", Icon: Clock },
  { cat: "inoperative", label: "Inoperativo (I)", cls: "bg-danger", Icon: Prohibit },
  { cat: "unknown", label: "Sin estado (?)", cls: "bg-neutral", Icon: Question },
];

export default function MapaPage() {
  const { furgonetas, gse, incidentsMemory, loading, fetchError, refreshRef } = useApp();
  const [mapId, setMapId] = useState<MapId | null>(null);
  const [onlyInUse, setOnlyInUse] = useState(true);

  const all = useMemo(() => [...furgonetas, ...gse], [furgonetas, gse]);
  const candidates = useMemo(
    () => (onlyInUse ? all.filter((item) => getStatusCategory(item.status) === "occupied") : all),
    [all, onlyInUse],
  );

  // Until the user picks a terminal, open the one where most of the in-use equipment is parked.
  const autoMapId = useMemo<MapId>(() => {
    const counts = (Object.keys(MAPS) as MapId[]).map((id) => [id, candidates.filter((i) => getMapPosition(i.parking || i.location, MAPS[id])).length] as const);
    const best = counts.sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : "t4";
  }, [candidates]);
  const activeMapId = mapId ?? autoMapId;
  const config = MAPS[activeMapId];

  const { pins, unplaced } = useMemo(() => {
    const pins: MapPinType[] = [];
    const unplaced: Equipment[] = [];
    for (const item of candidates) {
      const pos = getMapPosition(item.parking || item.location, config);
      if (pos) pins.push({ item, pos, hasIncident: !!incidentsMemory[item.id]?.current });
      else unplaced.push(item);
    }
    return { pins, unplaced };
  }, [candidates, config, incidentsMemory]);

  const onSelect = useCallback((item: Equipment) => openEquipment(item), []);

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="Mapa de equipos"
        subtitle={`${config.name} · ${pins.length} equipo${pins.length !== 1 ? "s" : ""} posicionado${pins.length !== 1 ? "s" : ""}`}
        icon={<MapTrifold size={22} />}
        actions={
          <div className="flex rounded-lg bg-subtle p-1" role="tablist" onKeyDown={onTabListKeyDown} aria-label="Terminal">
            {(Object.keys(MAPS) as MapId[]).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeMapId === id}
                tabIndex={activeMapId === id ? 0 : -1}
                onClick={() => setMapId(id)}
                className={`min-h-9 rounded-md px-3 text-xs font-bold transition-colors ${activeMapId === id ? "bg-brand-600 text-white shadow-sm" : "text-fg-muted hover:text-fg"}`}
              >
                {MAPS[id].short}
              </button>
            ))}
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <ul className="flex flex-wrap gap-3" aria-label="Leyenda de estados">
            {LEGEND.map(({ cat, label, cls, Icon }) => (
              <li key={cat} className="flex items-center gap-1.5 text-fg-muted">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-white ${cls}`} aria-hidden>
                  <Icon size={10} weight="bold" />
                </span>
                {label}
              </li>
            ))}
            <li className="flex items-center gap-1.5 text-fg-muted">
              <span className="h-4 w-4 rounded-md bg-neutral" aria-hidden /> Furgoneta
            </li>
            <li className="flex items-center gap-1.5 text-fg-muted">
              <span className="h-4 w-4 rounded-full bg-neutral" aria-hidden /> GSE
            </li>
          </ul>
          <label className="ml-auto flex cursor-pointer items-center gap-2 font-medium text-fg-muted">
            <input type="checkbox" checked={onlyInUse} onChange={(e) => setOnlyInUse(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Solo equipos en uso
          </label>
        </div>
      </PageHeader>

      {fetchError && <ErrorState message={fetchError} onRetry={() => refreshRef.current?.()} />}

      {loading && all.length === 0 ? (
        <BlockSkeleton className="h-[60vh] min-h-[420px] w-full" label="Cargando equipos en mapa" />
      ) : (
        <EquipmentMapLeaflet mapName={config.name} image={config.image} pins={pins} onSelect={onSelect} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padded={false} title={`Posicionados en ${config.short}`} actions={<span className="tabular text-xs text-fg-muted">{pins.length}</span>}>
          {pins.length === 0 ? (
            <p className="p-5 text-center text-sm text-fg-muted">Ningún equipo {onlyInUse ? "en uso " : ""}con parking de esta terminal.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {pins.map(({ item }) => (
                <li key={item.id}>
                  <EquipmentRow item={item} onClick={() => onSelect(item)} where={item.parking || item.location} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card padded={false} title="Sin posición en esta terminal" actions={<span className="tabular text-xs text-fg-muted">{unplaced.length}</span>}>
          {unplaced.length === 0 ? (
            <p className="p-5 text-center text-sm text-fg-muted">Todos los equipos {onlyInUse ? "en uso " : ""}tienen parking mapeable aquí.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {unplaced.map((item) => (
                <li key={item.id}>
                  <EquipmentRow item={item} onClick={() => onSelect(item)} where={item.parking || item.location || "sin parking"} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function EquipmentRow({ item, onClick, where }: { item: Equipment; onClick: () => void; where: string }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-subtle">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center text-white ${item.type === "furgo" ? "rounded-md" : "rounded-full"} ${
        { available: "bg-success", occupied: "bg-warning", inoperative: "bg-danger", unknown: "bg-neutral" }[getStatusCategory(item.status)]
      }`} aria-hidden>
        {item.type === "furgo" ? <Van size={14} /> : <Wrench size={14} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-fg">{item.id}</span>
        <span className="block truncate text-xs text-fg-muted">
          {item.model}
          {item.worker && ` · ${item.worker}`}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge status={item.status} size="sm" />
        <span className="text-[11px] text-fg-subtle">{where}</span>
      </span>
    </button>
  );
}
