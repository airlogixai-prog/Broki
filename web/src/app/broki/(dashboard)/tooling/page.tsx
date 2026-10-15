"use client";

import { onTabListKeyDown } from "@/lib/a11y/tablist";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Toolbox, ArrowsClockwise, ArrowUpRight, ArrowDownLeft, MagnifyingGlass, CheckCircle, Clock, ListBullets, User, Airplane, CalendarBlank, Prohibit, Warning } from "@phosphor-icons/react";
import { brokiApi } from "@/lib/api/broki";
import { useBrokiRealtime } from "@/lib/hooks/useBrokiRealtime";
import { OperationalSyncBar } from "@/components/ui/OperationalSyncBar";
import { useApp } from "@/context/AppContext";
import { normalizeToolingCatalog, normalizeToolingMovement, toolAvailability, type ToolCatalogView, type ToolMovementView, type ToolAvailability } from "@/lib/mappers/tooling";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { KpiCard } from "@/components/ui/KpiCard";
import { Badge, type Tone } from "@/components/ui/StatusBadge";
import { ErrorState, InlineError } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { BlockSkeleton } from "@/components/ui/BlockSkeleton";
import { SelectField, TextField, TextareaField, FilterSelect } from "@/components/ui/FormField";
import { useToast } from "@/components/ui/Toast";

type Tab = "active" | "catalog" | "history";
type Condition = "Completo" | "Defectuoso";

interface CheckoutForm {
  bac: string;
  tma: string;
  aircraft: string;
  condition: Condition;
  notes: string;
}
interface CheckinForm {
  tma: string;
  condition: Condition;
  notes: string;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const AVAIL: Record<ToolAvailability, { label: string; tone: Tone; Icon: typeof CheckCircle }> = {
  available: { label: "Disponible", tone: "success", Icon: CheckCircle },
  checked_out: { label: "Sacada", tone: "warning", Icon: Clock },
  unserviceable: { label: "U/S", tone: "danger", Icon: Prohibit },
  unknown: { label: "Sin estado", tone: "neutral", Icon: Warning },
};

function AvailabilityBadge({ value, raw }: { value: ToolAvailability; raw?: string }) {
  const a = AVAIL[value];
  return (
    <Badge tone={a.tone} size="sm" icon={<a.Icon size={12} weight="bold" aria-hidden />}>
      {a.label}
      {raw && value !== "checked_out" && raw.toUpperCase() !== a.label.toUpperCase() ? ` · ${raw}` : ""}
    </Badge>
  );
}

function ConditionRadios({ name, value, onChange, labels }: { name: string; value: Condition; onChange: (v: Condition) => void; labels: [string, string] }) {
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Estado de la herramienta</legend>
      <div className="flex gap-2">
        {(["Completo", "Defectuoso"] as Condition[]).map((c, i) => (
          <label key={c} className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${value === c ? (c === "Defectuoso" ? "border-danger bg-danger-muted text-danger-strong" : "border-success bg-success-muted text-success-strong") : "border-border text-fg-muted hover:bg-subtle"}`}>
            <input type="radio" name={name} value={c} checked={value === c} onChange={() => onChange(c)} className="accent-brand-600" />
            {labels[i]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Tooling control: catalog (BAC/BACT), open checkouts and movement history. */
export default function ToolingPage() {
  const { personal, aircraft } = useApp();
  const toast = useToast();

  const [catalog, setCatalog] = useState<ToolCatalogView[]>([]);
  const [movements, setMovements] = useState<ToolMovementView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [availFilter, setAvailFilter] = useState<"all" | ToolAvailability>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCheckin, setShowCheckin] = useState<ToolMovementView | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [historyLimit, setHistoryLimit] = useState(50);

  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({ bac: "", tma: "", aircraft: "", condition: "Completo", notes: "" });
  const [checkinForm, setCheckinForm] = useState<CheckinForm>({ tma: "", condition: "Completo", notes: "" });

  const fetchData = useCallback(async (alive: () => boolean = () => true) => {
    setLoading(true);
    try {
      const data = await brokiApi.fetchTooling();
      if (!alive()) return;
      setCatalog((Array.isArray(data.catalog) ? data.catalog : []).map(normalizeToolingCatalog));
      setMovements((Array.isArray(data.movements) ? data.movements : []).map(normalizeToolingMovement));
      setError(null);
    } catch (e) {
      if (alive()) setError(e instanceof Error ? e.message : "No se pudo cargar el tooling.");
    }
    if (alive()) setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await fetchData(() => alive);
    })();
    return () => {
      alive = false;
    };
  }, [fetchData]);

  const realtime = useBrokiRealtime(["broki_tooling_movements", "broki_tooling_catalog"], () => fetchData());

  const activeMovements = useMemo(() => movements.filter((m) => m.status === "checked_out"), [movements]);
  const history = useMemo(() => movements.filter((m) => m.status === "returned").sort((a, b) => (b.checkinDate ?? "").localeCompare(a.checkinDate ?? "")), [movements]);
  const openByBac = useMemo(() => new Set(activeMovements.map((m) => m.bac.toUpperCase())), [activeMovements]);
  const availabilityOf = useCallback((t: ToolCatalogView) => toolAvailability(t, openByBac.has(t.bac.toUpperCase())), [openByBac]);
  const types = useMemo(() => [...new Set(catalog.map((t) => t.tipo).filter(Boolean))].sort(), [catalog]);

  const q = search.trim().toLowerCase();
  const matches = (...fields: (string | null | undefined)[]) => !q || fields.some((f) => (f ?? "").toLowerCase().includes(q));

  const filteredCatalog = catalog.filter(
    (t) =>
      matches(t.bac, t.description, t.partNumber, t.serialNumber, t.manufacturer, t.supplier, t.ubicacion) &&
      (availFilter === "all" || availabilityOf(t) === availFilter) &&
      (typeFilter === "all" || t.tipo === typeFilter),
  );
  const filteredActive = activeMovements.filter((m) => matches(m.bac, m.description, m.checkoutPerson, m.aircraft, m.checkoutNotes));
  const filteredHistory = history.filter((m) => matches(m.bac, m.description, m.checkoutPerson, m.checkinPerson, m.aircraft, m.checkoutNotes));
  const visibleHistory = filteredHistory.slice(0, historyLimit);

  const selectedTool = catalog.find((t) => t.bac === checkoutForm.bac);
  const selectedAvail = selectedTool ? availabilityOf(selectedTool) : null;
  const unserviceableCount = catalog.filter((t) => availabilityOf(t) === "unserviceable").length;

  const openCheckout = (bac = "") => {
    setFormError(null);
    setCheckoutForm({ bac, tma: "", aircraft: "", condition: "Completo", notes: "" });
    setShowCheckout(true);
  };

  const handleCheckout = async () => {
    if (!checkoutForm.bac || !checkoutForm.tma || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await brokiApi.toolingAction({
        action: "checkout",
        bac_bact: checkoutForm.bac,
        descripcion: selectedTool?.description ?? "",
        tma_out: checkoutForm.tma,
        complete_out: checkoutForm.condition,
        date_out: new Date().toISOString(),
        avion: checkoutForm.aircraft,
        remarks: checkoutForm.notes,
      });
      await fetchData();
      setShowCheckout(false);
      setTab("active");
      toast.success("Herramienta sacada", `${checkoutForm.bac} · ${checkoutForm.tma}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo registrar la sacada.");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckin = async () => {
    if (!showCheckin || !checkinForm.tma || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await brokiApi.toolingAction({
        action: "checkin",
        id: showCheckin.id,
        bac_bact: showCheckin.bac,
        tma_in: checkinForm.tma,
        complete_in: checkinForm.condition,
        date_in: new Date().toISOString(),
        remarks: checkinForm.notes,
      });
      await fetchData();
      setShowCheckin(null);
      toast.success("Herramienta devuelta", `${showCheckin.bac} · ${checkinForm.tma}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo registrar la devolución.");
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string; count: number; Icon: typeof Clock }[] = [
    { id: "active", label: "Sacadas", count: activeMovements.length, Icon: Clock },
    { id: "catalog", label: "Catálogo", count: catalog.length, Icon: ListBullets },
    { id: "history", label: "Historial", count: history.length, Icon: CheckCircle },
  ];

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Tooling"
        subtitle={`${catalog.length} herramientas · ${activeMovements.length} sacadas`}
        icon={<Toolbox size={22} />}
        actions={
          <>
            <IconButton label="Refrescar tooling" onClick={() => void fetchData()} disabled={loading}>
              <ArrowsClockwise size={18} className={loading ? "animate-spin" : ""} />
            </IconButton>
            <Button icon={<ArrowUpRight size={16} />} onClick={() => openCheckout()} disabled={loading && catalog.length === 0}>
              Sacar herramienta
            </Button>
          </>
        }
      >
        <OperationalSyncBar syncMode={realtime.syncMode} lastUpdate={realtime.lastUpdate} updating={realtime.updating || saving} />
      </PageHeader>

      {error && <ErrorState message={error} onRetry={() => void fetchData()} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Catálogo" value={catalog.length} icon={<ListBullets size={18} />} tone="brand" onClick={() => setTab("catalog")} />
        <KpiCard label="Sacadas" value={activeMovements.length} icon={<Clock size={18} />} tone="warning" emphasis={activeMovements.length > 0} onClick={() => setTab("active")} />
        <KpiCard label="Devueltas" value={history.length} icon={<CheckCircle size={18} />} tone="success" onClick={() => setTab("history")} />
        <KpiCard label="Fuera de servicio" value={unserviceableCount} icon={<Prohibit size={18} />} tone="danger" emphasis={unserviceableCount > 0} onClick={() => { setTab("catalog"); setAvailFilter("unserviceable"); }} />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por BAC, descripción, P/N, S/N, técnico o avión…"
            aria-label="Buscar en tooling"
            className="min-h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-fg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        {tab === "catalog" && (
          <>
            <FilterSelect label="Filtrar por disponibilidad" value={availFilter} onChange={(e) => setAvailFilter(e.target.value as typeof availFilter)}>
              <option value="all">Cualquier estado</option>
              <option value="available">Disponibles</option>
              <option value="checked_out">Sacadas</option>
              <option value="unserviceable">Fuera de servicio (U/S)</option>
              <option value="unknown">Sin estado</option>
            </FilterSelect>
            {types.length > 0 && (
              <FilterSelect label="Filtrar por tipo" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">Todos los tipos</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </FilterSelect>
            )}
          </>
        )}
      </div>

      <div className="flex rounded-xl bg-subtle p-1" role="tablist" onKeyDown={onTabListKeyDown} aria-label="Secciones de tooling">
        {tabs.map(({ id, label, count, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${tab === id ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
          >
            <Icon size={14} aria-hidden /> {label} <span className="tabular rounded-full bg-neutral-muted px-1.5 text-[11px]">{count}</span>
          </button>
        ))}
      </div>

      {loading && catalog.length === 0 && !error && <BlockSkeleton className="h-48" label="Cargando tooling" />}

      {!(loading && catalog.length === 0) && tab === "active" && (
        <div className="space-y-3" role="tabpanel">
          {filteredActive.length === 0 ? (
            <EmptyState compact icon={<CheckCircle size={24} />} title={activeMovements.length === 0 ? "Sin herramientas sacadas" : "Sin resultados"} description={activeMovements.length === 0 ? "Todas las herramientas están en su ubicación." : undefined} />
          ) : (
            filteredActive.map((m) => (
              <article key={m.id} className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-surface p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between" aria-label={`Sacada ${m.bac}`}>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{m.bac}</span>
                    <AvailabilityBadge value="checked_out" />
                    {m.checkoutCondition && (
                      <Badge tone={m.checkoutCondition.toUpperCase().startsWith("DEF") ? "danger" : "neutral"} size="sm">
                        Salida: {m.checkoutCondition}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-sm font-bold text-fg">{m.description || "Sin descripción"}</p>
                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                    <div className="flex items-center gap-1"><dt className="sr-only">Técnico</dt><User size={12} aria-hidden /><dd>{m.checkoutPerson || "—"}</dd></div>
                    <div className="flex items-center gap-1"><dt className="sr-only">Avión</dt><Airplane size={12} aria-hidden /><dd>{m.aircraft || "—"}</dd></div>
                    <div className="flex items-center gap-1"><dt className="sr-only">Fecha</dt><CalendarBlank size={12} aria-hidden /><dd className="tabular">{formatDate(m.checkoutDate)}</dd></div>
                  </dl>
                  {m.checkoutNotes && <p className="mt-1 truncate text-xs italic text-fg-muted">{m.checkoutNotes}</p>}
                </div>
                <Button
                  variant="success"
                  size="sm"
                  icon={<ArrowDownLeft size={14} />}
                  className="shrink-0"
                  onClick={() => {
                    setFormError(null);
                    setCheckinForm({ tma: "", condition: "Completo", notes: "" });
                    setShowCheckin(m);
                  }}
                >
                  Devolver
                </Button>
              </article>
            ))
          )}
        </div>
      )}

      {!(loading && catalog.length === 0) && tab === "catalog" && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm" role="tabpanel">
          {filteredCatalog.length === 0 ? (
            <EmptyState compact icon={<Toolbox size={24} />} title="Sin resultados" />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {filteredCatalog.map((t) => {
                const avail = availabilityOf(t);
                return (
                  <li key={t.bac || t.description} className="flex flex-col gap-2 px-4 py-3 hover:bg-subtle sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-brand-700 dark:text-brand-300">{t.bac || "Sin BAC"}</span>
                        <AvailabilityBadge value={avail} raw={t.estado} />
                        {t.tipo && <span className="rounded bg-subtle px-1.5 py-0.5 text-[11px] font-bold uppercase text-fg-muted">{t.tipo}</span>}
                      </div>
                      <p className="truncate text-sm text-fg">{t.description}</p>
                      <p className="mt-0.5 truncate text-[11px] text-fg-subtle">
                        {[t.manufacturer && `Fab: ${t.manufacturer}`, t.supplier && `Prov: ${t.supplier}`, t.partNumber && `P/N ${t.partNumber}`, t.serialNumber && `S/N ${t.serialNumber}`].filter(Boolean).join(" · ") || "Sin referencias"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <span className="text-xs text-fg-muted">{t.ubicacion || "Sin ubicación"}</span>
                      {avail === "available" && (
                        <Button variant="secondary" size="sm" icon={<ArrowUpRight size={14} />} onClick={() => openCheckout(t.bac)}>
                          Sacar
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {!(loading && catalog.length === 0) && tab === "history" && (
        <div className="space-y-2" role="tabpanel">
          {filteredHistory.length === 0 ? (
            <EmptyState compact icon={<CheckCircle size={24} />} title={history.length === 0 ? "Sin historial" : "Sin resultados"} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-[11px] uppercase tracking-wide text-fg-subtle">
                    <th className="px-4 py-2 font-semibold">BAC</th>
                    <th className="px-4 py-2 font-semibold">Herramienta</th>
                    <th className="px-4 py-2 font-semibold">Salida</th>
                    <th className="px-4 py-2 font-semibold">Devolución</th>
                    <th className="px-4 py-2 font-semibold">Avión</th>
                    <th className="px-4 py-2 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {visibleHistory.map((m) => (
                    <tr key={m.id} className="hover:bg-subtle">
                      <td className="px-4 py-2 text-xs font-bold text-brand-700 dark:text-brand-300">{m.bac}</td>
                      <td className="max-w-[16rem] truncate px-4 py-2 text-fg" title={m.description}>{m.description}</td>
                      <td className="px-4 py-2 text-xs text-fg-muted">
                        <span className="tabular block">{formatDate(m.checkoutDate)}</span>
                        <span className="block">{m.checkoutPerson}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-fg-muted">
                        <span className="tabular block">{formatDate(m.checkinDate)}</span>
                        <span className="block">{m.checkinPerson ?? "—"}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-fg-muted">{m.aircraft || "—"}</td>
                      <td className="px-4 py-2">
                        {m.checkinCondition ? (
                          <Badge tone={m.checkinCondition.toUpperCase().startsWith("DEF") ? "danger" : "success"} size="sm">
                            {m.checkinCondition}
                          </Badge>
                        ) : (
                          <span className="text-xs text-fg-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredHistory.length > historyLimit && (
            <div className="pt-2 text-center">
              <Button variant="secondary" onClick={() => setHistoryLimit((n) => n + 50)}>
                Mostrar más ({filteredHistory.length - historyLimit} restantes)
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal
        open={showCheckout}
        onClose={() => !saving && setShowCheckout(false)}
        busy={saving}
        title="Sacar herramienta"
        icon={<ArrowUpRight size={18} />}
        description="Registra quién se lleva la herramienta y para qué avión."
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <InlineError message={formError} />
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => setShowCheckout(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button icon={<ArrowUpRight size={16} />} loading={saving} disabled={!checkoutForm.bac || !checkoutForm.tma || selectedAvail === "checked_out"} onClick={() => void handleCheckout()}>
                Confirmar sacada
              </Button>
            </div>
          </div>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCheckout();
          }}
          noValidate
        >
          {catalog.length > 0 ? (
            <SelectField label="Código BAC/BACT" value={checkoutForm.bac} onChange={(e) => setCheckoutForm((s) => ({ ...s, bac: e.target.value }))} required>
              <option value="">Seleccionar herramienta…</option>
              {catalog.map((t) => {
                const a = availabilityOf(t);
                return (
                  <option key={t.bac} value={t.bac} disabled={a === "checked_out"}>
                    {t.bac} — {t.description}{a === "checked_out" ? " (sacada)" : a === "unserviceable" ? " (U/S)" : ""}
                  </option>
                );
              })}
            </SelectField>
          ) : (
            <TextField label="Código BAC/BACT" value={checkoutForm.bac} onChange={(e) => setCheckoutForm((s) => ({ ...s, bac: e.target.value.toUpperCase() }))} placeholder="BAC-XXXX" required />
          )}
          {selectedAvail === "unserviceable" && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-muted px-3 py-2 text-xs font-medium text-danger-strong">
              <Prohibit size={16} className="shrink-0" aria-hidden /> Esta herramienta está marcada fuera de servicio (U/S). Puedes registrar la sacada, pero revisa su estado antes de usarla.
            </p>
          )}
          {selectedAvail === "checked_out" && (
            <p role="alert" className="text-xs font-medium text-warning-strong">Esta herramienta ya está sacada. Devuélvela antes de volver a sacarla.</p>
          )}
          {personal.length > 0 ? (
            <SelectField label="TMA responsable" value={checkoutForm.tma} onChange={(e) => setCheckoutForm((s) => ({ ...s, tma: e.target.value }))} required>
              <option value="">Seleccionar técnico…</option>
              {personal.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          ) : (
            <TextField label="TMA responsable" value={checkoutForm.tma} onChange={(e) => setCheckoutForm((s) => ({ ...s, tma: e.target.value }))} placeholder="Nombre técnico" required />
          )}
          {aircraft.length > 0 ? (
            <SelectField label="Avión" value={checkoutForm.aircraft} onChange={(e) => setCheckoutForm((s) => ({ ...s, aircraft: e.target.value }))}>
              <option value="">Sin avión</option>
              {aircraft.map((a) => (
                <option key={a.reg} value={a.reg}>
                  {a.reg} · {a.airline}
                </option>
              ))}
            </SelectField>
          ) : (
            <TextField label="Avión" value={checkoutForm.aircraft} onChange={(e) => setCheckoutForm((s) => ({ ...s, aircraft: e.target.value.toUpperCase() }))} placeholder="EC-XXX" />
          )}
          <ConditionRadios name="complete_out" value={checkoutForm.condition} onChange={(condition) => setCheckoutForm((s) => ({ ...s, condition }))} labels={["Completa / buen estado", "Defectuosa"]} />
          <TextareaField label="Notas" value={checkoutForm.notes} onChange={(e) => setCheckoutForm((s) => ({ ...s, notes: e.target.value }))} rows={2} placeholder="Observaciones…" />
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Modal>

      <Modal
        open={!!showCheckin}
        onClose={() => !saving && setShowCheckin(null)}
        busy={saving}
        size="sm"
        title="Devolver herramienta"
        icon={<ArrowDownLeft size={18} />}
        description={showCheckin ? `${showCheckin.bac} — ${showCheckin.description}` : undefined}
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <InlineError message={formError} />
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => setShowCheckin(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="success" icon={<ArrowDownLeft size={16} />} loading={saving} disabled={!checkinForm.tma} onClick={() => void handleCheckin()}>
                Confirmar devolución
              </Button>
            </div>
          </div>
        }
      >
        {showCheckin && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCheckin();
            }}
            noValidate
          >
            <p className="rounded-lg bg-muted p-3 text-xs text-fg-muted">
              Sacada por <strong className="text-fg">{showCheckin.checkoutPerson}</strong> el {formatDate(showCheckin.checkoutDate)}
              {showCheckin.aircraft ? ` · ${showCheckin.aircraft}` : ""}
            </p>
            {personal.length > 0 ? (
              <SelectField label="TMA que devuelve" value={checkinForm.tma} onChange={(e) => setCheckinForm((s) => ({ ...s, tma: e.target.value }))} required>
                <option value="">Seleccionar técnico…</option>
                {personal.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </SelectField>
            ) : (
              <TextField label="TMA que devuelve" value={checkinForm.tma} onChange={(e) => setCheckinForm((s) => ({ ...s, tma: e.target.value }))} placeholder="Nombre técnico" required />
            )}
            <ConditionRadios name="complete_in" value={checkinForm.condition} onChange={(condition) => setCheckinForm((s) => ({ ...s, condition }))} labels={["Correcta", "Defectuosa"]} />
            <TextareaField label="Observaciones" value={checkinForm.notes} onChange={(e) => setCheckinForm((s) => ({ ...s, notes: e.target.value }))} rows={2} />
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        )}
      </Modal>
    </div>
  );
}
