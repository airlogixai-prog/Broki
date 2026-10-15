"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarCheck, ArrowsClockwise, PlusCircle, AirplaneTakeoff } from "@phosphor-icons/react";
import { brokiApi } from "@/lib/api/broki";
import { WorkGroupCard } from "@/components/planner/WorkGroupCard";
import { PlannerCreator } from "@/components/planner/PlannerCreator";
import { useBrokiRealtime } from "@/lib/hooks/useBrokiRealtime";
import { OperationalSyncBar } from "@/components/ui/OperationalSyncBar";
import { mergePlannerData, localDayKey } from "@/lib/mappers/planner";
import type { WorkGroup } from "@/lib/types/equipment";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { BlockSkeleton } from "@/components/ui/BlockSkeleton";
import { DateSelector, formatDayLong } from "@/components/ui/DateSelector";
import { useToast } from "@/components/ui/Toast";
import { useHydrated } from "@/lib/hooks/useHydrated";

export default function PlannerPage() {
  const toast = useToast();
  const hydrated = useHydrated();
  const [day, setDay] = useState(() => localDayKey(new Date()));
  const [assignments, setAssignments] = useState<WorkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  // Remount the creator on every open so no draft/preview/PDF leaks between assignments.
  const [creatorKey, setCreatorKey] = useState(0);
  const openCreator = () => {
    setCreatorKey((k) => k + 1);
    setShowCreator(true);
  };

  const fetchPlanner = useCallback(
    async (alive: () => boolean = () => true, forDay = day) => {
      setLoading(true);
      try {
        const [groupsRes, tasksRes] = await Promise.all([brokiApi.fetchPlannerGroups(), brokiApi.fetchPlannerTasks()]);
        if (!alive()) return;
        setAssignments(mergePlannerData(Array.isArray(groupsRes) ? groupsRes : [], Array.isArray(tasksRes) ? tasksRes : [], { day: forDay }));
        setError(null);
      } catch (e) {
        if (alive()) setError(e instanceof Error ? e.message : "No se pudo cargar el planificador.");
      }
      if (alive()) setLoading(false);
    },
    [day],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      await fetchPlanner(() => alive);
    })();
    return () => {
      alive = false;
    };
  }, [fetchPlanner]);

  const realtime = useBrokiRealtime(["broki_planner_groups", "broki_planner_tasks", "broki_planner_group_members"], () => fetchPlanner());

  const handleUpdate = (updated: WorkGroup) => setAssignments((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  const handleDelete = (id: string) => setAssignments((prev) => prev.filter((g) => g.id !== id));

  const handleCreated = (group: WorkGroup, importSummary?: string) => {
    setShowCreator(false);
    const today = localDayKey(new Date());
    if (day !== today) setDay(today);
    if (importSummary) {
      toast.success("Hoja de trabajo importada", importSummary);
      void fetchPlanner(() => true, today);
    } else {
      toast.success("Asignación creada", group.matricula);
      // Read back so members/tasks come from the server instead of the optimistic shell.
      void fetchPlanner(() => true, today);
      setAssignments((prev) => [group, ...prev.filter((g) => g.id !== group.id)]);
    }
  };

  const isToday = day === localDayKey(new Date());
  const totalTasks = assignments.reduce((n, g) => n + g.tasks.length, 0);
  const doneTasks = assignments.reduce((n, g) => n + g.tasks.filter((t) => t.done).length, 0);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Planificador"
        subtitle={
          <span>
            {hydrated ? formatDayLong(day) : "Planificación del día"}
            {assignments.length > 0 && <span> · {assignments.length} grupo{assignments.length !== 1 ? "s" : ""} · {doneTasks}/{totalTasks} tareas</span>}
          </span>
        }
        icon={<CalendarCheck size={22} />}
        actions={
          <>
            <DateSelector value={day} onChange={setDay} label="Día del planificador" />
            <IconButton label="Refrescar planificador" onClick={() => void fetchPlanner()} disabled={loading}>
              <ArrowsClockwise size={18} className={loading ? "animate-spin" : ""} />
            </IconButton>
            <Button icon={<PlusCircle size={16} />} onClick={openCreator}>
              Nueva asignación
            </Button>
          </>
        }
      >
        <OperationalSyncBar syncMode={realtime.syncMode} lastUpdate={realtime.lastUpdate} updating={realtime.updating || loading} />
      </PageHeader>

      {error && <ErrorState message={error} onRetry={() => void fetchPlanner()} />}

      <PlannerCreator key={creatorKey} open={showCreator} onCreated={handleCreated} onCancel={() => setShowCreator(false)} />

      {loading && assignments.length === 0 && !error && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
          <BlockSkeleton className="h-64" label="Cargando planificador" />
          <BlockSkeleton className="h-64" label="Cargando planificador" />
        </div>
      )}

      {!loading && !error && assignments.length === 0 && (
        <EmptyState
          icon={<AirplaneTakeoff size={28} />}
          title={isToday ? "Sin asignaciones hoy" : "Sin asignaciones ese día"}
          description={isToday ? "No hay grupos de trabajo programados para hoy." : "Cambia de día o crea una asignación (se registra en el día de hoy)."}
          action={
            <Button icon={<PlusCircle size={18} />} onClick={openCreator}>
              Crear asignación
            </Button>
          }
        />
      )}

      {assignments.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {assignments.map((group) => (
            <WorkGroupCard key={group.id || group.matricula} group={group} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
