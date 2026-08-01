"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarCheck,
  ArrowsClockwise,
  PlusCircle,
  AirplaneTakeoff,
} from "@phosphor-icons/react";
import { brokiApi } from "@/lib/api/broki";
import { WorkGroupCard } from "@/components/planner/WorkGroupCard";
import { PlannerCreator } from "@/components/planner/PlannerCreator";
import { mergePlannerData } from "@/lib/mappers/planner";
import type { WorkGroup } from "@/lib/types/equipment";

export default function PlannerPage() {
  const [assignments, setAssignments] = useState<WorkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // The legacy dashboard gated this behind a PIN hardcoded in the page source,
  // which anyone could read. Reaching /broki already requires a Supabase session
  // (see lib/supabase/middleware.ts), so the prompt only added friction.
  const openCreator = () => setShowCreator(true);

  const fetchPlanner = useCallback(async (alive: () => boolean = () => true) => {
    setLoading(true);
    try {
      const [groupsRes, tasksRes] = await Promise.all([
        brokiApi.fetchPlannerGroups().catch(() => []),
        brokiApi.fetchPlannerTasks().catch(() => []),
      ]);
      if (!alive()) return;
      setAssignments(
        mergePlannerData(
          Array.isArray(groupsRes) ? groupsRes : [],
          Array.isArray(tasksRes) ? tasksRes : []
        )
      );
    } catch (e) {
      console.error("[PlannerPage] fetch error", e);
    }
    if (alive()) setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await fetchPlanner(() => alive);
    })();
    return () => {
      alive = false;
    };
  }, [fetchPlanner]);

  const handleUpdate = (updated: WorkGroup) => {
    setAssignments((prev) =>
      prev.map((g) => (g.id === updated.id ? updated : g))
    );
  };

  const handleDelete = (id: string) => {
    setAssignments((prev) => prev.filter((g) => g.id !== id));
  };

  const handleCreated = (group: WorkGroup, importSummary?: string) => {
    setShowCreator(false);
    setNotice(importSummary ?? null);
    if (importSummary) {
      // A PDF import creates its own groups and tasks server-side, so read them
      // back instead of guessing what landed.
      void fetchPlanner();
    } else {
      setAssignments((prev) => [group, ...prev]);
    }
  };

  const todayLabel = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <CalendarCheck size={28} className="text-brand-500" /> Planificador
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
            {todayLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchPlanner()}
            disabled={loading}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            title="Refrescar"
          >
            <ArrowsClockwise size={18} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => (showCreator ? setShowCreator(false) : openCreator())}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 shadow-sm transition-colors"
          >
            <PlusCircle size={16} />
            {showCreator ? "Cancelar" : "Nueva Asignación"}
          </button>
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}

      {/* Creator panel */}
      {showCreator && (
        <PlannerCreator
          onCreated={handleCreated}
          onCancel={() => setShowCreator(false)}
        />
      )}

      {/* Loading */}
      {loading && assignments.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-4">
          <ArrowsClockwise size={32} className="text-brand-500 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Cargando planificador...
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && assignments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <AirplaneTakeoff size={36} className="text-slate-400 dark:text-slate-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Sin asignaciones hoy
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm max-w-xs">
            No hay grupos de trabajo programados para hoy. Crea una nueva
            asignación.
          </p>
          <button
            onClick={openCreator}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-brand-700 transition-colors"
          >
            <PlusCircle size={18} /> Crear Asignación
          </button>
        </div>
      )}

      {/* Grid */}
      {assignments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((group) => (
            <WorkGroupCard
              key={group.id}
              group={group}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
