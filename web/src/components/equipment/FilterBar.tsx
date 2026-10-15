"use client";

import { useEffect } from "react";
import { X } from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { getFamily } from "@/lib/mappers/equipment";
import { FilterSelect } from "@/components/ui/FormField";
import { useHydrated } from "@/lib/hooks/useHydrated";

const STATUSES = [
  { value: "all", label: "Todos los estados" },
  { value: "available", label: "Disponible" },
  { value: "occupied", label: "En uso" },
  { value: "active", label: "Operativos" },
  { value: "issues", label: "Con incidencia / inoperativo" },
];

/**
 * Global filters (persisted in localStorage `broki_filters`). A persisted
 * aircraft or family that no longer exists in the inventory is reset to "all",
 * which is what left the "Equipos asociados" view empty in earlier QA (G-09).
 */
export function FilterBar({ hideAvionFilter = false }: { hideAvionFilter?: boolean }) {
  const {
    avionFilter,
    setAvionFilter,
    statusFilter,
    setStatusFilter,
    familyFilter,
    setFamilyFilter,
    filter,
    setFilter,
    furgonetas,
    gse,
  } = useApp();

  const hydrated = useHydrated();
  const all = [...furgonetas, ...gse];
  const planes = [...new Set(all.map((i) => i.plane).filter(Boolean))].sort();
  const families = [...new Set(all.map((i) => getFamily(i)))].sort();

  useEffect(() => {
    if (all.length === 0) return;
    if (avionFilter !== "all" && !planes.includes(avionFilter)) setAvionFilter("all");
    if (familyFilter !== "all" && !families.includes(familyFilter)) setFamilyFilter("all");
    if (!STATUSES.some((s) => s.value === statusFilter)) setStatusFilter("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all.length, avionFilter, familyFilter, statusFilter]);

  const chips: { label: string; clear: () => void }[] = [];
  if (filter) chips.push({ label: `Búsqueda: “${filter}”`, clear: () => setFilter("") });
  if (statusFilter !== "all")
    chips.push({ label: STATUSES.find((s) => s.value === statusFilter)?.label ?? statusFilter, clear: () => setStatusFilter("all") });
  if (avionFilter !== "all") chips.push({ label: `Avión ${avionFilter}`, clear: () => setAvionFilter("all") });
  if (familyFilter !== "all") chips.push({ label: familyFilter, clear: () => setFamilyFilter("all") });

  return (
    <div className="space-y-2" role="group" aria-label="Filtros de equipos">
      <div className="flex flex-wrap gap-2">
        <FilterSelect label="Filtrar por estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </FilterSelect>

        {!hideAvionFilter && (
          <FilterSelect label="Filtrar por avión" value={avionFilter} onChange={(e) => setAvionFilter(e.target.value)}>
            <option value="all">Todos los aviones</option>
            {planes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </FilterSelect>
        )}

        <FilterSelect label="Filtrar por familia" value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)}>
          <option value="all">Todas las familias</option>
          {families.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </FilterSelect>
      </div>

      {hydrated && chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros activos">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.clear}
              className="inline-flex min-h-8 items-center gap-1 rounded-full border border-brand-300 bg-brand-50 px-2.5 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
              aria-label={`Quitar filtro ${c.label}`}
            >
              {c.label}
              <X size={12} aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setFilter("");
              setStatusFilter("all");
              setAvionFilter("all");
              setFamilyFilter("all");
            }}
            className="min-h-8 px-2 text-xs font-semibold text-fg-muted hover:text-fg"
          >
            Limpiar todo
          </button>
        </div>
      )}
    </div>
  );
}
