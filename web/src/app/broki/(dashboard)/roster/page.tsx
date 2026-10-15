"use client";

import { onTabListKeyDown } from "@/lib/a11y/tablist";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarBlank, Users, ArrowsClockwise, Warning, ClockCounterClockwise } from "@phosphor-icons/react";
import { brokiApi, type RosterPerson, type RosterWeek, type ImportRun } from "@/lib/api/broki";
import { PdfDropZone } from "@/components/ui/PdfDropZone";
import { useBrokiRealtime } from "@/lib/hooks/useBrokiRealtime";
import { OperationalSyncBar } from "@/components/ui/OperationalSyncBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { BlockSkeleton } from "@/components/ui/BlockSkeleton";
import { Card } from "@/components/ui/Card";
import { DateSelector, shiftDay, toIsoDay } from "@/components/ui/DateSelector";
import { useToast } from "@/components/ui/Toast";
import { useHydrated } from "@/lib/hooks/useHydrated";

type ShiftType = "iberojet" | "w2f" | "off" | "leave" | "none";

interface ShiftStyle {
  cls: string;
  type: ShiftType;
  label: string;
}

/**
 * The airline comes from the imported PDF. The legacy dashboard guessed it from a
 * hardcoded set of table row indices, which mislabels everyone as soon as the
 * roster order changes, so an unknown airline now renders as a neutral shift
 * instead of being silently assigned to Iberojet.
 */
export function getShiftStyle(shift: string, airline: RosterPerson["airline"]): ShiftStyle {
  const s = shift.trim().toUpperCase();
  if (!s) return { cls: "bg-subtle text-fg-subtle", type: "none", label: "Sin dato" };
  if (["L", "B", "BL", "LD"].includes(s)) return { cls: "bg-warning-muted text-warning-strong", type: "off", label: "Libranza / baja" };
  if (["V", "FS", "FSL", "FBL", "P", "IT", "SL"].includes(s)) return { cls: "bg-danger-muted text-danger-strong", type: "leave", label: "Vacaciones / free" };
  if (s.includes("FL")) return { cls: "bg-warning-muted text-warning-strong", type: "off", label: "Libranza" };
  if (airline === "w2f") return { cls: "bg-info text-white", type: "w2f", label: "W2Fly" };
  if (airline === "iberojet") return { cls: "bg-info-muted text-info-strong border border-info/40", type: "iberojet", label: "Iberojet" };
  return { cls: "bg-neutral-muted text-fg", type: "none", label: "Turno" };
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return toIsoDay(d);
}

type Mode = "weekly" | "daily";
type AirlineFilter = "all" | "iberojet" | "w2f";

const AIRLINE_FILTERS: { id: AirlineFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "iberojet", label: "Iberojet" },
  { id: "w2f", label: "W2Fly" },
];

export default function RosterPage() {
  const toast = useToast();
  const hydrated = useHydrated();
  const [mode, setMode] = useState<Mode>("weekly");
  const [airlineFilter, setAirlineFilter] = useState<AirlineFilter>("all");
  const [roster, setRoster] = useState<RosterWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [day, setDay] = useState(() => toIsoDay(new Date()));
  const [imports, setImports] = useState<ImportRun[] | null>(null);

  const weekKey = mondayOf(day);
  const dayIdx = (new Date(`${day}T12:00:00`).getDay() + 6) % 7; // Mon=0

  const load = useCallback(
    async (alive: () => boolean = () => true, week = weekKey) => {
      setLoading(true);
      setError(null);
      try {
        const fetched = await brokiApi.fetchRoster(week);
        if (alive()) setRoster(fetched);
      } catch (err) {
        if (alive()) setError(err instanceof Error ? err.message : "No se pudo cargar el horario");
      } finally {
        if (alive()) setLoading(false);
      }
    },
    [weekKey],
  );

  const loadImports = useCallback(async () => {
    try {
      setImports(await brokiApi.fetchRosterImports());
    } catch {
      setImports([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await load(() => alive);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const realtime = useBrokiRealtime(["broki_roster_assignments", "broki_roster_periods"], () => load());

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const result = await brokiApi.rosterUpload(formDataFor(file));
      if (result.duplicate) toast.info("PDF ya importado", result.message ?? "Este horario ya estaba cargado.");
      else toast.success("Horario importado", `${result.people ?? 0} personas · ${result.imported ?? 0} turnos${result.week ? ` · semana ${result.week}` : ""}`);
      if (result.week && mondayOf(result.week) !== weekKey) setDay(result.week);
      else await load();
      if (imports) await loadImports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el horario");
    } finally {
      setUploading(false);
    }
  };

  const people = useMemo(() => roster?.people ?? [], [roster]);
  const filteredPeople = airlineFilter === "all" ? people : people.filter((p) => p.airline === airlineFilter);
  const isCurrentWeek = weekKey === mondayOf(toIsoDay(new Date()));

  const daily = useMemo(() => {
    return filteredPeople
      .map((p) => {
        const shift = p.week[dayIdx] ?? "";
        return { ...p, shift, style: getShiftStyle(shift, p.airline) };
      })
      .filter((p) => p.style.type !== "off" && p.style.type !== "leave" && p.shift.trim() !== "");
  }, [filteredPeople, dayIdx]);

  const absent = useMemo(
    () => filteredPeople.filter((p) => ["off", "leave"].includes(getShiftStyle(p.week[dayIdx] ?? "", p.airline).type)),
    [filteredPeople, dayIdx],
  );

  const weekLabel = roster?.week
    ? `Semana del ${new Date(`${roster.week}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}`
    : `Semana del ${new Date(`${weekKey}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`;

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Horario"
        subtitle={hydrated ? `${weekLabel}${roster?.isFallback ? " · último horario importado" : ""} · ${people.length} personas` : "Turnos semanales"}
        icon={<CalendarBlank size={22} />}
        actions={
          <>
            <DateSelector value={day} onChange={setDay} step={mode === "weekly" ? 7 : 1} label={mode === "weekly" ? "Semana" : "Día"} />
            <IconButton label="Refrescar horario" onClick={() => void load()} disabled={loading}>
              <ArrowsClockwise size={18} className={loading ? "animate-spin" : ""} />
            </IconButton>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <OperationalSyncBar syncMode={realtime.syncMode} lastUpdate={realtime.lastUpdate} updating={realtime.updating || loading} />
          <div className="flex rounded-lg bg-subtle p-1" role="tablist" onKeyDown={onTabListKeyDown} aria-label="Vista del horario">
            {(["weekly", "daily"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                tabIndex={mode === m ? 0 : -1}
                onClick={() => setMode(m)}
                className={`min-h-9 rounded-md px-3 text-xs font-bold transition-colors ${mode === m ? "bg-surface text-brand-700 shadow-sm dark:text-brand-300" : "text-fg-muted hover:text-fg"}`}
              >
                {m === "weekly" ? "Semana" : "Día"}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5" role="group" aria-label="Filtrar por aerolínea">
            {AIRLINE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={airlineFilter === f.id}
                onClick={() => setAirlineFilter(f.id)}
                className={`min-h-9 rounded-full border px-3 text-xs font-bold transition-colors ${
                  airlineFilter === f.id ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-surface text-fg-muted hover:bg-subtle"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" icon={<ClockCounterClockwise size={14} />} onClick={() => (imports ? setImports(null) : void loadImports())} aria-expanded={!!imports}>
            {imports ? "Ocultar importaciones" : "Importaciones"}
          </Button>
        </div>
      </PageHeader>

      {roster?.isFallback && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-muted px-4 py-3">
          <Warning size={18} className="mt-0.5 shrink-0 text-warning-strong" aria-hidden />
          <p className="text-sm text-fg">No hay horario importado para la semana seleccionada. Se muestra el último disponible. Sube un PDF o elige otra semana.</p>
        </div>
      )}

      {imports && (
        <Card padded={false} title="Importaciones de horario">
          {imports.length === 0 ? (
            <p className="p-4 text-center text-sm text-fg-muted">Sin importaciones registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-[11px] uppercase tracking-wide text-fg-subtle">
                    <th className="p-3 font-semibold">Archivo</th>
                    <th className="p-3 font-semibold">Estado</th>
                    <th className="p-3 font-semibold">Turnos</th>
                    <th className="p-3 font-semibold">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {imports.map((row) => (
                    <tr key={row.id}>
                      <td className="p-3 text-fg">{row.file_name ?? row.id}</td>
                      <td className="p-3 text-fg-muted">{row.status}</td>
                      <td className="tabular p-3 text-fg-muted">{row.imported_count ?? "—"}</td>
                      <td className="tabular p-3 text-fg-muted">{row.finished_at ? new Date(row.finished_at).toLocaleString("es-ES") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {error && <ErrorState title="Error en el horario" message={error} onRetry={() => void load()} />}

      <ul className="flex flex-wrap gap-2 text-[11px] font-bold" aria-label="Leyenda">
        {[
          { label: "Iberojet", cls: getShiftStyle("07:00-19:00", "iberojet").cls },
          { label: "W2Fly", cls: getShiftStyle("07:00-19:00", "w2f").cls },
          { label: "Libranza / baja (L, B)", cls: getShiftStyle("L", null).cls },
          { label: "Vacaciones / free (V, FS)", cls: getShiftStyle("V", null).cls },
        ].map((l) => (
          <li key={l.label} className={`rounded px-2 py-0.5 ${l.cls}`}>
            {l.label}
          </li>
        ))}
      </ul>

      {loading && people.length === 0 && !error && <BlockSkeleton className="h-64" label="Cargando horario" />}

      {!loading && !error && people.length === 0 && (
        <EmptyState icon={<CalendarBlank size={28} />} title="Sin horario importado" description="Sube el PDF del horario para ver los turnos de la semana." />
      )}

      {people.length > 0 && mode === "weekly" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full min-w-[720px] border-collapse">
            <caption className="sr-only">Turnos semanales</caption>
            <thead>
              <tr className="border-b border-border-subtle">
                <th scope="col" className="w-20 border-r border-border-subtle p-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                  Cert.
                </th>
                <th scope="col" className="border-r border-border-subtle p-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                  Nombre
                </th>
                {DAYS.map((d, i) => {
                  const iso = shiftDay(weekKey, i);
                  const isSelected = i === dayIdx;
                  return (
                    <th
                      key={d}
                      scope="col"
                      className={`border-r border-border-subtle p-2 text-center text-[11px] font-semibold uppercase tracking-wide last:border-0 ${isSelected ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300" : "text-fg-subtle"}`}
                    >
                      <button type="button" onClick={() => { setDay(iso); setMode("daily"); }} className="w-full rounded px-1 py-0.5 hover:bg-subtle" aria-label={`Ver día ${d} ${iso.slice(8)}`}>
                        {d}
                        <span className="tabular block text-[11px] font-medium normal-case text-fg-muted">{iso.slice(8)}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredPeople.map((p) => (
                <tr key={`${p.name}-${p.id}`} className="hover:bg-subtle">
                  <td className="border-r border-border-subtle p-3 text-xs font-medium text-fg-muted">{p.cert}</td>
                  <th scope="row" className="max-w-[180px] truncate border-r border-border-subtle p-3 text-left text-xs font-bold text-fg">
                    {p.name} {p.id && <span className="font-normal text-fg-subtle">({p.id})</span>}
                  </th>
                  {p.week.map((shift, i) => {
                    const style = getShiftStyle(shift, p.airline);
                    return (
                      <td key={i} className={`border-r border-border-subtle p-1 text-center last:border-0 ${i === dayIdx ? "bg-brand-50/50 dark:bg-brand-900/10" : ""}`}>
                        <span className={`tabular block truncate rounded p-1 text-[11px] font-bold ${style.cls}`} title={style.label}>
                          {shift || "—"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {people.length > 0 && mode === "daily" && (
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">
            Turno del{" "}
            <span className="font-medium capitalize text-fg">{new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</span>
            {!isCurrentWeek && roster?.isFallback && <span> (horario de otra semana)</span>} · {daily.length} en turno · {absent.length} ausentes
          </p>
          {daily.length === 0 ? (
            <EmptyState compact icon={<Users size={24} />} title="Nadie en turno para este filtro" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {daily.map((p) => (
                <div key={`${p.name}-${p.id}`} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded bg-subtle px-1.5 py-0.5 text-[11px] font-bold text-fg-muted">{p.cert}</span>
                      {p.id && <span className="text-[11px] text-fg-subtle">ID {p.id}</span>}
                    </div>
                    <h3 className="truncate text-sm font-bold text-fg">{p.name}</h3>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`tabular mb-1 inline-block rounded-lg px-2 py-1 text-[11px] font-bold ${p.style.cls}`}>{p.shift}</span>
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{p.style.label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {absent.length > 0 && (
            <details className="rounded-xl border border-border bg-surface">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-fg-muted">Ausencias ({absent.length})</summary>
              <ul className="divide-y divide-border-subtle px-4 pb-2">
                {absent.map((p) => {
                  const st = getShiftStyle(p.week[dayIdx] ?? "", p.airline);
                  return (
                    <li key={`${p.name}-${p.id}`} className="flex items-center justify-between py-2 text-xs">
                      <span className="font-medium text-fg">{p.name}</span>
                      <span className={`rounded px-2 py-0.5 font-bold ${st.cls}`}>{p.week[dayIdx]} · {st.label}</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </div>
      )}

      <Card title="Importar horario (PDF)">
        <div className="mb-3 flex items-start gap-3">
          <Users size={20} className="mt-0.5 shrink-0 text-fg-subtle" aria-hidden />
          <p className="text-xs text-fg-muted">PDF con capa de texto. Los escaneos sin OCR se rechazan con un mensaje claro. La semana se detecta del documento.</p>
        </div>
        <PdfDropZone
          file={null}
          onFile={(file) => {
            if (file) void handleUpload(file);
          }}
          disabled={uploading}
          label={uploading ? "Subiendo horario…" : "Arrastra el PDF del horario o pulsa para seleccionarlo"}
        />
      </Card>
    </div>
  );
}

function formDataFor(file: File): FormData {
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}
