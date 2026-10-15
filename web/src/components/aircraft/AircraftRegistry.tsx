"use client";

import { useState } from "react";
import { Plus, PencilSimple, Trash, FloppyDisk, MagnifyingGlass, Airplane } from "@phosphor-icons/react";
import { brokiApi, isApiError } from "@/lib/api/broki";
import type { Aircraft } from "@/lib/types/equipment";
import { Button, IconButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextField } from "@/components/ui/FormField";
import { InlineError } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

interface Props {
  aircraft: Aircraft[];
  onChanged: () => void;
}

const empty = (): Aircraft => ({ id: "", reg: "", airline: "", model: "", msn: "", motor: "" });

export function AircraftRegistry({ aircraft, onChanged }: Props) {
  const toast = useToast();
  const [editing, setEditing] = useState<Aircraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Aircraft | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = aircraft.filter((a) => {
    const q = filter.toLowerCase();
    if (!q) return true;
    return [a.reg, a.airline, a.model, a.msn, a.motor].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });

  const save = async () => {
    if (!editing?.reg.trim() || saving) return;
    setSaving(true);
    setError(null);
    const body = {
      matricula: editing.reg.trim().toUpperCase(),
      aerolinea: editing.airline.trim(),
      modelo: editing.model.trim(),
      msn: editing.msn?.trim() || null,
      motor: editing.motor?.trim() || null,
    };
    try {
      if (editing.id) await brokiApi.aircraftAction({ action: "update", id: editing.id, ...body });
      else await brokiApi.aircraftAction({ action: "create", ...body });
      toast.success(editing.id ? "Avión actualizado" : "Avión creado", body.matricula);
      setEditing(null);
      onChanged();
    } catch (e) {
      if (isApiError(e) && (e.status === 409 || e.code === "aircraft_exists")) setError("Ya existe un avión con esa matrícula.");
      else setError(e instanceof Error ? e.message : "No se pudo guardar el avión");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete?.id) return;
    await brokiApi.aircraftAction({ action: "delete", id: toDelete.id });
    toast.success("Avión eliminado", toDelete.reg);
    setToDelete(null);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative min-w-[200px] flex-1">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar matrícula, MSN, modelo…"
            aria-label="Buscar aviones"
            className="min-h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-fg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <Button icon={<Plus size={16} />} onClick={() => { setError(null); setEditing(empty()); }}>
          Nuevo avión
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-[11px] uppercase tracking-wide text-fg-subtle">
              <th className="p-3 font-semibold">Matrícula</th>
              <th className="p-3 font-semibold">Aerolínea</th>
              <th className="p-3 font-semibold">Modelo</th>
              <th className="p-3 font-semibold">MSN</th>
              <th className="p-3 font-semibold">Motor</th>
              <th className="w-24 p-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {filtered.map((a) => (
              <tr key={a.id || a.reg} className="hover:bg-subtle">
                <td className="p-3 font-bold text-fg">{a.reg}</td>
                <td className="p-3 text-fg-muted">{a.airline || "—"}</td>
                <td className="p-3 text-fg-muted">{a.model || "—"}</td>
                <td className="p-3 font-mono text-xs text-fg-muted">{a.msn || "—"}</td>
                <td className="p-3 text-fg-muted">{a.motor || "—"}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <IconButton size="sm" label={`Editar ${a.reg}`} onClick={() => { setError(null); setEditing({ ...a }); }}>
                      <PencilSimple size={16} />
                    </IconButton>
                    {a.id && (
                      <IconButton size="sm" label={`Eliminar ${a.reg}`} className="hover:text-danger" onClick={() => setToDelete(a)}>
                        <Trash size={16} />
                      </IconButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <EmptyState compact icon={<Airplane size={24} />} title={aircraft.length === 0 ? "Sin aviones en el registro" : "Sin resultados"} />
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        busy={saving}
        title={editing?.id ? `Editar ${editing.reg}` : "Nuevo avión"}
        icon={<Airplane size={18} />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button icon={<FloppyDisk size={16} />} loading={saving} disabled={!editing?.reg.trim()} onClick={() => void save()}>
              Guardar
            </Button>
          </>
        }
      >
        {editing && (
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <TextField label="Matrícula" required value={editing.reg} onChange={(e) => setEditing({ ...editing, reg: e.target.value.toUpperCase() })} placeholder="EC-XXX" autoFocus />
            <TextField label="Aerolínea" value={editing.airline} onChange={(e) => setEditing({ ...editing, airline: e.target.value })} />
            <TextField label="Modelo" value={editing.model} onChange={(e) => setEditing({ ...editing, model: e.target.value })} placeholder="Airbus A330" />
            <TextField label="MSN" value={editing.msn ?? ""} onChange={(e) => setEditing({ ...editing, msn: e.target.value })} />
            <TextField className="sm:col-span-2" label="Motor" value={editing.motor ?? ""} onChange={(e) => setEditing({ ...editing, motor: e.target.value })} />
            <div className="sm:col-span-2">
              <InlineError message={error} />
            </div>
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        danger
        title="Eliminar avión del registro"
        message={toDelete ? `Se eliminará ${toDelete.reg}. Los equipos asignados conservan la matrícula como texto.` : undefined}
        confirmLabel="Eliminar"
        onCancel={() => setToDelete(null)}
        onConfirm={remove}
      />
    </div>
  );
}
