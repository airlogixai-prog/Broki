"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  PencilSimple,
  FloppyDisk,
  MapPin,
  Airplane,
  User,
  Drop,
  Signpost,
  Gauge,
  Notepad,
  ArrowsClockwise,
  Users,
} from "@phosphor-icons/react";
import type { Equipment, IncidentState } from "@/lib/types/equipment";
import { brokiApi } from "@/lib/api/broki";
import { getFamily, getStatusClass } from "@/lib/mappers/equipment";
import { useApp } from "@/context/AppContext";
import { IncidentSection } from "./IncidentSection";

interface EditState {
  location: string;
  plane: string;
  worker: string;
  fuel: string;
  status: string;
  notes: string;
  botella_1: string;
  botella_2: string;
  botella_3: string;
  botella_4: string;
}

function toEdit(item: Equipment): EditState {
  return {
    location: item.location || item.parking || "",
    plane: item.plane || "",
    worker: item.worker || "",
    fuel: item.fuel != null ? String(item.fuel) : "",
    status: item.status || "",
    notes: item.notes || "",
    botella_1: String(item.botella_1 ?? item.pressures?.[0] ?? 0),
    botella_2: String(item.botella_2 ?? item.pressures?.[1] ?? 0),
    botella_3: String(item.botella_3 ?? item.pressures?.[2] ?? 0),
    botella_4: String(item.botella_4 ?? item.pressures?.[3] ?? 0),
  };
}

interface Props {
  item: Equipment | null;
  onClose: () => void;
}

export function EquipmentDetailModal({ item, onClose }: Props) {
  const { incidentsMemory, setIncidentsMemory, furgonetas, gse } = useApp();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (item) {
      setEditing(false);
      setEditState(null);
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [item]);

  const handleClose = () => {
    setEditing(false);
    onClose();
  };

  const handleEdit = () => {
    if (!item) return;
    setEditState(toEdit(item));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!item || !editState) return;
    setSaving(true);

    const payload = {
      action: "update_equipment",
      item_id: item.id,
      type: item.type,
      updates: {
        location: editState.location,
        plane: editState.plane,
        worker: editState.worker,
        notes: editState.notes,
        ...(item.type === "furgo"
          ? { fuel: editState.fuel }
          : { status: editState.status }),
        ...(getFamily(item).includes("Nitrógeno") || getFamily(item).includes("Nitrogeno")
          ? {
              nitrogeno_1: editState.botella_1,
              nitrogeno_2: editState.botella_2,
              nitrogeno_3: editState.botella_3,
              nitrogeno_4: editState.botella_4,
            }
          : {}),
      },
      timestamp: new Date().toISOString(),
    };

    try {
      await brokiApi.updateEquipment(payload);
    } catch (e) {
      console.error("[EquipmentDetailModal] save error", e);
    }

    setSaving(false);
    setEditing(false);
  };

  const incState: IncidentState = item
    ? incidentsMemory[item.id] ?? { current: null, history: [] }
    : { current: null, history: [] };

  const handleIncidentUpdate = (updated: IncidentState) => {
    if (!item) return;
    setIncidentsMemory({ ...incidentsMemory, [item.id]: updated });
  };

  if (!item) return null;

  const family = getFamily(item);
  const isNitrogen = family.toUpperCase().includes("NITR");
  const statusClass = getStatusClass(item.status);
  const subtitle =
    item.type === "furgo" ? `${item.model} • ${item.plate}` : item.model;

  const fieldCls =
    "bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700";
  const labelCls =
    "text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-1 flex items-center gap-1";
  const valueCls = "text-slate-900 dark:text-white font-semibold text-sm truncate";
  const inputCls =
    "w-full text-slate-900 dark:text-white font-semibold text-sm bg-transparent outline-none border-b border-transparent focus:border-brand-400";

  const efield = (
    label: string,
    key: keyof EditState,
    Icon: React.ElementType,
    type = "text"
  ) => (
    <div className="bg-white dark:bg-slate-700 p-2 rounded-lg border border-brand-200 dark:border-brand-800 flex flex-col justify-center focus-within:ring-2 focus-within:ring-brand-500">
      <p className={`${labelCls} text-brand-600 dark:text-brand-400`}>
        <Icon size={10} /> {label}
      </p>
      <input
        type={type}
        value={editState?.[key] ?? ""}
        onChange={(e) =>
          setEditState((s) => s && { ...s, [key]: e.target.value })
        }
        className={inputCls}
      />
    </div>
  );

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm p-0 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white max-h-[90vh] overflow-hidden flex flex-col m-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-2xl font-bold">
            {item.id.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {item.id}
              </h2>
              <span className="px-2 py-0.5 bg-slate-600 text-white rounded text-xs font-bold tracking-wide">
                {family.toUpperCase()}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold border uppercase tracking-wide ${statusClass}`}
              >
                {item.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Info grid */}
        <div>
          <div className="grid grid-cols-2 gap-3">
            {!editing ? (
              <>
                <div className={fieldCls}>
                  <p className={labelCls}>
                    <MapPin size={10} /> Ubicación
                  </p>
                  <p className={valueCls}>{item.location || item.parking || "-"}</p>
                </div>
                <div className={fieldCls}>
                  <p className={labelCls}>
                    <Airplane size={10} /> Avión Asignado
                  </p>
                  <p className={valueCls}>{item.plane || "-"}</p>
                </div>
                <div className={fieldCls}>
                  <p className={labelCls}>
                    <User size={10} /> Operario
                  </p>
                  <p className={valueCls}>{item.worker || "-"}</p>
                </div>
                {item.type === "furgo" ? (
                  <div className={fieldCls}>
                    <p className={labelCls}>
                      <Drop size={10} /> Combustible
                    </p>
                    <p className={valueCls}>{item.fuel != null ? `${item.fuel}%` : "-"}</p>
                  </div>
                ) : (
                  <div className={fieldCls}>
                    <p className={labelCls}>
                      <Signpost size={10} /> Parking
                    </p>
                    <p className={valueCls}>{item.parking || "-"}</p>
                  </div>
                )}
                {item.type === "furgo" && item.seats != null && (
                  <div className={fieldCls}>
                    <p className={labelCls}>
                      <Users size={10} /> Plazas
                    </p>
                    <p className={valueCls}>{item.seats}</p>
                  </div>
                )}
                {item.notes && (
                  <div className="col-span-2 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200">
                    <strong className="block mb-1 font-bold text-amber-700 dark:text-amber-400 uppercase">
                      Notas:
                    </strong>
                    {item.notes}
                  </div>
                )}
              </>
            ) : (
              <>
                {efield("Ubicación (Parking)", "location", MapPin)}
                {efield("Avión Asignado", "plane", Airplane)}
                {efield("Operario", "worker", User)}
                {item.type === "furgo"
                  ? efield("Combustible (%)", "fuel", Drop, "number")
                  : efield("Estado", "status", Gauge)}
                {isNitrogen && (
                  <>
                    {efield("Botella 1 (PSI)", "botella_1", Gauge, "number")}
                    {efield("Botella 2 (PSI)", "botella_2", Gauge, "number")}
                    {efield("Botella 3 (PSI)", "botella_3", Gauge, "number")}
                    {efield("Botella 4 (PSI)", "botella_4", Gauge, "number")}
                  </>
                )}
                <div className="col-span-2 bg-white dark:bg-slate-700 p-2 rounded-lg border border-brand-200 dark:border-brand-800 focus-within:ring-2 focus-within:ring-brand-500">
                  <p className={`${labelCls} text-brand-600 dark:text-brand-400`}>
                    <Notepad size={10} /> Notas Adicionales
                  </p>
                  <textarea
                    value={editState?.notes ?? ""}
                    onChange={(e) =>
                      setEditState((s) => s && { ...s, notes: e.target.value })
                    }
                    rows={2}
                    className="w-full text-slate-900 dark:text-white text-xs bg-transparent outline-none resize-none"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Incidents */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
            Incidencias
          </h3>
          <IncidentSection
            item={item}
            incidentState={incState}
            onUpdate={handleIncidentUpdate}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <button
          onClick={handleClose}
          className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          Cerrar
        </button>

        {!editing ? (
          <button
            onClick={handleEdit}
            className="px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 shadow-sm transition-colors flex items-center gap-2 text-sm"
          >
            <PencilSimple size={16} /> Editar Información
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2 text-sm disabled:opacity-60"
            >
              {saving ? (
                <ArrowsClockwise size={16} className="animate-spin" />
              ) : (
                <FloppyDisk size={16} />
              )}
              Guardar Cambios
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
