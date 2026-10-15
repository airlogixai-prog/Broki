"use client";

import { useState } from "react";
import { Airplane, UserCircle, Van, Users, Clock, PlusCircle, FloppyDisk, Eye, Check } from "@phosphor-icons/react";
import { brokiApi, type PlannerPreviewResult } from "@/lib/api/broki";
import { PdfDropZone } from "@/components/ui/PdfDropZone";
import { useApp } from "@/context/AppContext";
import type { WorkGroup } from "@/lib/types/equipment";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/FormField";
import { InlineError } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/StatusBadge";
import { arrivalPayload, combineDayAndTime } from "@/lib/planner/time";
import { localDayKey } from "@/lib/mappers/planner";

interface Props {
  open: boolean;
  onCreated: (group: WorkGroup, importSummary?: string) => void;
  onCancel: () => void;
}

/**
 * New assignment (legacy "panel de creación", previously behind a client-side
 * PIN; now protected by Supabase Auth + RBAC on the Edge Function). With a PDF
 * the tasks are previewed (dry run) before anything is written.
 */
export function PlannerCreator({ open, onCreated, onCancel }: Props) {
  const { aircraft, personal, furgonetas } = useApp();

  const [matricula, setMatricula] = useState("");
  const [modelo, setModelo] = useState("");
  const [aerolinea, setAerolinea] = useState("");
  const [salida, setSalida] = useState("");
  const [llegada, setLlegada] = useState("");
  const [responsable, setResponsable] = useState("");
  const [furgo, setFurgo] = useState("");
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [workerSearch, setWorkerSearch] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PlannerPreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

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
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const responsables = personal.filter((p) =>
    p.qualifications.some((q) => q.includes("B1") || q.includes("B2") || q.includes("Certificador") || q.includes("CAT-A")),
  );
  const filteredWorkers = personal.filter((p) => p.name.toLowerCase().includes(workerSearch.toLowerCase()));

  const errors = {
    matricula: !matricula.trim() ? "Indica la matrícula" : null,
    salida: !salida ? "Indica la hora de salida" : !combineDayAndTime(localDayKey(new Date()), salida) ? "Hora no válida (HH:MM)" : null,
    responsable: !responsable.trim() ? "Indica el responsable" : null,
    furgo: !furgo.trim() ? "Selecciona un vehículo" : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const pdfNeedsPreview = !!pdfFile && !preview;

  // Groups are always created for today (legacy board = today); times are sent
  // as ISO timestamps because the columns are timestamptz.
  const today = localDayKey(new Date());
  const salidaIso = combineDayAndTime(today, salida);
  const arrival = arrivalPayload(today, llegada);

  const buildForm = (dryRun: boolean) => {
    const workers = Array.from(selectedWorkers);
    const formData = new FormData();
    formData.append("id_avion", matricula.toUpperCase());
    formData.append("matricula", matricula.toUpperCase());
    formData.append("modelo", modelo);
    formData.append("aerolinea", aerolinea);
    formData.append("vehiculo", furgo);
    formData.append("responsable", responsable);
    formData.append("hora_salida", salidaIso ?? "");
    formData.append("hora_llegada", arrival.hora_llegada ?? "");
    formData.append("destino", arrival.destino ?? "");
    formData.append("fecha_modificacion", new Date().toISOString());
    for (let i = 1; i <= 10; i++) formData.append(`trabajador_${i}`, workers[i - 1] ?? "");
    if (dryRun) formData.append("dry_run", "1");
    formData.append("file", pdfFile!);
    return formData;
  };

  const handlePreview = async () => {
    if (!pdfFile || previewing) return;
    setPreviewing(true);
    setError(null);
    try {
      setPreview(await brokiApi.plannerPreviewForm(buildForm(true)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el PDF.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (!valid || saving || pdfNeedsPreview) return;
    setSaving(true);
    setError(null);
    const workers = Array.from(selectedWorkers);

    try {
      if (pdfFile) {
        const result = await brokiApi.plannerActionForm(buildForm(false));
        const summary = result.duplicate
          ? (result.message ?? "Este PDF ya se había importado.")
          : `PDF importado: ${result.created ?? 0} tareas creadas, ${result.duplicates ?? 0} duplicadas, ${result.ignored ?? 0} ignoradas.`;
        onCreated(
          { id: "", matricula: matricula.toUpperCase(), modelo, aerolinea, salida, llegada, responsable, furgo, workers, tasks: [] },
          summary,
        );
      } else {
        const created = (await brokiApi.plannerAction({
          action: "create",
          id_avion: matricula.toUpperCase(),
          modelo,
          aerolinea,
          hora_salida: salidaIso,
          hora_llegada: arrival.hora_llegada,
          destino: arrival.destino,
          responsable,
          vehiculo: furgo,
          timestamp: new Date().toISOString(),
          ...workers.reduce((acc, w, i) => ({ ...acc, [`trabajador_${i + 1}`]: w }), {} as Record<string, string>),
        })) as import("@/lib/api/canonical").PlannerGroupRow;

        onCreated({
          id: String(created.id ?? ""),
          matricula: String(created.id_avion ?? matricula).toUpperCase(),
          modelo: String(created.modelo ?? modelo),
          aerolinea: String(created.aerolinea ?? aerolinea),
          salida: String(created.hora_salida ?? salida),
          llegada: String(created.hora_llegada ?? llegada),
          responsable: String(created.responsable ?? responsable),
          furgo: String(created.vehiculo ?? furgo),
          workers,
          tasks: [],
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el grupo de trabajo.");
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || previewing;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      busy={busy}
      size="lg"
      icon={<PlusCircle size={18} />}
      title="Nueva asignación"
      description="Grupo de trabajo por avión. La hoja de trabajo en PDF es opcional."
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <InlineError message={error} />
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              Cancelar
            </Button>
            {pdfNeedsPreview ? (
              <Button icon={<Eye size={16} />} loading={previewing} onClick={() => void handlePreview()}>
                Previsualizar PDF
              </Button>
            ) : (
              <Button icon={<FloppyDisk size={16} />} loading={saving} onClick={() => void handleSubmit()} disabled={touched && !valid}>
                Crear asignación
              </Button>
            )}
          </div>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (pdfNeedsPreview) void handlePreview();
          else void handleSubmit();
        }}
        noValidate
      >
        {aircraft.length > 0 ? (
          <SelectField label={<span className="flex items-center gap-1"><Airplane size={11} aria-hidden /> Matrícula avión</span>} value={matricula} onChange={(e) => handleAircraftChange(e.target.value)} required error={touched ? errors.matricula : null}>
            <option value="">Seleccionar avión…</option>
            {aircraft.map((a) => (
              <option key={a.reg} value={a.reg}>
                {a.reg} · {a.airline}
              </option>
            ))}
          </SelectField>
        ) : (
          <TextField label="Matrícula avión" value={matricula} onChange={(e) => setMatricula(e.target.value.toUpperCase())} placeholder="EC-XXX" required error={touched ? errors.matricula : null} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Airbus A330" />
          <TextField label="Aerolínea" value={aerolinea} onChange={(e) => setAerolinea(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField label={<span className="flex items-center gap-1"><Clock size={11} aria-hidden /> Hora salida</span>} type="time" value={salida} onChange={(e) => setSalida(e.target.value)} required error={touched ? errors.salida : null} />
          <div>
            <TextField
              label={<span className="flex items-center gap-1"><Clock size={11} aria-hidden /> Hora llegada</span>}
              type={llegada === "BASE" || llegada === "PRE" ? "text" : "time"}
              value={llegada}
              onChange={(e) => setLlegada(e.target.value)}
              hint="o marca En base / Pre-vuelo"
            />
            <div className="mt-1 flex gap-1.5">
              {(["BASE", "PRE"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLlegada(llegada === v ? "" : v)}
                  aria-pressed={llegada === v}
                  className={`min-h-8 rounded-md border px-2.5 text-xs font-bold ${llegada === v ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "border-border bg-surface text-fg-muted hover:bg-subtle"}`}
                >
                  {v === "BASE" ? "En base" : "Pre-vuelo"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {responsables.length > 0 ? (
            <SelectField label={<span className="flex items-center gap-1"><UserCircle size={11} aria-hidden /> Responsable</span>} value={responsable} onChange={(e) => setResponsable(e.target.value)} required error={touched ? errors.responsable : null} hint="Personal con B1/B2/CAT-A o certificador">
              <option value="">Seleccionar…</option>
              {responsables.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          ) : (
            <TextField label="Responsable" value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Nombre responsable" required error={touched ? errors.responsable : null} />
          )}
          {furgonetas.length > 0 ? (
            <SelectField label={<span className="flex items-center gap-1"><Van size={11} aria-hidden /> Vehículo</span>} value={furgo} onChange={(e) => setFurgo(e.target.value)} required error={touched ? errors.furgo : null}>
              <option value="">Seleccionar vehículo…</option>
              {furgonetas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id} · {f.model}
                </option>
              ))}
            </SelectField>
          ) : (
            <TextField label="Vehículo" value={furgo} onChange={(e) => setFurgo(e.target.value)} placeholder="FURGO-01" required error={touched ? errors.furgo : null} />
          )}
        </div>

        <fieldset>
          <legend className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            <Users size={11} aria-hidden /> Equipo ({selectedWorkers.size} seleccionados)
          </legend>
          <TextField label="Buscar trabajador" className="mb-2 [&_label]:sr-only" value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} placeholder="Buscar trabajador…" />
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {filteredWorkers.length === 0 && <p className="py-2 text-center text-xs text-fg-subtle">Sin personal cargado.</p>}
            {filteredWorkers.map((p) => {
              const selected = selectedWorkers.has(p.name);
              return (
                <label key={p.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${selected ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/20" : "border-transparent hover:bg-subtle"}`}>
                  <input type="checkbox" checked={selected} onChange={() => toggleWorker(p.name)} className="h-4 w-4 accent-brand-600" />
                  <span className="truncate font-medium text-fg">{p.name}</span>
                  {p.qualifications.length > 0 && <span className="ml-auto truncate text-[11px] text-fg-subtle">{p.qualifications.slice(0, 2).join(", ")}</span>}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Hoja de trabajo (PDF, opcional)</p>
          <PdfDropZone
            file={pdfFile}
            onFile={(f) => {
              setPdfFile(f);
              setPreview(null);
            }}
            disabled={busy}
            label="Arrastra la hoja de trabajo (PDF)"
          />
        </div>

        {preview && (
          <div className="rounded-xl border border-border bg-muted p-3" role="region" aria-label="Tareas detectadas en el PDF">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-bold text-fg">
                <Check size={14} className="text-success" aria-hidden /> {preview.tasks.length} tarea{preview.tasks.length !== 1 ? "s" : ""} detectada{preview.tasks.length !== 1 ? "s" : ""}
                {preview.matricula && <span className="font-medium text-fg-muted">· {preview.matricula}</span>}
                {preview.fecha && <span className="font-medium text-fg-muted">· {preview.fecha}</span>}
              </p>
              <span className="text-[11px] text-fg-subtle">Origen: {preview.source}</span>
            </div>
            {preview.already_imported && <p className="mb-2 text-xs font-semibold text-warning-strong">Este PDF ya se importó antes: no se crearán tareas duplicadas.</p>}
            {preview.tasks.length === 0 ? (
              <p className="text-xs text-danger-strong">No se encontraron tareas. Revisa que el PDF tenga capa de texto.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {preview.tasks.map((t, i) => (
                  <li key={`${t.codigo}-${i}`} className="flex items-start gap-2 rounded-md bg-surface p-2 text-xs">
                    <span className="shrink-0 rounded bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">{t.codigo || "—"}</span>
                    <span className="min-w-0 flex-1 text-fg">{t.descripcion}</span>
                    <Badge tone={t.prioridad?.includes("NO_GO") ? "danger" : t.prioridad?.includes("CRITICAL") ? "warning" : "neutral"} size="sm">
                      {t.prioridad ?? "NORMAL"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
