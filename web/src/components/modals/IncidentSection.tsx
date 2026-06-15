"use client";

import { useState } from "react";
import {
  CheckCircle,
  Warning,
  Plus,
  PaperPlaneTilt,
  CaretRight,
  ClockCounterClockwise,
} from "@phosphor-icons/react";
import { brokiApi } from "@/lib/api/broki";
import type { Equipment, IncidentState, Incident } from "@/lib/types/equipment";
import { useApp } from "@/context/AppContext";

function formatDate(d: string | Date | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generateNextIncidentId(itemId: string, data: IncidentState): string {
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

interface HistoryItemProps {
  incident: Incident;
}

function HistoryItem({ incident }: HistoryItemProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pl-4 relative pb-4 border-l border-slate-200 dark:border-slate-700 last:border-0 last:pb-0 group">
      <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-600 border-2 border-white dark:border-slate-800" />
      <div className="cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <CaretRight
              size={12}
              className={`text-slate-400 transition-transform ${open ? "rotate-90 text-brand-500" : ""}`}
            />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Resuelta · {formatDate(incident.closedAt)}
            </span>
          </div>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
            {incident.id}
          </span>
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700">
          <p className="line-clamp-2">{incident.messages[0]?.text ?? "Sin descripción"}</p>
          {incident.messages.length > 1 && (
            <p className="mt-1 text-[10px] text-brand-600 dark:text-brand-400 font-medium">
              Ver historial completo ({incident.messages.length} mensajes)
            </p>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 ml-2 space-y-3 pl-3 border-l-2 border-dashed border-slate-200 dark:border-slate-700">
          {incident.messages.map((m, i) => (
            <div key={i}>
              <div className="flex justify-between items-baseline mb-1">
                <span
                  className={`text-[10px] font-bold ${i === 0 ? "text-brand-600 dark:text-brand-400" : "text-slate-700 dark:text-slate-300"}`}
                >
                  {m.user || "Sistema"}
                </span>
                <span className="text-[9px] text-slate-400">{formatDate(m.time)}</span>
              </div>
              <div
                className={`bg-white dark:bg-slate-900/50 p-2 rounded border text-xs text-slate-600 dark:text-slate-300 ${i === 0 ? "border-brand-100 dark:border-brand-900/30" : "border-slate-100 dark:border-slate-800"}`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  item: Equipment;
  incidentState: IncidentState;
  onUpdate: (updated: IncidentState) => void;
}

export function IncidentSection({ item, incidentState, onUpdate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [newWorker, setNewWorker] = useState(item.worker || "");
  const [msgText, setMsgText] = useState("");
  const [closeCheck, setCloseCheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const current = incidentState.current;
  const history = incidentState.history;

  const handleOpenIncident = async () => {
    if (!newText.trim()) return;
    setSubmitting(true);
    const newId = generateNextIncidentId(item.id, incidentState);
    const now = new Date().toISOString();
    const newIncident: Incident = {
      id: newId,
      openedAt: now,
      messages: [{ user: newWorker.trim() || "Operario", text: newText, time: now }],
    };
    const updated: IncidentState = { ...incidentState, current: newIncident };
    onUpdate(updated);

    try {
      await brokiApi.postIncident({
        action: "open_incident",
        incident_id: newId,
        item_id: item.id,
        worker: newWorker.trim() || "Operario",
        defect: newText,
        status: "abierta",
        timestamp: now,
      });
    } catch (e) {
      console.error("[IncidentSection] open incident error", e);
    }
    setNewText("");
    setShowForm(false);
    setSubmitting(false);
  };

  const handleSubmitMessage = async () => {
    if (!msgText.trim() || !current) return;
    setSubmitting(true);
    const now = new Date().toISOString();
    const msgUser = current.messages[0]?.user ?? item.worker ?? "Operario";
    const updatedMessages = [...current.messages, { user: msgUser, text: msgText, time: now }];

    let updated: IncidentState;
    if (closeCheck) {
      const closed: Incident = {
        ...current,
        messages: updatedMessages,
        closedAt: now,
      };
      updated = { current: null, history: [closed, ...history] };
    } else {
      updated = {
        ...incidentState,
        current: { ...current, messages: updatedMessages },
      };
    }
    onUpdate(updated);

    try {
      await brokiApi.postIncident({
        action: closeCheck ? "close_incident" : "update_incident",
        incident_id: current.id,
        item_id: item.id,
        worker: msgUser,
        message: msgText,
        defect: msgText,
        status: closeCheck ? "cerrada" : "abierta",
        timestamp: now,
      });
    } catch (e) {
      console.error("[IncidentSection] submit message error", e);
    }
    setMsgText("");
    setCloseCheck(false);
    setSubmitting(false);
  };

  return (
    <div>
      {/* Active incident */}
      {current ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-4 border-b border-red-200 dark:border-red-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <h4 className="font-bold text-red-700 dark:text-red-400 text-sm">
                Incidencia Abierta
              </h4>
            </div>
            <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">
              Abierta: {formatDate(current.openedAt)}
            </span>
          </div>

          {/* Messages */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-red-100 dark:border-red-900/50 p-3 max-h-48 overflow-y-auto mb-3">
            {current.messages.map((m, i) => (
              <div key={i} className="mb-3 last:mb-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {m.user}
                  </span>
                  <span className="text-[10px] text-slate-400">{formatDate(m.time)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-800 dark:text-slate-200 break-words">
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Reply */}
          <div className="flex flex-col gap-2">
            <textarea
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="Añadir actualización o nota de cierre..."
              rows={2}
              className="w-full text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-red-500 outline-none resize-none"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={closeCheck}
                  onChange={(e) => setCloseCheck(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 accent-brand-600"
                />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Marcar como Resuelta
                </span>
              </label>
              <button
                onClick={handleSubmitMessage}
                disabled={submitting || !msgText.trim()}
                className="bg-slate-800 dark:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1 transition-colors"
              >
                <PaperPlaneTilt size={12} /> Enviar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" /> Estado Operativo
            </h3>
            <button
              onClick={() => setShowForm((o) => !o)}
              className="text-xs bg-brand-50 dark:bg-slate-700 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-slate-600 px-3 py-1.5 rounded-lg font-bold hover:bg-brand-100 dark:hover:bg-slate-600 shadow-sm flex items-center gap-1 transition-colors"
            >
              <Plus size={12} /> Reportar Incidencia
            </button>
          </div>

          {showForm && (
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Warning size={16} className="text-amber-500" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nueva Incidencia
                </p>
              </div>
              <div className="mb-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Trabajador
                </label>
                <input
                  type="text"
                  value={newWorker}
                  onChange={(e) => setNewWorker(e.target.value)}
                  className="w-full text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-brand-500 outline-none"
                  placeholder="Nombre del trabajador"
                />
              </div>
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={3}
                className="w-full text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-brand-500 outline-none mb-3 resize-none"
                placeholder="Describa el problema detalladamente..."
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="text-xs px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleOpenIncident}
                  disabled={submitting || !newText.trim()}
                  className="text-xs bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 shadow-sm transition-colors"
                >
                  Abrir Incidencia
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-6 border-t border-slate-100 dark:border-slate-700 pt-4">
          <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ClockCounterClockwise size={12} /> Historial Reciente
          </h4>
          <div className="space-y-1">
            {history.map((h) => (
              <HistoryItem key={h.id} incident={h} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
