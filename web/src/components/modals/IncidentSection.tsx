"use client";

import { useState } from "react";
import { CheckCircle, Warning, Plus, PaperPlaneTilt, CaretRight, ClockCounterClockwise } from "@phosphor-icons/react";
import { brokiApi, isApiError } from "@/lib/api/broki";
import type { IncidentRow } from "@/lib/api/canonical";
import { useApp } from "@/context/AppContext";
import type { Equipment, IncidentState, Incident } from "@/lib/types/equipment";
import { Button } from "@/components/ui/Button";
import { TextField, TextareaField } from "@/components/ui/FormField";
import { InlineError } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";

export function formatDateTime(d: string | Date | undefined | null): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Legacy code shape i-{item}-{n}; the server keeps it unless it collides. */
export function generateNextIncidentId(itemId: string, data: IncidentState): string {
  const all = [...data.history];
  if (data.current) all.push(data.current);
  const escaped = itemId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^i-${escaped}-(\\d+)$`, "i");
  let max = 0;
  all.forEach((inc) => {
    const m = inc.id.match(regex);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `i-${itemId}-${max + 1}`;
}

export function rowToIncident(row: IncidentRow, fallbackId: string): Incident {
  const msgs = Array.isArray(row.messages)
    ? row.messages.map((m) => ({
        user: String(m.user ?? "Operario"),
        text: String(m.text ?? ""),
        time: String(m.time ?? m.created_at ?? new Date().toISOString()),
      }))
    : [];
  return {
    id: String(row.incident_code ?? row.id ?? fallbackId),
    openedAt: String(row.fecha_apertura ?? new Date().toISOString()),
    closedAt: row.fecha_cierre ? String(row.fecha_cierre) : undefined,
    messages: msgs.length > 0 ? msgs : [{ user: "Operario", text: "Incidencia", time: new Date().toISOString() }],
  };
}

function HistoryItem({ incident }: { incident: Incident }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="relative border-l border-border pb-4 pl-4 last:pb-0">
      <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-surface bg-neutral" aria-hidden />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full rounded-lg text-left"
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-fg">
            <CaretRight size={12} className={`transition-transform ${open ? "rotate-90 text-brand-500" : "text-fg-subtle"}`} aria-hidden />
            Resuelta · {formatDateTime(incident.closedAt)}
          </span>
          <span className="rounded border border-border bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">{incident.id}</span>
        </div>
        <div className="rounded-lg border border-border-subtle bg-muted p-2.5 text-xs text-fg-muted">
          <p className={open ? "" : "line-clamp-2"}>{incident.messages[0]?.text ?? "Sin descripción"}</p>
          {incident.messages.length > 1 && !open && (
            <p className="mt-1 text-[11px] font-medium text-brand-600 dark:text-brand-300">Ver historial completo ({incident.messages.length} mensajes)</p>
          )}
        </div>
      </button>
      {open && (
        <ol className="ml-2 mt-3 space-y-3 border-l-2 border-dashed border-border pl-3">
          {incident.messages.map((m, i) => (
            <li key={i}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className={`text-[11px] font-bold ${i === 0 ? "text-brand-600 dark:text-brand-300" : "text-fg"}`}>{m.user || "Sistema"}</span>
                <span className="text-[11px] text-fg-subtle">{formatDateTime(m.time)}</span>
              </div>
              <p className="rounded border border-border-subtle bg-surface p-2 text-xs text-fg-muted">{m.text}</p>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

interface Props {
  item: Equipment;
  incidentState: IncidentState;
  onUpdate: (updated: IncidentState) => void;
}

export function IncidentSection({ item, incidentState, onUpdate }: Props) {
  const { refreshRef } = useApp();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [newWorker, setNewWorker] = useState(item.worker || "");
  const [msgText, setMsgText] = useState("");
  const [closeCheck, setCloseCheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = incidentState.current;
  const history = incidentState.history;

  const handleOpenIncident = async () => {
    if (!newText.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const newId = generateNextIncidentId(item.id, incidentState);
    const now = new Date().toISOString();
    const worker = newWorker.trim() || "Operario";
    const snapshot = incidentState;
    onUpdate({ ...incidentState, current: { id: newId, openedAt: now, messages: [{ user: worker, text: newText, time: now }] } });

    try {
      const row = await brokiApi.postIncident({
        action: "open_incident",
        incident_id: newId,
        item_id: item.id,
        worker,
        defect: newText,
        status: "abierta",
        timestamp: now,
      });
      onUpdate({ ...incidentState, current: rowToIncident(row, newId) });
      refreshRef.current?.();
      setNewText("");
      setShowForm(false);
      toast.success("Incidencia abierta", `${item.id} · ${rowToIncident(row, newId).id}`);
    } catch (e) {
      if (isApiError(e, "incident_already_open") && e.payload?.incident) {
        // Someone else opened one meanwhile: adopt it instead of failing.
        onUpdate({ ...incidentState, current: rowToIncident(e.payload.incident as IncidentRow, newId) });
        refreshRef.current?.();
        setShowForm(false);
        toast.info("Ya existía una incidencia abierta", "Se muestra la incidencia registrada por otro usuario.");
      } else {
        onUpdate(snapshot);
        setError(e instanceof Error ? e.message : "No se pudo abrir la incidencia.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitMessage = async () => {
    if (!msgText.trim() || !current || submitting) return;
    setSubmitting(true);
    setError(null);
    const now = new Date().toISOString();
    const msgUser = item.worker || current.messages[0]?.user || "Operario";
    const savedText = msgText;
    const snapshot = incidentState;
    const optimisticCurrent = { ...current, messages: [...current.messages, { user: msgUser, text: savedText, time: now }] };
    if (closeCheck) onUpdate({ current: null, history: [{ ...optimisticCurrent, closedAt: now }, ...history] });
    else onUpdate({ ...incidentState, current: optimisticCurrent });

    try {
      const row = await brokiApi.postIncident({
        action: closeCheck ? "close_incident" : "update_incident",
        incident_id: current.id,
        item_id: item.id,
        worker: msgUser,
        message: savedText,
        status: closeCheck ? "cerrada" : "abierta",
        timestamp: now,
      });
      const fromServer = rowToIncident(row, current.id);
      if (closeCheck) onUpdate({ current: null, history: [fromServer, ...history] });
      else onUpdate({ ...incidentState, current: fromServer });
      refreshRef.current?.();
      setMsgText("");
      setCloseCheck(false);
      toast.success(closeCheck ? "Incidencia resuelta" : "Mensaje añadido", `${item.id} · ${fromServer.id}`);
    } catch (e) {
      onUpdate(snapshot);
      setError(e instanceof Error ? e.message : "No se pudo guardar el mensaje.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <InlineError message={error} />

      {current ? (
        <div className="rounded-xl border border-danger/40 bg-danger-muted p-4" role="region" aria-label="Incidencia abierta">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-danger/30 pb-2">
            <h4 className="flex items-center gap-2 text-sm font-bold text-danger-strong">
              <Warning size={16} weight="fill" aria-hidden /> Incidencia abierta
              <span className="rounded border border-danger/30 bg-surface px-1.5 py-0.5 font-mono text-[11px] font-medium text-fg-muted">{current.id}</span>
            </h4>
            <span className="text-[11px] font-medium text-danger-strong">Abierta: {formatDateTime(current.openedAt)}</span>
          </div>

          <ol className="mb-3 max-h-48 space-y-3 overflow-y-auto rounded-lg border border-danger/20 bg-surface p-3" aria-label="Mensajes">
            {current.messages.map((m, i) => (
              <li key={i}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-xs font-bold text-fg">{m.user}</span>
                  <span className="text-[11px] text-fg-subtle">{formatDateTime(m.time)}</span>
                </div>
                <p className="break-words rounded-lg border border-border-subtle bg-muted p-2 text-xs text-fg">{m.text}</p>
              </li>
            ))}
          </ol>

          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmitMessage();
            }}
          >
            <TextareaField
              label="Actualización o nota de cierre"
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              rows={2}
              placeholder="Añadir actualización o nota de cierre…"
              disabled={submitting}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-fg-muted">
                <input type="checkbox" checked={closeCheck} onChange={(e) => setCloseCheck(e.target.checked)} className="h-4 w-4 accent-brand-600" />
                Marcar como resuelta
              </label>
              <Button type="submit" size="sm" variant={closeCheck ? "success" : "primary"} icon={<PaperPlaneTilt size={14} />} loading={submitting} disabled={!msgText.trim()}>
                {closeCheck ? "Enviar y resolver" : "Enviar"}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-fg">
              <CheckCircle size={16} className="text-success" weight="fill" aria-hidden /> Sin incidencia abierta
            </p>
            <Button size="sm" variant={showForm ? "secondary" : "primary"} icon={<Plus size={14} />} onClick={() => setShowForm((o) => !o)} aria-expanded={showForm}>
              {showForm ? "Cancelar" : "Reportar incidencia"}
            </Button>
          </div>

          {showForm && (
            <form
              className="space-y-3 rounded-xl border border-border bg-muted p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleOpenIncident();
              }}
            >
              <p className="flex items-center gap-2 text-xs font-bold text-fg">
                <Warning size={16} className="text-warning" aria-hidden /> Nueva incidencia
              </p>
              <TextField label="Trabajador" value={newWorker} onChange={(e) => setNewWorker(e.target.value)} placeholder="Nombre del trabajador" list="broki-personnel-names" />
              <TextareaField label="Descripción" value={newText} onChange={(e) => setNewText(e.target.value)} rows={3} placeholder="Describe el problema con detalle…" required />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)} disabled={submitting}>
                  Cancelar
                </Button>
                <Button type="submit" variant="danger" size="sm" loading={submitting} disabled={!newText.trim()}>
                  Abrir incidencia
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="border-t border-border-subtle pt-4">
          <h4 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
            <ClockCounterClockwise size={12} aria-hidden /> Historial ({history.length})
          </h4>
          <ol className="space-y-1">
            {history.map((h) => (
              <HistoryItem key={h.id} incident={h} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
