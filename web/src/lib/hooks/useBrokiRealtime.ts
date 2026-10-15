"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { realtimeChannelKey } from "@/lib/realtime/channelKey";

export type OperationalSyncMode = "connecting" | "realtime" | "polling" | "error";

export interface BrokiRealtimeOptions {
  debounceMs?: number;
  /** ponytail: polling fallback when realtime fails; 0 disables */
  pollMs?: number;
  enabled?: boolean;
}

export interface BrokiRealtimeState {
  syncMode: OperationalSyncMode;
  lastUpdate: Date | null;
  updating: boolean;
}

const DEFAULT_POLL_MS = 30_000;

/**
 * Debounced postgres_changes per domain (one channel per table-set).
 * Unsubscribes on unmount; stable channel key avoids re-subscribe on inline arrays.
 */
export function useBrokiRealtime(
  tables: readonly string[],
  onChange: () => void | Promise<void>,
  options: BrokiRealtimeOptions = {},
): BrokiRealtimeState {
  const { debounceMs = 600, pollMs = DEFAULT_POLL_MS, enabled = true } = options;
  const tablesKey = realtimeChannelKey(tables);

  const onChangeRef = useRef(onChange);
  const [syncMode, setSyncMode] = useState<OperationalSyncMode>("connecting");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;

    const runChange = async () => {
      if (inFlight) return;
      inFlight = true;
      setUpdating(true);
      try {
        await onChangeRef.current();
        setLastUpdate(new Date());
      } finally {
        inFlight = false;
        setUpdating(false);
      }
    };

    const bump = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void runChange(), debounceMs);
    };

    let subscribed = false;
    const startPolling = () => {
      if (pollMs <= 0 || pollTimer || subscribed) return;
      setSyncMode("polling");
      pollTimer = setInterval(() => void runChange(), pollMs);
    };

    const channel = supabase.channel(`broki-rt-${tablesKey}`);
    for (const table of tablesKey.split("|")) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        bump,
      );
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        subscribed = true;
        setSyncMode("realtime");
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        subscribed = false;
        setSyncMode("error");
        startPolling();
      }
    });

    // If realtime never connects, poll instead (no-op once SUBSCRIBED).
    const connectFallback = setTimeout(() => startPolling(), 5_000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (pollTimer) clearInterval(pollTimer);
      clearTimeout(connectFallback);
      void supabase.removeChannel(channel);
    };
  }, [tablesKey, debounceMs, pollMs, enabled]);

  return { syncMode, lastUpdate, updating };
}
