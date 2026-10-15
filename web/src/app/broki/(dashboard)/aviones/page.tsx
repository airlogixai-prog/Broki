"use client";

import { onTabListKeyDown } from "@/lib/a11y/tablist";

import { useMemo, useState } from "react";
import { FilterBar } from "@/components/equipment/FilterBar";
import { EquipmentGrid } from "@/components/equipment/EquipmentGrid";
import { EquipmentCard } from "@/components/equipment/EquipmentCard";
import { AircraftRegistry } from "@/components/aircraft/AircraftRegistry";
import { useApp } from "@/context/AppContext";
import { openEquipment } from "@/lib/hooks/useEquipmentModal";
import { brokiApi } from "@/lib/api/broki";
import { normalizeAircraft } from "@/lib/mappers/equipment";
import { filterEquipment } from "@/lib/equipment/filters";
import { Airplane, SquaresFour, ListBullets } from "@phosphor-icons/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Card } from "@/components/ui/Card";

type Tab = "equipos" | "flota";
type View = "byPlane" | "grid";

/**
 * Aircraft: equipment currently assigned per aircraft (legacy "Operativa por
 * Avión": one card per aircraft with its equipment) plus the editable registry.
 */
export default function AvionesPage() {
  const { furgonetas, gse, aircraft, avionFilter, setAvionFilter, setAircraft, filter, statusFilter, familyFilter, incidentsMemory, loading, fetchError, refreshRef } = useApp();
  const [tab, setTab] = useState<Tab>("equipos");
  const [view, setView] = useState<View>("byPlane");

  const all = useMemo(() => [...furgonetas, ...gse], [furgonetas, gse]);
  const planes = useMemo(() => [...new Set(all.map((i) => i.plane).filter(Boolean))].sort(), [all]);

  const groups = useMemo(() => {
    const filtered = filterEquipment(all, { filter, statusFilter, avionFilter: "all", familyFilter, incidents: incidentsMemory });
    const map = new Map<string, typeof all>();
    for (const item of filtered) {
      if (!item.plane) continue;
      if (avionFilter !== "all" && item.plane !== avionFilter) continue;
      map.set(item.plane, [...(map.get(item.plane) ?? []), item]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [all, filter, statusFilter, familyFilter, incidentsMemory, avionFilter]);

  const refreshRegistry = async () => {
    try {
      const rows = await brokiApi.fetchAircraft();
      const list = (Array.isArray(rows) ? rows : []).map((r) => normalizeAircraft(r)).filter((a) => a.reg);
      setAircraft(list);
    } catch {
      refreshRef.current?.();
    }
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={tab === id}
      tabIndex={tab === id ? 0 : -1}
      onClick={() => setTab(id)}
      className={`min-h-9 rounded-md px-3 text-xs font-bold transition-colors ${tab === id ? "bg-surface text-brand-700 shadow-sm dark:text-brand-300" : "text-fg-muted hover:text-fg"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="Aviones"
        subtitle={`${aircraft.length} en registro · ${planes.length} con equipos asignados`}
        icon={<Airplane size={22} />}
        actions={
          <div className="flex rounded-lg bg-subtle p-1" role="tablist" onKeyDown={onTabListKeyDown} aria-label="Vista de aviones">
            {tabBtn("equipos", "Equipos asociados")}
            {tabBtn("flota", "Registro de flota")}
          </div>
        }
      />

      {fetchError && <ErrorState message={fetchError} onRetry={() => refreshRef.current?.()} />}

      {tab === "flota" ? (
        <AircraftRegistry aircraft={aircraft} onChanged={() => void refreshRegistry()} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por avión">
            <button
              type="button"
              onClick={() => setAvionFilter("all")}
              aria-pressed={avionFilter === "all"}
              className={`min-h-9 rounded-lg px-3 text-sm font-medium transition-colors ${avionFilter === "all" ? "bg-brand-600 text-white" : "bg-subtle text-fg-muted hover:text-fg"}`}
            >
              Todos
            </button>
            {planes.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAvionFilter(avionFilter === p ? "all" : p)}
                aria-pressed={avionFilter === p}
                className={`min-h-9 rounded-lg px-3 text-sm font-medium transition-colors ${avionFilter === p ? "bg-brand-600 text-white" : "bg-subtle text-fg-muted hover:text-fg"}`}
              >
                {p}
              </button>
            ))}
            <div className="ml-auto flex rounded-lg bg-subtle p-1" role="group" aria-label="Disposición">
              <button type="button" aria-pressed={view === "byPlane"} onClick={() => setView("byPlane")} className={`flex min-h-8 items-center gap-1 rounded-md px-2.5 text-xs font-semibold ${view === "byPlane" ? "bg-surface text-fg shadow-sm" : "text-fg-muted"}`}>
                <ListBullets size={14} aria-hidden /> Por avión
              </button>
              <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")} className={`flex min-h-8 items-center gap-1 rounded-md px-2.5 text-xs font-semibold ${view === "grid" ? "bg-surface text-fg shadow-sm" : "text-fg-muted"}`}>
                <SquaresFour size={14} aria-hidden /> Cuadrícula
              </button>
            </div>
          </div>
          <FilterBar hideAvionFilter />

          {view === "grid" ? (
            <EquipmentGrid items={all.filter((i) => !!i.plane)} onSelect={openEquipment} loading={loading} />
          ) : groups.length === 0 ? (
            <EmptyState
              compact
              icon={<Airplane size={28} />}
              title={planes.length === 0 ? "Ningún equipo asignado a un avión" : "Sin resultados"}
              description={planes.length === 0 ? "Asigna un avión desde el detalle de cada equipo." : "Ningún equipo asignado coincide con los filtros."}
            />
          ) : (
            <div className="space-y-4">
              {groups.map(([plane, items]) => {
                const reg = aircraft.find((a) => a.reg === plane);
                return (
                  <Card
                    key={plane}
                    title={
                      <span className="flex items-center gap-2 normal-case tracking-normal">
                        <Airplane size={16} className="text-brand-500" aria-hidden />
                        {plane}
                        {reg && <span className="text-xs font-medium text-fg-muted">{[reg.airline, reg.model].filter(Boolean).join(" · ")}</span>}
                      </span>
                    }
                    actions={<span className="tabular text-xs font-semibold text-fg-muted">{items.length} equipo{items.length !== 1 ? "s" : ""}</span>}
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.map((item) => (
                        <EquipmentCard key={item.id} item={item} onClick={openEquipment} />
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
