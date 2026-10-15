"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CriticalAlert } from "@/lib/alerts/buildCriticalAlerts";
import { selectNotifiable, throttleNotifications } from "@/lib/notifications/browserNotify";
import { openEquipmentById } from "@/lib/hooks/useEquipmentModal";
import { useHydrated } from "@/lib/hooks/useHydrated";

const PREF_KEY = "broki_browser_notifications";

type Permission = "unsupported" | "default" | "granted" | "denied";

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Opt-in browser notifications (legacy parity). The user enables them from the
 * bell; the permission prompt is only shown on that click. Fires for frost,
 * fuel < 10 % and open incidents, throttled per alert key.
 */
export function useBrowserNotifications(alerts: CriticalAlert[]) {
  const [enabled, setEnabled] = useState<boolean>(() => (typeof window === "undefined" ? false : readPref()));
  const [permission, setPermission] = useState<Permission>(() =>
    typeof window === "undefined" || !("Notification" in window) ? "unsupported" : (Notification.permission as Permission),
  );
  const lastFired = useRef<Record<string, number>>({});
  const hydrated = useHydrated();

  const toggle = useCallback(async () => {
    if (permission === "unsupported") return;
    if (enabled) {
      setEnabled(false);
      try {
        localStorage.setItem(PREF_KEY, "false");
      } catch {
        /* private mode */
      }
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    setPermission(perm as Permission);
    if (perm === "granted") {
      setEnabled(true);
      try {
        localStorage.setItem(PREF_KEY, "true");
      } catch {
        /* private mode */
      }
    }
  }, [enabled, permission]);

  useEffect(() => {
    if (!enabled || permission !== "granted" || typeof document === "undefined" || document.visibilityState === "visible") return;
    const { fire, lastFired: next } = throttleNotifications(selectNotifiable(alerts), lastFired.current, Date.now());
    lastFired.current = next;
    for (const c of fire) {
      try {
        const n = new Notification(`BROKI · ${c.title}`, { body: c.body, tag: c.key, icon: "/assets/icon.jpg" });
        n.onclick = () => {
          window.focus();
          if (c.itemId) openEquipmentById(c.itemId);
          n.close();
        };
      } catch {
        /* notification constructor can throw on some mobile browsers */
      }
    }
  }, [alerts, enabled, permission]);

  return { enabled: hydrated && enabled, permission: hydrated ? permission : "unsupported", toggle };
}
