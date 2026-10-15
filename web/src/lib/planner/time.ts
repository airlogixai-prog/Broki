/** Arrival markers the legacy board used instead of a time. */
export const ARRIVAL_MARKERS = ["BASE", "PRE"] as const;
export type ArrivalMarker = (typeof ARRIVAL_MARKERS)[number];

export function isArrivalMarker(v: string): v is ArrivalMarker {
  return (ARRIVAL_MARKERS as readonly string[]).includes(v.toUpperCase());
}

/**
 * "HH:MM" typed in the creator + the board day (YYYY-MM-DD, local) → ISO
 * timestamp. broki_planner_groups.hora_salida/hora_llegada are timestamptz,
 * so a bare "10:00" is rejected by Postgres.
 */
export function combineDayAndTime(day: string, time: string): string | null {
  const t = time.trim();
  if (!/^\d{1,2}:\d{2}$/.test(t)) return null;
  const d = new Date(`${day}T${t.padStart(5, "0")}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** What to send for arrival: a timestamp, or a destino marker with null time. */
export function arrivalPayload(day: string, llegada: string): { hora_llegada: string | null; destino: string | null } {
  const v = llegada.trim().toUpperCase();
  if (!v) return { hora_llegada: null, destino: null };
  if (isArrivalMarker(v)) return { hora_llegada: null, destino: v };
  return { hora_llegada: combineDayAndTime(day, v), destino: null };
}
