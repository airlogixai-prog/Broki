"use client";

import { useEffect, useRef, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { brokiApi } from "@/lib/api/broki";
import { splitInventory } from "@/lib/mappers/equipment";
import { normalizePersonnel, normalizeAircraft } from "@/lib/mappers/equipment";
import { createClient } from "@/lib/supabase/client";
import type { IncidentState } from "@/lib/types/equipment";

const REFRESH_MS = 30_000;
// Tables that trigger a full refresh when they change via Realtime.
const REALTIME_TABLES = ["broki_assets", "broki_incidents", "broki_nitro_stock", "broki_tooling_movements"] as const;

function errMsg(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return String(reason);
}

export function useEquipment() {
  const { setInventory, setIncidentsMemory, setLoading, setFetchError, refreshRef } =
    useApp();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(
    async (manual = false) => {
      if (manual) setLoading(true);
      try {
        const [invR, persR, incR, acR] = await Promise.allSettled([
          brokiApi.fetchInventory(),
          brokiApi.fetchPersonnel(),
          brokiApi.fetchIncidents(),
          brokiApi.fetchAircraft(),
        ]);

        const failures = [invR, persR, incR, acR].filter(
          (r): r is PromiseRejectedResult => r.status === "rejected",
        );
        if (failures.length > 0) {
          setFetchError(
            failures.map((r) => errMsg(r.reason)).join(" · ") ||
              "Error al cargar datos",
          );
        } else {
          setFetchError(null);
        }

        const resInv = invR.status === "fulfilled" ? invR.value : [];
        const resP = persR.status === "fulfilled" ? persR.value : [];
        const resIncidents = incR.status === "fulfilled" ? incR.value : [];
        const resAircraft = acR.status === "fulfilled" ? acR.value : [];

        const rows = Array.isArray(resInv)
          ? resInv
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (resInv as any)?.data ?? (resInv as any)?.rows ?? [];
        const { furgonetas, gse } = splitInventory(rows);

        const personal = (Array.isArray(resP) ? resP : []).map(normalizePersonnel);
        const aircraft = (Array.isArray(resAircraft) ? resAircraft : [])
          .map(normalizeAircraft)
          .filter((a) => a.reg);

        setInventory({ furgonetas, gse, personal, aircraft });

        const incidentsMemory: Record<string, IncidentState> = {};
        (Array.isArray(resIncidents) ? resIncidents : []).forEach(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (inc: any) => {
            const itemId = inc.item_id || inc.id_objeto;
            if (!itemId) return;
            if (!incidentsMemory[itemId])
              incidentsMemory[itemId] = { current: null, history: [] };

            const obj = {
              id: inc.incident_id || inc.id,
              openedAt: inc.created_at || new Date().toISOString(),
              closedAt: inc.closed_at,
              messages: Array.isArray(inc.messages)
                ? inc.messages
                : [
                    {
                      user: inc.worker || "Reporte",
                      text: inc.defect || inc.descripcion || "Incidencia",
                      time: inc.created_at || new Date().toISOString(),
                    },
                  ],
            };

            const status = String(inc.status ?? "").toLowerCase();
            const isOpen =
              status === "1" ||
              status.includes("abierta") ||
              status === "open";
            if (isOpen) incidentsMemory[itemId].current = obj;
            else incidentsMemory[itemId].history.push(obj);
          },
        );
        setIncidentsMemory(incidentsMemory);
      } catch (err) {
        console.error("[useEquipment] fetch error", err);
        setFetchError(errMsg(err));
      } finally {
        if (manual) setLoading(false);
      }
    },
    [setInventory, setIncidentsMemory, setLoading, setFetchError],
  );

  useEffect(() => {
    refreshRef.current = () => fetchAll(true);
  }, [fetchAll, refreshRef]);

  useEffect(() => {
    fetchAll(true);
    timerRef.current = setInterval(() => fetchAll(), REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchAll]);

  // Realtime: refresh on any change to operational tables.
  // ponytail: v1 — full refresh on change; v2 upgrade = patch local state per event
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("broki-realtime-refresh")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: REALTIME_TABLES[0] },
        () => fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: REALTIME_TABLES[1] },
        () => fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: REALTIME_TABLES[2] },
        () => fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: REALTIME_TABLES[3] },
        () => fetchAll(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);
}
