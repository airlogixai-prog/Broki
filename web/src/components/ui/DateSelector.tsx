"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { IconButton } from "./Button";

interface Props {
  /** YYYY-MM-DD */
  value: string;
  onChange: (next: string) => void;
  /** Days moved by the arrows (7 for week navigation). */
  step?: number;
  label?: string;
  /** Text for the "today" shortcut. */
  todayLabel?: string;
  className?: string;
}

export function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDay(d);
}

export function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDayLong(iso: string): string {
  const s = new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Previous / date input / next, with a "today" shortcut. */
export function DateSelector({ value, onChange, step = 1, label = "Fecha", todayLabel = "Hoy", className = "" }: Props) {
  const today = toIsoDay(new Date());
  return (
    <div className={`flex items-center gap-1 ${className}`} role="group" aria-label={label}>
      <IconButton size="sm" label={step === 7 ? "Semana anterior" : "Día anterior"} onClick={() => onChange(shiftDay(value, -step))}>
        <CaretLeft size={16} />
      </IconButton>
      <input
        type="date"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label={label}
        className="tabular min-h-9 rounded-lg border border-border bg-surface px-2 text-sm text-fg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
      <IconButton size="sm" label={step === 7 ? "Semana siguiente" : "Día siguiente"} onClick={() => onChange(shiftDay(value, step))}>
        <CaretRight size={16} />
      </IconButton>
      <button
        type="button"
        onClick={() => onChange(today)}
        disabled={value === today}
        className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:text-fg-subtle disabled:hover:bg-transparent dark:text-brand-300 dark:hover:bg-brand-900/30"
      >
        {todayLabel}
      </button>
    </div>
  );
}
