"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Cylinder, ArrowsClockwise, PencilSimple, FloppyDisk, Wrench, X } from "@phosphor-icons/react";
import { brokiApi } from "@/lib/api/broki";
import { NitroStockCard } from "@/components/stock/NitroStockCard";
import { useApp } from "@/context/AppContext";
import { useBrokiRealtime } from "@/lib/hooks/useBrokiRealtime";
import { OperationalSyncBar } from "@/components/ui/OperationalSyncBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { ErrorState, InlineError } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { BlockSkeleton } from "@/components/ui/BlockSkeleton";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TextField } from "@/components/ui/FormField";
import { useToast } from "@/components/ui/Toast";
import { openEquipment } from "@/lib/hooks/useEquipmentModal";
import { rowsToLocations, validateCounts, type StockLocation, type StockRow, type CountErrors } from "@/lib/stock/nitro";
import { isNitrogen, nitrogenReadings, N2_CRITICAL_PSI, N2_LOW_PSI } from "@/lib/equipment/kpis";

type Draft = Record<string, { full: string; empty: string }>;

function psiTone(v: number | null): string {
  if (v == null) return "text-fg-subtle";
  if (v >= 1500) return "text-success-strong";
  if (v >= N2_LOW_PSI) return "text-warning-strong";
  if (v > 0 && v < N2_CRITICAL_PSI) return "text-danger-strong";
  if (v === 0) return "text-fg-subtle";
  return "text-warning-strong";
}

/**
 * Nitrogen stock per location (broki_nitro_stock, one row per ubicacion) plus
 * bottle pressures of the nitrogen GSE units (broki_assets.nitrogeno_1..4).
 * Only changed rows are written; failures are shown per row (G-04).
 */
export default function StockPage() {
  const { gse, refreshRef } = useApp();
  const toast = useToast();
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingStock, setEditingStock] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [editingGse, setEditingGse] = useState(false);
  // Draft per item + the updated_at seen when editing started (sent as expected_updated_at).
  const [pressureEdits, setPressureEdits] = useState<Record<string, string[]>>({});
  const [editTokens, setEditTokens] = useState<Record<string, string | null>>({});
  const [gseErrors, setGseErrors] = useState<Record<string, string>>({});

  const nitroGse = useMemo(() => gse.filter((item) => isNitrogen(item) || (item.model ?? "").toUpperCase().includes("N2")), [gse]);

  const fetchStock = useCallback(async (alive: () => boolean = () => true) => {
    try {
      const data = await brokiApi.fetchStock();
      if (!alive()) return;
      setLocations(rowsToLocations(Array.isArray(data) ? (data as StockRow[]) : []));
      setError(null);
    } catch (e) {
      if (alive()) setError(e instanceof Error ? e.message : "No se pudo cargar el stock.");
    }
    if (alive()) setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await fetchStock(() => alive);
    })();
    return () => {
      alive = false;
    };
  }, [fetchStock]);

  // While editing, Realtime refreshes must not overwrite the draft (legacy bug: 30 s refresh wiped edits).
  const realtime = useBrokiRealtime(["broki_nitro_stock"], () => (editingStock ? Promise.resolve() : fetchStock()));

  const totalFull = locations.reduce((n, l) => n + l.full, 0);
  const totalEmpty = locations.reduce((n, l) => n + l.empty, 0);

  const startEdit = () => {
    setDraft(Object.fromEntries(locations.map((l) => [l.key, { full: String(l.full), empty: String(l.empty) }])));
    setSaveErrors({});
    setEditingStock(true);
  };

  const cancelEdit = () => {
    setEditingStock(false);
    setDraft({});
    setSaveErrors({});
    void fetchStock();
  };

  const draftErrors: Record<string, CountErrors> = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, validateCounts(v)]));
  const draftValid = Object.values(draftErrors).every((e) => !e.full && !e.empty);
  const changed = locations.filter((l) => {
    const d = draft[l.key];
    return d && (Number(d.full) !== l.full || Number(d.empty) !== l.empty);
  });

  const handleSaveStock = async () => {
    if (!draftValid || saving) return;
    if (changed.length === 0) {
      setEditingStock(false);
      toast.info("Sin cambios", "No había nada que guardar.");
      return;
    }
    setSaving(true);
    const errs: Record<string, string> = {};
    let ok = 0;
    for (const loc of changed) {
      const d = draft[loc.key];
      try {
        await brokiApi.updateStock({ action: "update_nitro_stock", type: "stock", location: loc.key, llenas: Number(d.full), vacias: Number(d.empty) });
        ok++;
      } catch (e) {
        errs[loc.key] = e instanceof Error ? e.message : "No se pudo guardar";
      }
    }
    setSaving(false);
    setSaveErrors(errs);
    await fetchStock();
    if (Object.keys(errs).length === 0) {
      setEditingStock(false);
      setDraft({});
      toast.success("Stock guardado", `${ok} ubicación${ok !== 1 ? "es" : ""} actualizada${ok !== 1 ? "s" : ""}.`);
    } else {
      toast.error("Error al guardar", `${Object.keys(errs).length} ubicación(es) no se guardaron.`);
    }
  };

  const pressuresDraft = (id: string): string[] => pressureEdits[id] ?? nitrogenReadings(nitroGse.find((i) => i.id === id)!).map(String).concat(["", "", "", ""]).slice(0, 4);

  const handleSaveGse = async () => {
    if (saving) return;
    const errs: Record<string, string> = {};
    const toSave = nitroGse.filter((item) => pressureEdits[item.id]);
    for (const item of toSave) {
      const bad = pressureEdits[item.id].some((v) => v.trim() !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 6000));
      if (bad) errs[item.id] = "Las presiones deben ser números entre 0 y 6000 PSI";
    }
    setGseErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (toSave.length === 0) {
      setEditingGse(false);
      toast.info("Sin cambios", "No había presiones modificadas.");
      return;
    }
    setSaving(true);
    let ok = 0;
    for (const item of toSave) {
      const p = pressureEdits[item.id];
      try {
        await brokiApi.updateEquipment({
          action: "update_equipment",
          item_id: item.id,
          type: item.type,
          expected_updated_at: editTokens[item.id] ?? null,
          updates: { nitrogeno_1: p[0], nitrogeno_2: p[1], nitrogeno_3: p[2], nitrogeno_4: p[3] },
        });
        ok++;
        // Saved rows leave the draft so a retry after a partial failure does not resend them.
        setPressureEdits((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      } catch (e) {
        errs[item.id] = e instanceof Error ? e.message : "No se pudo guardar";
      }
    }
    setSaving(false);
    setGseErrors(errs);
    refreshRef.current?.();
    if (Object.keys(errs).length === 0) {
      setPressureEdits({});
      setEditTokens({});
      setEditingGse(false);
      toast.success("Presiones guardadas", `${ok} equipo${ok !== 1 ? "s" : ""}.`);
    } else {
      toast.error("Error al guardar", `${Object.keys(errs).length} equipo(s) no se guardaron.`);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Stock de nitrógeno"
        subtitle={`${locations.length} ubicaciones · ${nitroGse.length} equipos de nitrógeno`}
        icon={<Cylinder size={22} />}
        actions={
          <>
            <IconButton label="Refrescar stock" onClick={() => void fetchStock()} disabled={loading || editingStock}>
              <ArrowsClockwise size={18} className={loading ? "animate-spin" : ""} />
            </IconButton>
            {!editingStock ? (
              <Button variant="secondary" icon={<PencilSimple size={16} />} onClick={startEdit} disabled={loading || locations.length === 0}>
                Editar stock
              </Button>
            ) : (
              <>
                <Button variant="secondary" icon={<X size={16} />} onClick={cancelEdit} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="success" icon={<FloppyDisk size={16} />} loading={saving} disabled={!draftValid} onClick={() => void handleSaveStock()}>
                  Confirmar{changed.length > 0 ? ` (${changed.length})` : ""}
                </Button>
              </>
            )}
          </>
        }
      >
        <OperationalSyncBar syncMode={realtime.syncMode} lastUpdate={realtime.lastUpdate} updating={realtime.updating || loading} />
      </PageHeader>

      {error && <ErrorState message={error} onRetry={() => void fetchStock()} />}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
          <BlockSkeleton className="h-40" label="Cargando stock" />
          <BlockSkeleton className="h-40" label="Cargando stock" />
        </div>
      ) : locations.length === 0 ? (
        <EmptyState compact icon={<Cylinder size={24} />} title="Sin ubicaciones de stock" description="No hay filas en broki_nitro_stock. Importa el stock o créalo desde la base de datos." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Botellas llenas" value={totalFull} icon={<Cylinder size={18} />} tone="success" />
            <KpiCard label="Botellas vacías" value={totalEmpty} icon={<Cylinder size={18} />} tone="warning" />
            <KpiCard label="Total" value={totalFull + totalEmpty} sub={totalFull + totalEmpty > 0 ? `${Math.round((totalFull / (totalFull + totalEmpty)) * 100)} % llenas` : undefined} icon={<Cylinder size={18} />} tone="neutral" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {locations.map((loc) => (
              <div key={loc.key} className="space-y-1">
                <NitroStockCard
                  name={loc.label}
                  full={editingStock && draft[loc.key] ? Number(draft[loc.key].full) || 0 : loc.full}
                  empty={editingStock && draft[loc.key] ? Number(draft[loc.key].empty) || 0 : loc.empty}
                  editing={editingStock}
                  dirty={changed.some((c) => c.key === loc.key)}
                  draft={draft[loc.key]}
                  errors={draftErrors[loc.key]}
                  onFullChange={(v) => setDraft((d) => ({ ...d, [loc.key]: { ...d[loc.key], full: v } }))}
                  onEmptyChange={(v) => setDraft((d) => ({ ...d, [loc.key]: { ...d[loc.key], empty: v } }))}
                />
                <InlineError message={saveErrors[loc.key]} />
              </div>
            ))}
          </div>
        </>
      )}

      {nitroGse.length > 0 && (
        <section aria-label="Equipos de nitrógeno">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-fg sm:text-lg">
              <Wrench size={18} className="text-fg-muted" aria-hidden /> Equipos de nitrógeno (GSE)
              <span className="tabular rounded-full bg-subtle px-2 py-0.5 text-xs font-bold text-fg-muted">{nitroGse.length}</span>
            </h2>
            {!editingGse ? (
              <Button variant="secondary" size="sm" icon={<PencilSimple size={14} />} onClick={() => setEditingGse(true)}>
                Editar presiones
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={() => { setEditingGse(false); setPressureEdits({}); setEditTokens({}); setGseErrors({}); }} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="success" size="sm" icon={<FloppyDisk size={14} />} loading={saving} onClick={() => void handleSaveGse()}>
                  Confirmar{Object.keys(pressureEdits).length > 0 ? ` (${Object.keys(pressureEdits).length})` : ""}
                </Button>
              </div>
            )}
          </div>
          <p className="mb-3 text-xs text-fg-muted">
            Presión por botella en PSI. Umbrales: <span className="text-warning-strong">&lt; {N2_LOW_PSI} baja</span>, <span className="text-danger-strong">&lt; {N2_CRITICAL_PSI} crítica</span>, 0 = vacía.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {nitroGse.map((item) => {
              const readings = nitrogenReadings(item);
              const dirty = !!pressureEdits[item.id];
              return (
                <div key={item.id} className={`rounded-xl border bg-surface p-4 shadow-sm ${dirty ? "border-brand-400" : "border-border"}`}>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button type="button" onClick={() => openEquipment(item)} className="rounded bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300">
                        {item.id}
                      </button>
                      <p className="mt-1 truncate text-sm font-semibold text-fg">{item.model}</p>
                      <p className="truncate text-xs text-fg-muted">{item.usualLocation || item.location || "Sin ubicación"}{item.plane ? ` · ${item.plane}` : ""}</p>
                    </div>
                    <StatusBadge status={item.status} size="sm" />
                  </div>
                  <div className="grid grid-cols-4 gap-2 rounded-lg border border-border-subtle bg-muted p-2">
                    {[0, 1, 2, 3].map((i) => {
                      const val = readings[i] ?? null;
                      return (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <span className="text-[11px] font-bold uppercase text-fg-subtle">#{i + 1}</span>
                          {editingGse ? (
                            <TextField
                              label={`${item.id} botella ${i + 1} (PSI)`}
                              className="w-full [&_label]:sr-only [&_input]:px-1 [&_input]:text-center"
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={pressuresDraft(item.id)[i]}
                              onChange={(e) => {
                                setEditTokens((prev) => (item.id in prev ? prev : { ...prev, [item.id]: item.updatedAt ?? null }));
                                setPressureEdits((prev) => {
                                  const arr = [...pressuresDraft(item.id)];
                                  arr[i] = e.target.value;
                                  return { ...prev, [item.id]: arr };
                                });
                              }}
                            />
                          ) : (
                            <div className={`tabular text-center text-sm font-black ${psiTone(val)}`}>
                              {val ?? "—"}
                              <span className="block text-[11px] font-bold text-fg-subtle">PSI</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <InlineError message={gseErrors[item.id]} />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
