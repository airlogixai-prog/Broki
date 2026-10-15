"use client";

import { useCallback, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { brokiApi } from "@/lib/api/broki";
import { splitInventory } from "@/lib/mappers/equipment";
import { normalizePersonnel, normalizeAircraft } from "@/lib/mappers/equipment";
import { createClient } from "@/lib/supabase/client";
import type { IncidentState } from "@/lib/types/equipment";

const REFRESH_MS = 30_000;
const REALTIME_DEBOUNCE_MS = 600;

const REALTIME_TABLES = [
  "broki_assets",
  "broki_incidents",
  "broki_incident_messages",
] as const;

function errMsg(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return String(reason);
}

export function useEquipment() {
  const {
    setInventory,
    setIncidentsMemory,
    setLoading,
    setFetchError,
    setSyncMode,
    refreshRef,
    autoRefresh,
  } = useApp();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);

  const fetchAll = useCallback(
    async (manual = false) => {
      if (manual || initialLoadRef.current) {
        setLoading(true);
        setSyncMode("loading");
      }
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
          setSyncMode("error");
        } else {
          setFetchError(null);
        }

        // A failed source keeps what is on screen (the banner says data may be stale)
        // instead of blanking the dashboard with empty lists.
        if (invR.status === "fulfilled" || persR.status === "fulfilled" || acR.status === "fulfilled") {
          const resInv = invR.status === "fulfilled" ? invR.value : null;
          const rows = resInv == null
            ? null
            : Array.isArray(resInv)
              ? resInv
              : // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (resInv as any)?.data ?? (resInv as any)?.rows ?? [];
          const split = rows ? splitInventory(rows) : null;
          const personal = persR.status === "fulfilled" ? (Array.isArray(persR.value) ? persR.value : []).map(normalizePersonnel) : null;
          const aircraft = acR.status === "fulfilled"
            ? (Array.isArray(acR.value) ? acR.value : []).map(normalizeAircraft).filter((a) => a.reg)
            : null;
          setInventory({
            ...(split ? { furgonetas: split.furgonetas, gse: split.gse } : {}),
            ...(personal ? { personal } : {}),
            ...(aircraft ? { aircraft } : {}),
          });
        }
        if (incR.status !== "fulfilled") return;
        const resIncidents = incR.value;

        const incidentsMemory: Record<string, IncidentState> = {};
        (Array.isArray(resIncidents) ? resIncidents : []).forEach(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (inc: any) => {
            const itemId = inc.id_objeto || inc.item_id;
            if (!itemId) return;
            if (!incidentsMemory[itemId])
              incidentsMemory[itemId] = { current: null, history: [] };

            const payload = inc.raw_payload ?? {};
            const tableMsgs = inc.messages ?? inc.broki_incident_messages;
            const messages = Array.isArray(tableMsgs) && tableMsgs.length > 0
              ? tableMsgs.map((m: { user?: string; author_text?: string; text?: string; message_text?: string; time?: string; created_at?: string }) => ({
                  user: m.user ?? m.author_text ?? inc.trabajador_text ?? "Operario",
                  text: m.text ?? m.message_text ?? inc.descripcion ?? "Incidencia",
                  time: m.time ?? m.created_at ?? inc.fecha_apertura ?? inc.created_at ?? new Date().toISOString(),
                }))
              : Array.isArray(payload.messages)
              ? payload.messages
              : [
                  {
                    user: inc.trabajador_text || inc.worker || "Reporte",
                    text: inc.descripcion || inc.defect || "Incidencia",
                    time: inc.fecha_apertura || inc.created_at || new Date().toISOString(),
                  },
                ];
            const obj = {
              id: inc.incident_code || inc.external_id || inc.incident_id || inc.id,
              openedAt: inc.fecha_apertura || inc.created_at || new Date().toISOString(),
              closedAt: inc.fecha_cierre || inc.closed_at,
              messages,
            };

            const estado = Number(inc.estado ?? NaN);
            const statusText = String(inc.status_text ?? inc.status ?? "").toLowerCase();
            const isOpen =
              estado === 1 ||
              statusText.includes("abierta") ||
              statusText === "open" ||
              statusText === "1";
            if (isOpen) incidentsMemory[itemId].current = obj;
            else incidentsMemory[itemId].history.push(obj);
          },
        );
        setIncidentsMemory(incidentsMemory);
      } catch (err) {
        console.error("[useEquipment] fetch error", err);
        setFetchError(errMsg(err));
        setSyncMode("error");
      } finally {
        if (manual || initialLoadRef.current) {
          setLoading(false);
          initialLoadRef.current = false;
        }
      }
    },
    [setInventory, setIncidentsMemory, setLoading, setFetchError, setSyncMode],
  );

  useEffect(() => {
    refreshRef.current = () => fetchAll(true);
  }, [fetchAll, refreshRef]);

  useEffect(() => {
    fetchAll(true);
  }, [fetchAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    // Background refresh; the sync label stays "realtime" while the channel is subscribed.
    timerRef.current = setInterval(() => {
      setSyncMode((m) => (m === "realtime" ? m : "polling"));
      fetchAll();
    }, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchAll, autoRefresh, setSyncMode]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("broki-realtime-refresh");

    const scheduleRefresh = () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      realtimeTimerRef.current = setTimeout(() => fetchAll(), REALTIME_DEBOUNCE_MS);
    };

    for (const table of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") setSyncMode("realtime");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setSyncMode(autoRefresh ? "polling" : "error");
      }
    });

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchAll, autoRefresh, setSyncMode]);
}
