"use client";

import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { Equipment } from "@/lib/types/equipment";
import { EquipmentCard } from "./EquipmentCard";
import { filterEquipment } from "@/lib/equipment/filters";
import { useApp } from "@/context/AppContext";
import { GridSkeleton } from "@/components/ui/BlockSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/lib/hooks/useHydrated";

interface Props {
  items: Equipment[];
  onSelect?: (item: Equipment) => void;
  sectionTitle?: string;
  sectionIcon?: React.ReactNode;
  loading?: boolean;
  /** Skip the global filters (status/avion/family/search). */
  unfiltered?: boolean;
}

const PAGE_SIZE = 48;

export function EquipmentGrid({ items, onSelect, sectionTitle, sectionIcon, loading, unfiltered = false }: Props) {
  const { filter, statusFilter, avionFilter, familyFilter, compactMode, incidentsMemory, setStatusFilter, setAvionFilter, setFamilyFilter, setFilter } = useApp();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const hydrated = useHydrated();

  const filtered = unfiltered
    ? items
    : filterEquipment(items, { filter, statusFilter, avionFilter, familyFilter, incidents: incidentsMemory });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visible.length < filtered.length;

  if (loading && items.length === 0) return <GridSkeleton />;

  const hasActiveFilters = hydrated && (!!filter || statusFilter !== "all" || avionFilter !== "all" || familyFilter !== "all");

  const cols = compactMode
    ? "grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    : "grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <section aria-label={sectionTitle}>
      {sectionTitle && (
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
          {sectionIcon && <span className="text-fg-muted" aria-hidden>{sectionIcon}</span>}
          <h2 className="text-base font-bold text-fg sm:text-lg">{sectionTitle}</h2>
          <span className="tabular rounded-full bg-subtle px-2 py-0.5 text-xs font-bold text-fg-muted" aria-label={`${filtered.length} de ${items.length}`}>
            {filtered.length}
            {filtered.length !== items.length && <span className="font-medium text-fg-subtle"> / {items.length}</span>}
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          compact
          icon={<MagnifyingGlass size={28} />}
          title={items.length === 0 ? "Sin equipos" : "Sin resultados"}
          description={items.length === 0 ? "No hay equipos registrados en esta sección." : "Ningún equipo coincide con los filtros activos."}
          action={
            items.length > 0 && hasActiveFilters ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFilter("");
                  setStatusFilter("all");
                  setAvionFilter("all");
                  setFamilyFilter("all");
                }}
              >
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className={`grid ${cols}`}>
            {visible.map((item) => (
              <EquipmentCard key={item.id} item={item} onClick={onSelect} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-6 text-center">
              <Button variant="secondary" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                Mostrar más ({filtered.length - visible.length} restantes)
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
