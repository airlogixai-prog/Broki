"use client";

import { useState } from "react";
import {
  Airplane,
  User,
  Van,
  UserCircle,
  Check,
  Trash,
  ArrowLineDown,
} from "@phosphor-icons/react";
import { brokiApi } from "@/lib/api/broki";
import type { WorkGroup, WorkTask } from "@/lib/types/equipment";

function formatTime(val: string | undefined | null): string | null {
  if (!val) return null;
  const d = new Date(val);
  if (!isNaN(d.getTime()) && val.includes("T")) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (/^\d{1,2}:\d{2}/.test(val)) return val.substring(0, 5);
  return val;
}

function priorityColors(priority: string): string {
  const p = priority.toUpperCase();
  if (p.includes("NO_GO"))
    return "border-red-500 text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400";
  if (p.includes("CRITICAL"))
    return "border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400";
  return "border-emerald-500 text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400";
}

interface TaskRowProps {
  task: WorkTask;
  onToggle: () => void;
  onDelete: () => void;
}

function TaskRow({ task, onToggle, onDelete }: TaskRowProps) {
  return (
    <div
      className={`group/task flex items-start gap-3 p-2 rounded-lg transition-colors ${
        task.done
          ? "bg-slate-50 dark:bg-slate-900/50 opacity-60"
          : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
      }`}
    >
      <button
        onClick={onToggle}
        className={`mt-0.5 relative flex items-center justify-center w-5 h-5 border-2 rounded shrink-0 transition-colors ${
          task.done
            ? "border-slate-400 bg-slate-400"
            : "border-slate-300 dark:border-slate-500"
        }`}
      >
        {task.done && <Check size={10} className="text-white" weight="bold" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <p
            className={`text-sm font-medium ${
              task.done
                ? "text-slate-500 line-through"
                : "text-slate-800 dark:text-slate-200"
            }`}
          >
            {task.desc}
          </p>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 shrink-0">
            {task.code}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${priorityColors(task.priority)}`}
          >
            {task.priority.replace("_", " ")}
          </span>
          <span className="text-[10px] text-slate-400">{task.type}</span>
        </div>
        {task.notes && (
          <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">
            {task.notes}
          </p>
        )}
      </div>

      <button
        onClick={onDelete}
        className="opacity-0 group-hover/task:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
      >
        <Trash size={14} />
      </button>
    </div>
  );
}

interface Props {
  group: WorkGroup;
  onUpdate: (updated: WorkGroup) => void;
  onDelete: (id: string | number) => void;
}

export function WorkGroupCard({ group, onUpdate, onDelete }: Props) {
  const [saving, setSaving] = useState(false);

  const totalTasks = group.tasks.length;
  const doneTasks = group.tasks.filter((t) => t.done).length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const jobTime = formatTime(group.salida) ?? "--:--";
  const progressColor = progress === 100 ? "bg-emerald-500" : "bg-brand-500";

  const handleToggleTask = async (idx: number) => {
    const task = group.tasks[idx];
    const updatedTasks = group.tasks.map((t, i) =>
      i === idx ? { ...t, done: !t.done } : t
    );
    onUpdate({ ...group, tasks: updatedTasks });

    setSaving(true);
    try {
      await brokiApi.plannerAction({
        action: "toggle_task",
        task_db_id: task.db_id,
        codigo: task.code,
        matricula_avion: group.matricula,
        estado: task.done ? 0 : 1,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[WorkGroupCard] toggle task error", e);
    }
    setSaving(false);
  };

  const handleDeleteTask = async (idx: number) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    const task = group.tasks[idx];
    const updatedTasks = group.tasks.filter((_, i) => i !== idx);
    onUpdate({ ...group, tasks: updatedTasks });

    try {
      await brokiApi.plannerAction({
        action: "delete_task",
        codigo: task.code,
        matricula_avion: group.matricula,
      });
    } catch (e) {
      console.error("[WorkGroupCard] delete task error", e);
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm(`¿Eliminar asignación del avión ${group.matricula}?`)) return;
    onDelete(group.id);

    try {
      await brokiApi.plannerAction({
        action: "delete",
        matricula: group.matricula,
        fecha: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[WorkGroupCard] delete group error", e);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all relative">
      {saving && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600">
            <Airplane size={20} className="text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white">
              {group.matricula}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {group.modelo}
              {group.aerolinea && ` · ${group.aerolinea}`}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`px-2 py-1 rounded text-xs font-bold ${
              progress === 100
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
            }`}
          >
            {jobTime}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mb-4 overflow-hidden">
        <div
          className={`${progressColor} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-700">
          <span className="text-slate-400 block text-[10px] uppercase mb-1">
            Responsable
          </span>
          <span className="font-medium text-slate-700 dark:text-slate-300 truncate flex items-center gap-1.5">
            <UserCircle size={14} className="text-purple-500 shrink-0" />
            {group.responsable || "--"}
          </span>
        </div>
        <div className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-700">
          <span className="text-slate-400 block text-[10px] uppercase mb-1">
            Furgoneta
          </span>
          <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Van size={14} className="text-brand-500 shrink-0" />
            {group.furgo || "--"}
          </span>
        </div>
      </div>

      {/* Workers */}
      {group.workers.length > 0 && (
        <div className="mb-3 px-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 block">
            Equipo
          </span>
          <div className="flex flex-wrap gap-1.5">
            {group.workers.map((w, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
              >
                <User size={10} /> {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tasks */}
      {totalTasks > 0 ? (
        <div className="mt-4 space-y-1 border-t border-slate-100 dark:border-slate-700 pt-3">
          {group.tasks.map((task, idx) => (
            <TaskRow
              key={task.code || idx}
              task={task}
              onToggle={() => handleToggleTask(idx)}
              onDelete={() => handleDeleteTask(idx)}
            />
          ))}
          <p className="text-[10px] text-slate-400 text-right pt-1">
            {doneTasks}/{totalTasks} · {progress}%
          </p>
        </div>
      ) : (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 text-center">
          <p className="text-xs text-slate-400 italic">Sin tareas vinculadas.</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex justify-end border-t border-slate-100 dark:border-slate-700 pt-3">
        <button
          onClick={handleDeleteGroup}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Eliminar asignación"
        >
          <Trash size={16} />
        </button>
      </div>
    </div>
  );
}
