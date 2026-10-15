"use client";

import { Airplane, MapPin, Signpost, User, GasPump, Wrench, Van, Drop } from "@phosphor-icons/react";
import type { Equipment } from "@/lib/types/equipment";
import { useApp } from "@/context/AppContext";
import { StatusBadge, IncidentBadge } from "@/components/ui/StatusBadge";
import { N2_CRITICAL_PSI, N2_LOW_PSI, nitrogenReadings, isNitrogen } from "@/lib/equipment/kpis";

const FAMILY_ICONS: Record<string, React.ElementType> = {
  Nitrógeno: GasPump,
  Oxígeno: GasPump,
  default: Wrench,
};

function FamilyIcon({ family, size = 18 }: { family: string; size?: number }) {
  const Icon = FAMILY_ICONS[family] ?? FAMILY_ICONS.default;
  return <Icon size={size} aria-hidden />;
}

function bottleTone(p: number) {
  if (p >= 1500) return { bar: "bg-success", label: "ok" };
  if (p >= N2_LOW_PSI) return { bar: "bg-warning", label: "media" };
  if (p >= N2_CRITICAL_PSI) return { bar: "bg-warning", label: "baja" };
  if (p > 0) return { bar: "bg-danger", label: "crítica" };
  return { bar: "bg-neutral", label: "vacía" };
}

function NitrogenBottles({ pressures }: { pressures: number[] }) {
  return (
    <div className="mt-auto w-full border-t border-border-subtle pt-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Botellas N₂ (PSI)</p>
      <div className="grid grid-cols-4 gap-2" role="list" aria-label="Presión de botellas">
        {pressures.map((p, i) => {
          const tone = bottleTone(p);
          const height = Math.max(8, Math.min(100, (p / 3000) * 100));
          return (
            <div key={i} role="listitem" className="flex flex-col items-center gap-1">
              <div
                className="relative flex h-12 w-full items-end overflow-hidden rounded-md border border-border bg-subtle"
                role="img"
                aria-label={`Botella ${i + 1}: ${p} PSI, ${tone.label}`}
              >
                <div className={`${tone.bar} w-full opacity-70 transition-all`} style={{ height: `${height}%` }} />
                <span className="tabular absolute inset-0 z-10 flex items-center justify-center text-[11px] font-bold text-fg">
                  {p}
                </span>
              </div>
              <span className="text-[11px] font-medium text-fg-subtle">#{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FuelBar({ fuel }: { fuel: number }) {
  const tone = fuel > 70 ? "bg-success" : fuel > 30 ? "bg-warning" : "bg-danger";
  const label = fuel > 70 ? "ok" : fuel > 30 ? "medio" : "bajo";
  return (
    <div className="mt-auto w-full border-t border-border-subtle pt-3">
      <div className="mb-1 flex items-end justify-between">
        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
          <Drop size={12} aria-hidden /> Combustible
        </span>
        <span className="tabular text-xs font-bold text-fg">
          {fuel}% <span className="font-medium text-fg-subtle">({label})</span>
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-subtle"
        role="progressbar"
        aria-valuenow={fuel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Combustible ${fuel} %`}
      >
        <div className={`${tone} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${fuel}%` }} />
      </div>
    </div>
  );
}

interface Props {
  item: Equipment;
  onClick?: (item: Equipment) => void;
}

/** Operational card: id, model, status, location/parking, operator, aircraft, fuel or N₂. */
export function EquipmentCard({ item, onClick }: Props) {
  const { incidentsMemory } = useApp();
  const hasIncident = !!incidentsMemory[item.id]?.current;
  const nitro = isNitrogen(item);
  const bottles = nitro ? nitrogenReadings(item) : [];
  const usual = item.usualLocation || item.location;
  const parking = item.parking && item.parking !== usual ? item.parking : "";

  return (
    <article
      className={`equipment-card card-hoverable group relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-surface p-4 text-left shadow-sm transition-colors @container ${
        hasIncident ? "border-danger/60" : "border-border"
      } ${onClick ? "hover:border-brand-400 focus-within:border-brand-400" : ""}`}
      aria-label={`${item.id} · ${item.status}${hasIncident ? " · incidencia abierta" : ""}`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-subtle text-fg-muted transition-colors group-hover:bg-brand-50 group-hover:text-brand-600 dark:group-hover:bg-brand-900/30 dark:group-hover:text-brand-300">
            {item.type === "furgo" ? <Van size={20} aria-hidden /> : <FamilyIcon family={item.family} size={20} />}
          </div>
          <div className="min-w-0">
            <h3 className="whitespace-nowrap text-base font-bold leading-tight text-fg">
              {onClick ? (
                // Stretched button: the whole card is clickable, the accessible target is the id.
                <button
                  type="button"
                  onClick={() => onClick(item)}
                  aria-label={`${item.id} · ${item.status}${hasIncident ? " · incidencia abierta" : ""}. Abrir detalle`}
                  className="cursor-pointer rounded text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                >
                  {item.id}
                </button>
              ) : (
                item.id
              )}
            </h3>
            <p className="truncate text-xs text-fg-muted" title={item.model}>
              {item.model || "Sin descripción"}
              {item.type === "furgo" && item.plate ? ` · ${item.plate}` : ""}
            </p>
          </div>
        </div>
        {hasIncident ? (
          // Narrow cards: the badge drops to its own line instead of squeezing the id.
          <span className="shrink-0 @max-[17rem]:order-last @max-[17rem]:w-full">
            <IncidentBadge />
          </span>
        ) : (
          <span className="hidden max-w-[45%] shrink-0 truncate rounded-md border border-border-subtle bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-fg-subtle @[17rem]:inline-block" title={item.family}>
            {item.family}
          </span>
        )}
      </div>

      <div className="mb-3 flex-1 space-y-1.5">
        <StatusBadge status={item.status} block />
        <div className="flex items-center gap-2 pt-1 text-xs text-fg-muted">
          <MapPin size={14} className="shrink-0 text-fg-subtle" aria-hidden />
          <span className="truncate font-medium" title="Ubicación habitual">
            {usual || <span className="italic text-fg-subtle">Sin ubicación</span>}
          </span>
        </div>
        {parking && (
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <Signpost size={14} className="shrink-0 text-fg-subtle" aria-hidden />
            <span className="truncate" title="Parking actual">
              Parking {parking}
            </span>
          </div>
        )}
        {item.worker && (
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <User size={14} className="shrink-0 text-fg-subtle" aria-hidden />
            <span className="truncate">{item.worker}</span>
          </div>
        )}
      </div>

      {item.plane ? (
        <div className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-info/30 bg-info-muted px-2.5 py-1 text-xs font-bold text-info-strong">
          <Airplane size={14} aria-hidden />
          {item.plane}
        </div>
      ) : (
        <div className="mt-1 h-7" aria-hidden />
      )}

      {item.type === "furgo" && item.fuel !== null && item.fuel !== undefined && <FuelBar fuel={item.fuel} />}
      {nitro && bottles.length > 0 && <NitrogenBottles pressures={bottles} />}
    </article>
  );
}
