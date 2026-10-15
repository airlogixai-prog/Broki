"use client";

import { useMemo, useState } from "react";
import { EquipmentGrid } from "@/components/equipment/EquipmentGrid";
import { useApp } from "@/context/AppContext";
import { openEquipment, openEquipmentById } from "@/lib/hooks/useEquipmentModal";
import { WarningOctagon, CheckCircle, Prohibit, ListChecks, MagnifyingGlass } from "@phosphor-icons/react";
import { computeFleetKpis, splitIssues } from "@/lib/equipment/kpis";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { FilterSelect } from "@/components/ui/FormField";
import { formatDateTime } from "@/components/modals/IncidentSection";

type Row = {
  code: string;
  itemId: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt?: string;
  technician: string;
  description: string;
  messages: number;
};

/**
 * Incidents overview. Cards (legacy tab) plus a global log with dates and
 * technician (G-25) built from the same incident memory the cards use, so the
 * two never disagree.
 */
export default function IncidenciasPage() {
  const { furgonetas, gse, incidentsMemory, loading } = useApp();
  const all = useMemo(() => [...furgonetas, ...gse], [furgonetas, gse]);
  const { withOpenIncident, inoperativeOnly, total } = splitIssues(all, incidentsMemory);
  const kpis = computeFleetKpis(all, incidentsMemory);
  const [scope, setScope] = useState<"all" | "open" | "closed">("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const [itemId, state] of Object.entries(incidentsMemory)) {
      const push = (inc: NonNullable<typeof state.current>, status: Row["status"]) =>
        out.push({
          code: inc.id,
          itemId,
          status,
          openedAt: inc.openedAt,
          closedAt: inc.closedAt,
          technician: inc.messages[0]?.user ?? "—",
          description: inc.messages[0]?.text ?? "",
          messages: inc.messages.length,
        });
      if (state.current) push(state.current, "open");
      for (const h of state.history) push(h, "closed");
    }
    return out.sort((a, b) => (b.openedAt ?? "").localeCompare(a.openedAt ?? ""));
  }, [incidentsMemory]);

  const visibleRows = rows.filter((r) => {
    if (scope !== "all" && r.status !== scope) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return [r.code, r.itemId, r.technician, r.description].some((v) => v.toLowerCase().includes(s));
  });

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Incidencias"
        subtitle={total === 0 ? "Sin equipos afectados" : `${total} equipo${total !== 1 ? "s" : ""} afectado${total !== 1 ? "s" : ""}`}
        icon={<WarningOctagon size={22} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Incidencias abiertas" value={kpis.openIncidents} icon={<WarningOctagon size={18} />} tone="danger" emphasis={kpis.openIncidents > 0} />
        <KpiCard label="Inoperativos" value={kpis.inoperative} icon={<Prohibit size={18} />} tone="warning" emphasis={kpis.inoperative > 0} />
        <KpiCard label="Equipos afectados" value={kpis.withIssues} sub={`${kpis.pct(kpis.withIssues)} %`} icon={<ListChecks size={18} />} tone="neutral" />
        <KpiCard label="Resueltas (histórico)" value={rows.filter((r) => r.status === "closed").length} icon={<CheckCircle size={18} />} tone="success" />
      </div>

      {total === 0 && !loading && (
        <EmptyState compact icon={<CheckCircle size={28} />} title="Sin incidencias activas" description="Ningún equipo está inoperativo ni tiene una incidencia abierta." />
      )}

      {withOpenIncident.length > 0 && (
        <EquipmentGrid items={withOpenIncident} onSelect={openEquipment} unfiltered sectionTitle="Con incidencia abierta" sectionIcon={<WarningOctagon size={18} className="text-danger" />} />
      )}

      {inoperativeOnly.length > 0 && (
        <EquipmentGrid items={inoperativeOnly} onSelect={openEquipment} unfiltered sectionTitle="Inoperativos sin incidencia registrada" sectionIcon={<Prohibit size={18} className="text-warning" />} />
      )}

      <Card
        padded={false}
        title="Registro de incidencias"
        actions={
          <>
            <div className="relative">
              <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar…"
                aria-label="Buscar en el registro de incidencias"
                className="min-h-9 w-40 rounded-lg border border-border bg-surface pl-8 pr-2 text-xs text-fg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            <FilterSelect label="Filtrar por estado de incidencia" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="min-h-9 text-xs">
              <option value="all">Todas</option>
              <option value="open">Abiertas</option>
              <option value="closed">Resueltas</option>
            </FilterSelect>
          </>
        }
      >
        {visibleRows.length === 0 ? (
          <p className="p-6 text-center text-sm text-fg-muted">Sin incidencias registradas{q ? " para esa búsqueda" : ""}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-[11px] uppercase tracking-wide text-fg-subtle">
                  <th className="px-4 py-2 font-semibold">Equipo</th>
                  <th className="px-4 py-2 font-semibold">Código</th>
                  <th className="px-4 py-2 font-semibold">Estado</th>
                  <th className="px-4 py-2 font-semibold">Apertura</th>
                  <th className="px-4 py-2 font-semibold">Cierre</th>
                  <th className="px-4 py-2 font-semibold">Técnico</th>
                  <th className="px-4 py-2 font-semibold">Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {visibleRows.map((r) => (
                  <tr key={`${r.itemId}-${r.code}`} className="hover:bg-subtle">
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => openEquipmentById(r.itemId)} className="font-bold text-brand-700 hover:underline dark:text-brand-300">
                        {r.itemId}
                      </button>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-fg-muted">{r.code}</td>
                    <td className="px-4 py-2">
                      {r.status === "open" ? (
                        <Badge tone="danger" size="sm" icon={<WarningOctagon size={12} aria-hidden />}>
                          Abierta
                        </Badge>
                      ) : (
                        <Badge tone="success" size="sm" icon={<CheckCircle size={12} aria-hidden />}>
                          Resuelta
                        </Badge>
                      )}
                    </td>
                    <td className="tabular whitespace-nowrap px-4 py-2 text-xs text-fg-muted">{formatDateTime(r.openedAt)}</td>
                    <td className="tabular whitespace-nowrap px-4 py-2 text-xs text-fg-muted">{formatDateTime(r.closedAt)}</td>
                    <td className="px-4 py-2 text-xs text-fg">{r.technician}</td>
                    <td className="max-w-[20rem] truncate px-4 py-2 text-xs text-fg-muted" title={r.description}>
                      {r.description}
                      {r.messages > 1 && <span className="ml-1 text-fg-subtle">(+{r.messages - 1})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
