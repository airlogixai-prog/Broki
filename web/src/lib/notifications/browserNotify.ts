import type { CriticalAlert } from "../alerts/buildCriticalAlerts.ts";

/** Legacy broki.html: Notification API opt-in, 60 s throttle per type, rules: frost, fuel < 10 %, new incident. */
export const NOTIFY_THROTTLE_MS = 60_000;
export const NOTIFY_FUEL_PCT = 10;

export interface NotifyCandidate {
  key: string;
  title: string;
  body: string;
  itemId?: string;
}

function fuelPct(message: string): number | null {
  const m = message.match(/(\d+)\s*%/);
  return m ? Number(m[1]) : null;
}

/** Which bell alerts deserve a browser notification (stricter than the bell). */
export function selectNotifiable(alerts: CriticalAlert[]): NotifyCandidate[] {
  const out: NotifyCandidate[] = [];
  for (const a of alerts) {
    if (a.type === "weather") out.push({ key: a.id, title: a.title, body: a.message });
    else if (a.type === "incident") out.push({ key: a.id, title: a.title, body: a.message, itemId: a.itemId });
    else if (a.type === "fuel") {
      const pct = fuelPct(a.message);
      if (pct != null && pct < NOTIFY_FUEL_PCT) out.push({ key: a.id, title: a.title, body: a.message, itemId: a.itemId });
    }
  }
  return out;
}

/**
 * Pure throttle: returns the candidates to fire now and the updated
 * last-fired map. One notification per key every NOTIFY_THROTTLE_MS.
 */
export function throttleNotifications(
  candidates: NotifyCandidate[],
  lastFired: Record<string, number>,
  now: number,
  throttleMs = NOTIFY_THROTTLE_MS,
): { fire: NotifyCandidate[]; lastFired: Record<string, number> } {
  const next = { ...lastFired };
  const fire: NotifyCandidate[] = [];
  for (const c of candidates) {
    if (c.key in next && now - next[c.key] < throttleMs) continue;
    next[c.key] = now;
    fire.push(c);
  }
  return { fire, lastFired: next };
}
