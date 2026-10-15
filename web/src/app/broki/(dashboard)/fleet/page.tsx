"use client";

import { useState, useEffect, useCallback } from "react";
import { Notebook, PlusCircle, Airplane, User, CheckCircle, Trash, X, Plus, Sun, ClockCounterClockwise, Archive } from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { brokiApi, type Relay } from "@/lib/api/broki";
import { useBrokiRealtime } from "@/lib/hooks/useBrokiRealtime";
import { OperationalSyncBar } from "@/components/ui/OperationalSyncBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField, TextField } from "@/components/ui/FormField";
import { ErrorState, InlineError } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { BlockSkeleton } from "@/components/ui/BlockSkeleton";
import { useToast } from "@/components/ui/Toast";

function getRelayGroup(timestamp: string): "today" | "yesterday" | "older" {
  const d = new Date(timestamp);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86400000;
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (t === startToday) return "today";
  if (t === startYesterday) return "yesterday";
  return "older";
}

function formatRelayDate(timestamp: string, group: string): string {
  const d = new Date(timestamp);
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (group === "today") return time;
  if (group === "yesterday") return `Ayer ${time}`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " " + time;
}

function RelayCard({ relay, onDelete }: { relay: Relay; onDelete: () => void }) {
  const group = getRelayGroup(relay.timestamp);
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-colors hover:border-brand-300" aria-label={`Relevo ${relay.plane}`}>
      <div className="flex items-start justify-between border-b border-border-subtle bg-muted p-4">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-info/30 bg-info-muted text-info-strong" aria-hidden>
            <Airplane size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold leading-tight text-fg">{relay.plane}</h3>
            <p className="flex items-center gap-1 text-xs text-fg-muted">
              <User size={12} aria-hidden /> {relay.worker || "Sin firmante"}
            </p>
          </div>
        </div>
        <time dateTime={relay.timestamp} className="tabular ml-2 shrink-0 text-[11px] font-medium text-fg-subtle">
          {formatRelayDate(relay.timestamp, group)}
        </time>
      </div>
      <ul className="flex-1 space-y-2 p-4">
        {relay.points.map((p, i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle size={14} className="mt-0.5 shrink-0 text-success" aria-hidden />
            <p className="break-words text-xs leading-snug text-fg">{p}</p>
          </li>
        ))}
      </ul>
      <div className="flex justify-end border-t border-border-subtle bg-muted px-3 py-2">
        <Button variant="ghost" size="sm" icon={<Trash size={14} />} onClick={onDelete} className="text-danger-strong hover:bg-danger-muted">
          Eliminar
        </Button>
      </div>
    </article>
  );
}

export default function FleetPage() {
  const { aircraft } = useApp();
  const toast = useToast();
  const [relays, setRelays] = useState<Relay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [toDelete, setToDelete] = useState<Relay | null>(null);
  const [plane, setPlane] = useState("");
  const [worker, setWorker] = useState("");
  const [points, setPoints] = useState<string[]>(["", ""]);
  const [touched, setTouched] = useState(false);

  const load = useCallback(async (alive: () => boolean = () => true) => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await brokiApi.fetchRelays();
      if (alive()) setRelays(fetched);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : "No se pudieron cargar los relevos");
    } finally {
      if (alive()) setLoading(false);
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

  const realtime = useBrokiRealtime(["broki_relays", "broki_relay_points"], () => load());

  const validPoints = points.map((p) => p.trim()).filter(Boolean);
  const errors = {
    plane: !plane.trim() ? "Selecciona el avión" : null,
    points: validPoints.length === 0 ? "Añade al menos una novedad" : null,
  };
  const valid = !errors.plane && !errors.points;

  const resetForm = () => {
    setPlane("");
    setWorker("");
    setPoints(["", ""]);
    setTouched(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await brokiApi.createRelay({ plane: plane.trim().toUpperCase(), worker: worker.trim(), points: validPoints });
      setRelays((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setShowModal(false);
      resetForm();
      toast.success("Relevo guardado", created.plane);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "No se pudo guardar el relevo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const previous = relays;
    setRelays((prev) => prev.filter((r) => r.id !== toDelete.id));
    try {
      await brokiApi.deleteRelay(toDelete.id);
      toast.success("Relevo eliminado", toDelete.plane);
      setToDelete(null);
    } catch (err) {
      setRelays(previous);
      throw err;
    }
  };

  const today = relays.filter((r) => getRelayGroup(r.timestamp) === "today");
  const yesterday = relays.filter((r) => getRelayGroup(r.timestamp) === "yesterday");
  const older = relays.filter((r) => getRelayGroup(r.timestamp) === "older");

  const section = (title: string, icon: React.ReactNode, items: Relay[]) =>
    items.length === 0 ? null : (
      <section aria-label={title} key={title}>
        <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-fg-muted">
          {icon} {title} <span className="tabular rounded-full bg-subtle px-1.5 text-fg-muted">{items.length}</span>
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <RelayCard key={r.id} relay={r} onDelete={() => setToDelete(r)} />
          ))}
        </div>
      </section>
    );

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Relevos"
        subtitle={`Libro de relevos · ${today.length} hoy · ${relays.length} en total`}
        icon={<Notebook size={22} />}
        actions={
          <Button icon={<PlusCircle size={16} />} onClick={() => setShowModal(true)}>
            Nuevo relevo
          </Button>
        }
      >
        <OperationalSyncBar syncMode={realtime.syncMode} lastUpdate={realtime.lastUpdate} updating={realtime.updating || loading} />
      </PageHeader>

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {loading && relays.length === 0 && !error && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <BlockSkeleton key={i} className="h-48" label="Cargando relevos" />
          ))}
        </div>
      )}

      {!loading && !error && relays.length === 0 && (
        <EmptyState
          icon={<Notebook size={28} />}
          title="Sin relevos registrados"
          description="Crea el primero para dejar constancia del cambio de turno. Se guarda en el servidor y lo ven todos los dispositivos."
          action={
            <Button icon={<PlusCircle size={18} />} onClick={() => setShowModal(true)}>
              Crear primer relevo
            </Button>
          }
        />
      )}

      {section("Hoy", <Sun size={12} className="text-success" aria-hidden />, today)}
      {section("Ayer", <ClockCounterClockwise size={12} className="text-warning" aria-hidden />, yesterday)}
      {section("Historial", <Archive size={12} aria-hidden />, older)}

      <Modal
        open={showModal}
        onClose={() => !saving && setShowModal(false)}
        busy={saving}
        title="Nuevo relevo"
        icon={<Notebook size={18} />}
        description="Novedades y pendientes para el siguiente turno."
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <InlineError message={saveError} />
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button loading={saving} onClick={() => void handleSave()} disabled={touched && !valid}>
                Guardar relevo
              </Button>
            </div>
          </div>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          noValidate
        >
          {aircraft.length > 0 ? (
            <SelectField label="Avión" value={plane} onChange={(e) => setPlane(e.target.value)} required error={touched ? errors.plane : null}>
              <option value="">Seleccionar avión…</option>
              {aircraft.map((a) => (
                <option key={a.reg} value={a.reg}>
                  {a.reg} · {a.airline}
                </option>
              ))}
            </SelectField>
          ) : (
            <TextField label="Avión" value={plane} onChange={(e) => setPlane(e.target.value.toUpperCase())} placeholder="EC-XXX" required error={touched ? errors.plane : null} />
          )}
          <TextField label="Técnico firmante" value={worker} onChange={(e) => setWorker(e.target.value)} placeholder="Nombre…" list="broki-personnel-names" />
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Novedades</legend>
            <ul className="space-y-2">
              {points.map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <TextField
                    label={`Novedad ${i + 1}`}
                    className="flex-1 [&_label]:sr-only"
                    value={p}
                    onChange={(e) => setPoints((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                    placeholder="Escribe una novedad o tarea pendiente…"
                  />
                  <IconButton size="sm" label={`Quitar novedad ${i + 1}`} onClick={() => setPoints((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [""]))}>
                    <X size={14} />
                  </IconButton>
                </li>
              ))}
            </ul>
            {touched && errors.points && <InlineError message={errors.points} />}
            <Button variant="ghost" size="sm" icon={<Plus size={14} />} className="mt-2" onClick={() => setPoints((p) => [...p, ""])}>
              Añadir línea
            </Button>
          </fieldset>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        danger
        title="Borrar relevo"
        message={toDelete ? `Se borrará el relevo de ${toDelete.plane} (${toDelete.points.length} novedades).` : undefined}
        confirmLabel="Borrar"
        onCancel={() => setToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
