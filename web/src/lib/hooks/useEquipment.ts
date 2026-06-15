"use client";

import { useEffect, useRef, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { brokiApi } from "@/lib/api/broki";
import { splitInventory } from "@/lib/mappers/equipment";
import { normalizePersonnel, normalizeAircraft } from "@/lib/mappers/equipment";
import type { IncidentState } from "@/lib/types/equipment";

const REFRESH_MS = 30_000;

export function useEquipment() {
  const { setInventory, setIncidentsMemory, setLoading, refreshRef } = useApp();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(
    async (manual = false) => {
      if (manual) setLoading(true);
      try {
        const [resInv, resP, resIncidents, resAircraft] = await Promise.all([
          brokiApi.fetchInventory().catch(() => []),
          brokiApi.fetchPersonnel().catch(() => []),
          brokiApi.fetchIncidents().catch(() => []),
          brokiApi.fetchAircraft().catch(() => []),
        ]);

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

        // Process incidents
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
          }
        );
        setIncidentsMemory(incidentsMemory);
      } catch (err) {
        console.error("[useEquipment] fetch error", err);
      } finally {
        if (manual) setLoading(false);
      }
    },
    [setInventory, setIncidentsMemory, setLoading]
  );

  // Expose manual refresh via context ref
  useEffect(() => {
    refreshRef.current = () => fetchAll(true);
  }, [fetchAll, refreshRef]);

  // Initial load + auto-refresh
  useEffect(() => {
    fetchAll(true);
    timerRef.current = setInterval(() => fetchAll(), REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchAll]);
}
