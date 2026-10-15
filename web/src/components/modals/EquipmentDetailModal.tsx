"use client";

import { useState } from "react";
import {
  PencilSimple,
  FloppyDisk,
  MapPin,
  Airplane,
  User,
  Drop,
  Signpost,
  Gauge,
  Users,
  ArrowsClockwise,
  Van,
  Wrench,
} from "@phosphor-icons/react";
import type { Equipment, IncidentState } from "@/lib/types/equipment";
import { brokiApi, isApiError } from "@/lib/api/broki";
import { getFamily, toNumber, splitInventory } from "@/lib/mappers/equipment";
import type { AssetRow } from "@/lib/api/canonical";
import { EQUIPMENT_STATUSES, validateEquipmentFields, type EquipmentFormValues, type FieldErrors } from "@/lib/validators/equipment";
import { useApp } from "@/context/AppContext";
import { IncidentSection } from "./IncidentSection";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusBadge, Badge } from "@/components/ui/StatusBadge";
import { SelectField, TextField, TextareaField } from "@/components/ui/FormField";
import { InlineError } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { isNitrogen as isNitrogenItem, nitrogenReadings, usesFuel } from "@/lib/equipment/kpis";

type EditState = EquipmentFormValues;

function toEdit(item: Equipment): EditState {
  const b = nitrogenReadings(item);
  return {
    parking: item.parking || "",
    usualLocation: item.usualLocation || item.location || "",
    plane: item.plane || "",
    worker: item.worker || "",
    fuel: item.fuel != null ? String(item.fuel) : "",
    adblue: item.adblue != null ? String(item.adblue) : "",
    status: item.status || "",
    notes: item.notes || "",
    botella_1: b[0] != null ? String(b[0]) : "",
    botella_2: b[1] != null ? String(b[1]) : "",
    botella_3: b[2] != null ? String(b[2]) : "",
    botella_4: b[3] != null ? String(b[3]) : "",
  };
}

function editStateToPatch(item: Equipment, s: EditState): Partial<Equipment> {
  const patch: Partial<Equipment> = {
    parking: s.parking,
    usualLocation: s.usualLocation,
    location: s.usualLocation,
    plane: s.plane,
    worker: s.worker,
    notes: s.notes,
    status: s.status,
  };
  if (item.type === "furgo" || usesFuel(item) || item.fuel != null) patch.fuel = s.fuel.trim() ? toNumber(s.fuel, 0) : null;
  if (item.type === "furgo" || item.adblue != null) patch.adblue = s.adblue.trim() ? toNumber(s.adblue, 0) : null;
  if (isNitrogenItem(item)) {
    const vals = [s.botella_1, s.botella_2, s.botella_3, s.botella_4].map((v) => (v.trim() ? toNumber(v, 0) : null));
    patch.botella_1 = vals[0];
    patch.botella_2 = vals[1];
    patch.botella_3 = vals[2];
    patch.botella_4 = vals[3];
    patch.pressures = vals.map((v) => v ?? 0);
  }
  return patch;
}

function Field({ icon, label, value, title }: { icon?: React.ReactNode; label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-muted p-3" title={title}>
      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
        {icon}
        {label}
      </p>
      <p className="truncate text-sm font-semibold text-fg">{value}</p>
    </div>
  );
}

interface Props {
  item: Equipment | null;
  onClose: () => void;
}

export function EquipmentDetailModal({ item, onClose }: Props) {
  const { incidentsMemory, patchIncidentState, refreshRef, patchEquipment } = useApp();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stale, setStale] = useState<Equipment | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // The draft records which equipment it belongs to, so selecting a different
  // item discards it without an effect that resets state on every prop change.
  // expectedUpdatedAt is frozen here too: `item` keeps refreshing from Realtime,
  // and sending its live updated_at would defeat the conflict check.
  const [draft, setDraft] = useState<{ itemId: string; state: EditState; expectedUpdatedAt: string | null } | null>(null);

  const editing = !!item && draft?.itemId === item.id;
  const editState = editing ? draft!.state : null;

  const update = (patch: Partial<EditState>) =>
    setDraft((prev) => (prev ? { ...prev, state: { ...prev.state, ...patch } } : prev));

  const handleClose = () => {
    if (saving) return;
    setDraft(null);
    setStale(null);
    setSaveError(null);
    setFieldErrors({});
    onClose();
  };

  const handleEdit = () => {
    if (!item) return;
    setSaveError(null);
    setStale(null);
    setFieldErrors({});
    setDraft({ itemId: item.id, state: toEdit(item), expectedUpdatedAt: item.updatedAt ?? null });
  };

  const handleSave = async () => {
    if (!item || !editState) return;
    const nitro = isNitrogenItem(item);
    const errors = validateEquipmentFields(editState, { isFurgo: item.type === "furgo" || usesFuel(item) || item.fuel != null, isNitrogen: nitro });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSaveError("Revisa los campos marcados.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setStale(null);

    // Rollback restores only this item (other equipment may legitimately change meanwhile).
    const snapshot: Partial<Equipment> = { ...item };
    patchEquipment(item.id, editStateToPatch(item, editState));

    const payload = {
      action: "update_equipment",
      item_id: item.id,
      type: item.type,
      expected_updated_at: draft?.expectedUpdatedAt ?? null,
      updates: {
        parking: editState.parking,
        usual_location: editState.usualLocation,
        plane: editState.plane,
        worker: editState.worker,
        notes: editState.notes,
        status: editState.status,
        ...(item.type === "furgo" || usesFuel(item) || item.fuel != null ? { fuel: editState.fuel } : {}),
        ...(item.type === "furgo" || item.adblue != null ? { adblue: editState.adblue } : {}),
        ...(nitro
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
      const row = await brokiApi.updateEquipment(payload);
      if (row && typeof row === "object" && "updated_at" in row) {
        patchEquipment(item.id, { updatedAt: (row as AssetRow).updated_at ?? null });
      }
      refreshRef.current?.();
      setDraft(null);
      toast.success("Cambios guardados", `${item.id} actualizado.`);
    } catch (e) {
      patchEquipment(item.id, snapshot);
      if (isApiError(e, "stale_update")) {
        const current = e.payload?.current as AssetRow | undefined;
        if (current) {
          const { furgonetas: f, gse: g } = splitInventory([current]);
          const fresh = f[0] ?? g[0];
          if (fresh) setStale(fresh);
        }
        setSaveError(e.message);
      } else {
        setSaveError(e instanceof Error ? e.message : "No se pudieron guardar los cambios.");
      }
    } finally {
      setSaving(false);
    }
  };

  const reloadFromServer = () => {
    if (!item || !stale) return;
    patchEquipment(item.id, { ...stale });
    setDraft({ itemId: item.id, state: toEdit(stale), expectedUpdatedAt: stale.updatedAt ?? null });
    setStale(null);
    setSaveError(null);
  };

  const incState: IncidentState = item ? incidentsMemory[item.id] ?? { current: null, history: [] } : { current: null, history: [] };
  const handleIncidentUpdate = (updated: IncidentState) => {
    if (!item) return;
    patchIncidentState(item.id, updated);
  };

  if (!item) return null;

  const family = getFamily(item);
  const nitro = isNitrogenItem(item);
  // Fuel applies to vans and to motorised GSE (GPU, generators…), same rule as the KPIs.
  const showFuel = item.type === "furgo" || usesFuel(item) || item.fuel != null;
  const bottles = nitrogenReadings(item);
  const subtitle = [item.model, item.type === "furgo" ? item.plate : null].filter(Boolean).join(" · ");
  const statusOptions = EQUIPMENT_STATUSES.includes(item.status as (typeof EQUIPMENT_STATUSES)[number]) || !item.status
    ? [...EQUIPMENT_STATUSES]
    : [item.status, ...EQUIPMENT_STATUSES];

  return (
    <Modal
      open
      onClose={handleClose}
      busy={saving}
      size="lg"
      icon={item.type === "furgo" ? <Van size={18} /> : <Wrench size={18} />}
      title={
        <span className="flex flex-wrap items-center gap-2">
          {item.id}
          <Badge tone="neutral" size="sm">{family}</Badge>
          <StatusBadge status={item.status} size="sm" />
        </span>
      }
      description={subtitle || undefined}
      footer={
        !editing ? (
          <>
            <Button variant="secondary" onClick={handleClose}>
              Cerrar
            </Button>
            <Button icon={<PencilSimple size={16} />} onClick={handleEdit}>
              Editar información
            </Button>
          </>
        ) : (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <InlineError message={saveError} />
              {stale && (
                <Button variant="secondary" size="sm" className="mt-1" icon={<ArrowsClockwise size={14} />} onClick={reloadFromServer}>
                  Cargar versión actual
                </Button>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => setDraft(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="success" icon={<FloppyDisk size={16} />} loading={saving} onClick={handleSave}>
                Guardar cambios
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="space-y-6">
        {!editing ? (
          <div className="grid grid-cols-2 gap-3">
            <Field icon={<MapPin size={11} aria-hidden />} label="Ubicación habitual" value={item.usualLocation || item.location || "—"} />
            <Field icon={<Signpost size={11} aria-hidden />} label="Parking actual" value={item.parking || "—"} title="Posición actual (distinta de la ubicación habitual)" />
            <Field icon={<Airplane size={11} aria-hidden />} label="Avión asignado" value={item.plane || "—"} />
            <Field icon={<User size={11} aria-hidden />} label="Operario" value={item.worker || "—"} />
            {showFuel && <Field icon={<Drop size={11} aria-hidden />} label="Combustible" value={item.fuel != null ? `${item.fuel} %` : "Sin lectura"} />}
            {(item.type === "furgo" || item.adblue != null) && <Field icon={<Drop size={11} aria-hidden />} label="AdBlue" value={item.adblue != null ? `${item.adblue} %` : "Sin lectura"} />}
            {item.plate && <Field label="Matrícula" value={item.plate} />}
            {item.seats != null && item.seats > 0 && <Field icon={<Users size={11} aria-hidden />} label="Plazas" value={item.seats} />}
            {item.model && <Field label="Descripción" value={item.model} />}
            {nitro && (
              <div className="col-span-2 rounded-lg border border-border-subtle bg-muted p-3">
                <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                  <Gauge size={11} aria-hidden /> Presión botellas (PSI)
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="rounded-md border border-border bg-surface p-2 text-center">
                      <p className="text-[11px] text-fg-subtle">#{i + 1}</p>
                      <p className="tabular text-sm font-bold text-fg">{bottles[i] ?? "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {item.notes && (
              <div className="col-span-2 rounded-lg border border-warning/30 bg-warning-muted p-3 text-xs text-fg">
                <strong className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-warning-strong">Notas</strong>
                <span className="whitespace-pre-wrap">{item.notes}</span>
              </div>
            )}
          </div>
        ) : (
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            noValidate
          >
            <SelectField label="Estado" value={editState!.status} onChange={(e) => update({ status: e.target.value })} error={fieldErrors.status} required>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
            <TextField label="Ubicación habitual" value={editState!.usualLocation} onChange={(e) => update({ usualLocation: e.target.value })} placeholder="T4S, BASE…" />
            <TextField label="Parking actual" value={editState!.parking} onChange={(e) => update({ parking: e.target.value })} placeholder="542" hint="Posición actual; vacío si está en su ubicación habitual" />
            <TextField label="Avión asignado" value={editState!.plane} onChange={(e) => update({ plane: e.target.value.toUpperCase() })} list="broki-aircraft-regs" placeholder="EC-XXX" error={fieldErrors.plane} />
            <TextField label="Operario" value={editState!.worker} onChange={(e) => update({ worker: e.target.value })} list="broki-personnel-names" />
            {showFuel && <TextField label="Combustible (%)" type="number" inputMode="numeric" min={0} max={100} value={editState!.fuel} onChange={(e) => update({ fuel: e.target.value })} error={fieldErrors.fuel} />}
            {(item.type === "furgo" || item.adblue != null) && (
              <TextField label="AdBlue (%)" type="number" inputMode="numeric" min={0} max={100} value={editState!.adblue} onChange={(e) => update({ adblue: e.target.value })} error={fieldErrors.adblue} />
            )}
            {nitro &&
              (["botella_1", "botella_2", "botella_3", "botella_4"] as const).map((k, i) => (
                <TextField key={k} label={`Botella ${i + 1} (PSI)`} type="number" inputMode="numeric" min={0} value={editState![k]} onChange={(e) => update({ [k]: e.target.value } as Partial<EditState>)} error={fieldErrors[k]} />
              ))}
            <TextareaField className="sm:col-span-2" label="Notas" value={editState!.notes} onChange={(e) => update({ notes: e.target.value })} error={fieldErrors.notes} rows={3} />
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        )}

        <section className="border-t border-border-subtle pt-5" aria-label="Incidencias del equipo">
          <h3 className="mb-3 text-sm font-bold text-fg">Incidencias</h3>
          <IncidentSection item={item} incidentState={incState} onUpdate={handleIncidentUpdate} />
        </section>
      </div>
    </Modal>
  );
}
