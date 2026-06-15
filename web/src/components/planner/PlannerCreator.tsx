"use client";

import { useState } from "react";
import {
  Airplane,
  UserCircle,
  Van,
  Users,
  Clock,
  PlusCircle,
  X,
  FloppyDisk,
} from "@phosphor-icons/react";
import { brokiApi } from "@/lib/api/broki";
import { useApp } from "@/context/AppContext";
import type { WorkGroup } from "@/lib/types/equipment";

interface Props {
  onCreated: (group: WorkGroup) => void;
  onCancel: () => void;
}

export function PlannerCreator({ onCreated, onCancel }: Props) {
  const { aircraft, personal, furgonetas } = useApp();

  const [matricula, setMatricula] = useState("");
  const [modelo, setModelo] = useState("");
  const [aerolinea, setAerolinea] = useState("");
  const [salida, setSalida] = useState("");
  const [responsable, setResponsable] = useState("");
  const [furgo, setFurgo] = useState("");
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [workerSearch, setWorkerSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAircraftChange = (reg: string) => {
    setMatricula(reg);
    const ac = aircraft.find((a) => a.reg === reg);
    if (ac) {
      setModelo(ac.model);
      setAerolinea(ac.airline);
    }
  };

  const toggleWorker = (name: string) => {
    setSelectedWorkers((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const filteredWorkers = personal.filter((p) =>
    p.name.toLowerCase().includes(workerSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!matricula || !salida) return;
    setSaving(true);

    const newGroup: WorkGroup = {
      id: Date.now(),
      matricula: matricula.toUpperCase(),
      modelo,
      aerolinea,
      salida,
      responsable,
      furgo,
      workers: Array.from(selectedWorkers),
      tasks: [],
    };

    const payload = {
      action: "create",
      id_avion: newGroup.matricula,
      modelo: newGroup.modelo,
      aerolinea: newGroup.aerolinea,
      hora_salida: newGroup.salida,
      responsable: newGroup.responsable,
      vehiculo: newGroup.furgo,
      timestamp: new Date().toISOString(),
      ...Array.from(selectedWorkers).reduce(
        (acc, w, i) => ({ ...acc, [`trabajador_${i + 1}`]: w }),
        {} as Record<string, string>
      ),
    };

    try {
      await brokiApi.plannerAction(payload);
    } catch (e) {
      console.error("[PlannerCreator] create error", e);
    }

    onCreated(newGroup);
    setSaving(false);
  };

  const fieldCls =
    "w-full text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500";
  const labelCls =
    "text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
          <PlusCircle size={16} className="text-brand-500" /> Nueva Asignación
        </h3>
        <button
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Aircraft */}
        <div>
          <label className={labelCls}>
            <span className="flex items-center gap-1">
              <Airplane size={10} /> Matrícula Avión
            </span>
          </label>
          {aircraft.length > 0 ? (
            <select
              value={matricula}
              onChange={(e) => handleAircraftChange(e.target.value)}
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
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              className={fieldCls}
              placeholder="EC-XXX"
            />
          )}
        </div>

        {/* Modelo / Aerolinea - readonly if from aircraft */}
        {(modelo || aerolinea) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Modelo</label>
              <input
                type="text"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                className={fieldCls}
              />
            </div>
            <div>
              <label className={labelCls}>Aerolínea</label>
              <input
                type="text"
                value={aerolinea}
                onChange={(e) => setAerolinea(e.target.value)}
                className={fieldCls}
              />
            </div>
          </div>
        )}

        {/* Salida + Responsable */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>
              <span className="flex items-center gap-1">
                <Clock size={10} /> Hora Salida
              </span>
            </label>
            <input
              type="time"
              value={salida}
              onChange={(e) => setSalida(e.target.value)}
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              <span className="flex items-center gap-1">
                <UserCircle size={10} /> Responsable
              </span>
            </label>
            {personal.length > 0 ? (
              <select
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                className={fieldCls}
              >
                <option value="">Seleccionar...</option>
                {personal
                  .filter(
                    (p) =>
                      p.qualifications.some(
                        (q) =>
                          q.includes("B1") ||
                          q.includes("B2") ||
                          q.includes("Certificador") ||
                          q.includes("CAT-A")
                      )
                  )
                  .map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                type="text"
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                className={fieldCls}
                placeholder="Nombre responsable"
              />
            )}
          </div>
        </div>

        {/* Furgoneta */}
        <div>
          <label className={labelCls}>
            <span className="flex items-center gap-1">
              <Van size={10} /> Vehículo
            </span>
          </label>
          <select
            value={furgo}
            onChange={(e) => setFurgo(e.target.value)}
            className={fieldCls}
          >
            <option value="">Seleccionar vehículo...</option>
            {furgonetas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id} · {f.model}
              </option>
            ))}
          </select>
        </div>

        {/* Workers */}
        <div>
          <label className={labelCls}>
            <span className="flex items-center gap-1">
              <Users size={10} /> Equipo ({selectedWorkers.size} sel.)
            </span>
          </label>
          <input
            type="text"
            value={workerSearch}
            onChange={(e) => setWorkerSearch(e.target.value)}
            className={`${fieldCls} mb-2`}
            placeholder="Buscar trabajador..."
          />
          <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
            {filteredWorkers.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2 italic">
                Sin personal cargado. Activa refresco primero.
              </p>
            )}
            {filteredWorkers.map((p) => {
              const selected = selectedWorkers.has(p.name);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleWorker(p.name)}
                  className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg text-xs transition-colors ${
                    selected
                      ? "bg-brand-50 dark:bg-brand-900/20 border border-brand-300 dark:border-brand-700"
                      : "hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      selected
                        ? "bg-brand-500 border-brand-500"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    }`}
                  >
                    {selected && <Check size={10} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {p.name}
                    </p>
                    {p.qualifications.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.qualifications.slice(0, 4).map((q, i) => (
                          <span
                            key={i}
                            className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-[9px] font-bold border border-blue-200 dark:border-blue-800"
                          >
                            {q}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-2 justify-end px-5 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !matricula || !salida}
          className="px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 disabled:opacity-50 shadow-sm flex items-center gap-2 transition-colors"
        >
          {saving ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <FloppyDisk size={16} />
          )}
          Crear Asignación
        </button>
      </div>
    </div>
  );
}

function Check({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      className={className}
      fill="currentColor"
    >
      <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}
