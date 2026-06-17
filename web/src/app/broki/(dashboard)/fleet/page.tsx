"use client";

import { useState, useEffect } from "react";
import {
  Notebook,
  PlusCircle,
  Airplane,
  User,
  CheckCircle,
  Trash,
  X,
  Plus,
  Sun,
  ClockCounterClockwise,
  Archive,
} from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";

interface RelayPoint {
  text: string;
}

interface Relay {
  id: number;
  timestamp: string;
  plane: string;
  worker: string;
  points: string[];
}

const STORAGE_KEY = "relays_db";

function loadRelays(): Relay[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRelays(relays: Relay[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(relays));
}

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

interface RelayCardProps {
  relay: Relay;
  onDelete: () => void;
}

function RelayCard({ relay, onDelete }: RelayCardProps) {
  const group = getRelayGroup(relay.timestamp);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col group hover:border-brand-300 dark:hover:border-brand-600 transition-all">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-start">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-800">
            <Airplane size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
              {relay.plane}
            </h3>
          </div>
        </div>
        <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
          {formatRelayDate(relay.timestamp, group)}
        </span>
      </div>

      <div className="p-4 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <User size={14} className="text-slate-400 shrink-0" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
            {relay.worker}
          </span>
        </div>
        <div className="space-y-2">
          {relay.points.map((p, i) => (
            <div key={i} className="flex gap-2 items-start">
              <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug break-words">
                {p}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDelete}
          className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash size={14} /> Eliminar
        </button>
      </div>
    </div>
  );
}

export default function FleetPage() {
  const { aircraft } = useApp();
  const [relays, setRelays] = useState<Relay[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [plane, setPlane] = useState("");
  const [worker, setWorker] = useState("");
  const [points, setPoints] = useState<string[]>(["", ""]);

  useEffect(() => {
    setRelays(loadRelays());
  }, []);

  const handleAddPoint = () => setPoints((p) => [...p, ""]);
  const handleRemovePoint = (i: number) =>
    setPoints((p) => p.filter((_, idx) => idx !== i));
  const handlePointChange = (i: number, val: string) =>
    setPoints((p) => p.map((x, idx) => (idx === i ? val : x)));

  const handleSave = () => {
    if (!plane) return;
    const validPoints = points.map((p) => p.trim()).filter(Boolean);
    if (validPoints.length === 0) return;

    const newRelay: Relay = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      plane,
      worker: worker.trim() || "Sin Firma",
      points: validPoints,
    };
    const updated = [newRelay, ...relays];
    setRelays(updated);
    saveRelays(updated);
    setShowModal(false);
    setPlane("");
    setWorker("");
    setPoints(["", ""]);
  };

  const handleDelete = (id: number) => {
    if (!confirm("¿Borrar este relevo?")) return;
    const updated = relays.filter((r) => r.id !== id);
    setRelays(updated);
    saveRelays(updated);
  };

  const today = relays.filter((r) => getRelayGroup(r.timestamp) === "today");
  const yesterday = relays.filter((r) => getRelayGroup(r.timestamp) === "yesterday");
  const older = relays.filter((r) => getRelayGroup(r.timestamp) === "older");

  const sectionCls = "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2";

  const fieldCls =
    "w-full text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Notebook size={28} className="text-brand-500" /> Notas de Relevo
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 shadow-sm transition-colors"
        >
          <PlusCircle size={16} /> Nuevo Relevo
        </button>
      </div>

      {relays.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Notebook size={36} className="text-slate-400 dark:text-slate-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Sin Relevos Activos
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm max-w-xs">
            No hay notas de relevo. Crea la primera para gestionar cambios de turno.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-brand-700 transition-colors"
          >
            <PlusCircle size={18} /> Crear Primer Relevo
          </button>
        </div>
      )}

      {today.length > 0 && (
        <div>
          <p className={sectionCls}>
            <Sun size={12} className="text-emerald-500" /> Hoy ({today.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {today.map((r) => (
              <RelayCard key={r.id} relay={r} onDelete={() => handleDelete(r.id)} />
            ))}
          </div>
        </div>
      )}

      {yesterday.length > 0 && (
        <div>
          <p className={sectionCls}>
            <ClockCounterClockwise size={12} className="text-amber-500" /> Ayer ({yesterday.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {yesterday.map((r) => (
              <RelayCard key={r.id} relay={r} onDelete={() => handleDelete(r.id)} />
            ))}
          </div>
        </div>
      )}

      {older.length > 0 && (
        <div>
          <p className={sectionCls}>
            <Archive size={12} className="text-slate-400" /> Historial ({older.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {older.map((r) => (
              <RelayCard key={r.id} relay={r} onDelete={() => handleDelete(r.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <dialog
          open
          className="backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm p-0 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white m-auto"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Notebook size={18} /> Nuevo Relevo
            </h2>
            <button
              onClick={() => setShowModal(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                Avión
              </label>
              {aircraft.length > 0 ? (
                <select
                  value={plane}
                  onChange={(e) => setPlane(e.target.value)}
                  className={fieldCls}
                >
                  <option value="">Seleccionar avión...</option>
                  {aircraft.map((a) => (
                    <option key={a.reg} value={a.reg}>
                      {a.reg} · {a.airline}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={plane}
                  onChange={(e) => setPlane(e.target.value)}
                  className={fieldCls}
                  placeholder="EC-XXX"
                />
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                Técnico Firmante
              </label>
              <input
                type="text"
                value={worker}
                onChange={(e) => setWorker(e.target.value)}
                className={fieldCls}
                placeholder="Nombre..."
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">
                Novedades
              </label>
              <div className="space-y-2">
                {points.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full shrink-0" />
                    <input
                      type="text"
                      value={p}
                      onChange={(e) => handlePointChange(i, e.target.value)}
                      className={`${fieldCls} flex-1`}
                      placeholder="Escribe una novedad o tarea pendiente..."
                    />
                    <button
                      onClick={() => handleRemovePoint(i)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddPoint}
                className="mt-2 flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-medium hover:text-brand-700 transition-colors"
              >
                <Plus size={14} /> Añadir línea
              </button>
            </div>
          </div>

          <div className="flex gap-2 justify-end px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!plane || points.every((p) => !p.trim())}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 disabled:opacity-50 shadow-sm transition-colors"
            >
              Guardar Relevo
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
