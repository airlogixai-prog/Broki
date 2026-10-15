"use client";

import { useState } from "react";
import { Airplane, User, Van, UserCircle, Trash, Clock, AirplaneLanding, AirplaneTakeoff } from "@phosphor-icons/react";
import { brokiApi } from "@/lib/api/broki";
import type { WorkGroup, WorkTask } from "@/lib/types/equipment";
import { Badge } from "@/components/ui/StatusBadge";
import { IconButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InlineError } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";

function formatTime(val: string | undefined | null): string | null {
  if (!val) return null;
  const d = new Date(val);
  if (!isNaN(d.getTime()) && val.includes("T")) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (/^\d{1,2}:\d{2}/.test(val)) return val.substring(0, 5);
  return val;
}

function priorityTone(priority: string): "danger" | "warning" | "success" | "neutral" {
  const p = priority.toUpperCase();
  if (p.includes("NO_GO") || p.includes("NO GO")) return "danger";
  if (p.includes("CRITICAL") || p.includes("CRÍTIC")) return "warning";
  if (p.includes("GO_IF")) return "warning";
  return "success";
}

function TaskRow({ task, busy, onToggle, onDelete }: { task: WorkTask; busy: boolean; onToggle: () => void; onDelete: () => void }) {
  const id = `task-${task.db_id || task.code}`;
  return (
    <li className={`group/task flex items-start gap-3 rounded-lg p-2 transition-colors ${task.done ? "bg-muted opacity-70" : "hover:bg-subtle"}`}>
      <input
        id={id}
        type="checkbox"
        checked={task.done}
        disabled={busy}
        onChange={onToggle}
        className="mt-1 h-5 w-5 shrink-0 accent-brand-600"
        aria-label={`${task.done ? "Reabrir" : "Completar"} tarea ${task.code || task.desc}`}
      />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="flex items-start justify-between gap-2">
          <span className={`text-sm font-medium ${task.done ? "text-fg-muted line-through" : "text-fg"}`}>{task.desc || task.code}</span>
          {task.code && <span className="shrink-0 rounded bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">{task.code}</span>}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <Badge tone={priorityTone(task.priority)} size="sm">
            {task.priority.replace("_", " ")}
          </Badge>
          {task.type && <span className="text-[11px] text-fg-subtle">{task.type}</span>}
        </span>
        {task.notes && <span className="mt-1 block text-xs text-brand-700 dark:text-brand-300">{task.notes}</span>}
      </label>
      <IconButton size="sm" label={`Eliminar tarea ${task.code || task.desc}`} className="hover:text-danger sm:opacity-0 sm:group-hover/task:opacity-100 sm:focus-visible:opacity-100" onClick={onDelete} disabled={busy}>
        <Trash size={14} />
      </IconButton>
    </li>
  );
}

interface Props {
  group: WorkGroup;
  onUpdate: (updated: WorkGroup) => void;
  onDelete: (id: string) => void;
}

export function WorkGroupCard({ group, onUpdate, onDelete }: Props) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "group" } | { kind: "task"; idx: number } | null>(null);

  const totalTasks = group.tasks.length;
  const doneTasks = group.tasks.filter((t) => t.done).length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const salida = formatTime(group.salida);
  const llegadaRaw = (group.llegada || "").toUpperCase();
  const llegada = llegadaRaw === "BASE" || llegadaRaw === "PRE" ? llegadaRaw : formatTime(group.llegada);

  const handleToggleTask = async (idx: number) => {
    if (saving) return;
    const task = group.tasks[idx];
    if (!task.db_id) {
      setError("Tarea sin identificador. Recarga la página.");
      return;
    }
    const prev = group.tasks;
    onUpdate({ ...group, tasks: group.tasks.map((t, i) => (i === idx ? { ...t, done: !t.done } : t)) });
    setSaving(true);
    setError(null);
    try {
      await brokiApi.plannerAction({ action: "toggle_task", task_id: task.db_id, estado: task.done ? 0 : 1, timestamp: new Date().toISOString() });
    } catch (e) {
      onUpdate({ ...group, tasks: prev });
      setError(e instanceof Error ? e.message : "No se pudo actualizar la tarea.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (idx: number) => {
    const task = group.tasks[idx];
    if (!task.db_id) throw new Error("Tarea sin identificador. Recarga la página.");
    await brokiApi.plannerAction({ action: "delete_task", task_id: task.db_id });
    onUpdate({ ...group, tasks: group.tasks.filter((_, i) => i !== idx) });
    toast.success("Tarea eliminada", task.code || task.desc);
  };

  const deleteGroup = async () => {
    if (!group.id) throw new Error("Grupo sin identificador. Recarga la página.");
    await brokiApi.plannerAction({ action: "delete", group_id: group.id });
    onDelete(group.id);
    toast.success("Asignación eliminada", group.matricula);
  };

  return (
    <article className="relative rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5" aria-label={`Asignación ${group.matricula}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-subtle text-fg-muted" aria-hidden>
            <Airplane size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-tight text-fg">{group.matricula}</h3>
            <p className="truncate text-xs text-fg-muted">
              {[group.modelo, group.aerolinea].filter(Boolean).join(" · ") || "Sin modelo"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={progress === 100 ? "success" : "info"} icon={<AirplaneTakeoff size={12} aria-hidden />}>
            Salida {salida ?? "--:--"}
          </Badge>
          {llegada && (
            <Badge tone="neutral" size="sm" icon={<AirplaneLanding size={12} aria-hidden />}>
              {llegada === "BASE" ? "En base" : llegada === "PRE" ? "Pre-vuelo" : `ETA ${llegada}`}
            </Badge>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de tareas">
          <div className={`h-2 rounded-full transition-all duration-500 ${progress === 100 ? "bg-success" : "bg-brand-500"}`} style={{ width: `${progress}%` }} />
        </div>
        <span className="tabular text-xs font-semibold text-fg-muted">
          {doneTasks}/{totalTasks} · {progress} %
        </span>
      </div>

      <dl className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-border-subtle bg-muted p-2">
          <dt className="mb-0.5 text-[11px] uppercase tracking-wide text-fg-subtle">Responsable</dt>
          <dd className="flex items-center gap-1.5 truncate font-medium text-fg">
            <UserCircle size={14} className="shrink-0 text-brand-500" aria-hidden />
            {group.responsable || "—"}
          </dd>
        </div>
        <div className="rounded-lg border border-border-subtle bg-muted p-2">
          <dt className="mb-0.5 text-[11px] uppercase tracking-wide text-fg-subtle">Furgoneta</dt>
          <dd className="flex items-center gap-1.5 truncate font-medium text-fg">
            <Van size={14} className="shrink-0 text-brand-500" aria-hidden />
            {group.furgo || "—"}
          </dd>
        </div>
      </dl>

      {group.workers.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Equipo ({group.workers.length})</p>
          <ul className="flex flex-wrap gap-1.5">
            {group.workers.map((w, i) => (
              <li key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-fg-muted">
                <User size={10} aria-hidden /> {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      <InlineError message={error} />

      {totalTasks > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-border-subtle pt-3" aria-label="Tareas">
          {group.tasks.map((task, idx) => (
            <TaskRow key={task.db_id || `${task.code}-${idx}`} task={task} busy={saving} onToggle={() => void handleToggleTask(idx)} onDelete={() => setConfirm({ kind: "task", idx })} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-border-subtle pt-3 text-center text-xs text-fg-subtle">Sin tareas vinculadas.</p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3 text-[11px] text-fg-subtle">
        <span className="flex items-center gap-1">
          <Clock size={12} aria-hidden /> {saving ? "Guardando…" : "Sincronizado"}
        </span>
        <IconButton size="sm" label={`Eliminar asignación ${group.matricula}`} className="hover:text-danger" onClick={() => setConfirm({ kind: "group" })}>
          <Trash size={16} />
        </IconButton>
      </div>

      <ConfirmDialog
        open={confirm?.kind === "group"}
        danger
        title="Eliminar asignación"
        message={`Se eliminará la asignación de ${group.matricula} con sus ${totalTasks} tarea${totalTasks !== 1 ? "s" : ""}.`}
        confirmLabel="Eliminar"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await deleteGroup();
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === "task"}
        danger
        title="Eliminar tarea"
        message={confirm?.kind === "task" ? `${group.tasks[confirm.idx]?.code || ""} ${group.tasks[confirm.idx]?.desc || ""}`.trim() : undefined}
        confirmLabel="Eliminar"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.kind !== "task") return;
          await deleteTask(confirm.idx);
          setConfirm(null);
        }}
      />
    </article>
  );
}
