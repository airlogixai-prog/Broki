"use client";

import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { TextField } from "@/components/ui/FormField";

interface Props {
  name: string;
  full: number;
  empty: number;
  editing: boolean;
  dirty?: boolean;
  errors?: { full?: string; empty?: string };
  onFullChange: (v: string) => void;
  onEmptyChange: (v: string) => void;
  /** Raw strings while editing (so the user can clear the field). */
  draft?: { full: string; empty: string };
}

/** One stock location (terminal): full/empty bottle counts with a share gauge. */
export function NitroStockCard({ name, full, empty, editing, dirty = false, errors, onFullChange, onEmptyChange, draft }: Props) {
  const total = full + empty;
  const pct = total > 0 ? Math.round((full / total) * 100) : 0;
  const circumference = 251.2;
  const offset = circumference - (circumference * pct) / 100;
  const tone = total === 0 ? "text-neutral" : pct >= 50 ? "text-success" : pct >= 25 ? "text-warning" : "text-danger";

  return (
    <section className={`rounded-xl border bg-surface p-5 shadow-sm ${dirty ? "border-brand-400" : "border-border"}`} aria-label={`Stock ${name}`}>
      <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-fg">
        <span className="h-5 w-1 rounded-full bg-brand-500" aria-hidden />
        {name}
        {dirty && <span className="ml-auto text-[11px] font-semibold text-brand-700 dark:text-brand-300">Sin guardar</span>}
      </h3>

      <div className="flex items-center gap-6">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center" role="img" aria-label={`${pct} % de botellas llenas (${full} de ${total})`}>
          <svg className="h-full w-full -rotate-90" viewBox="0 0 96 96" aria-hidden>
            <circle cx="48" cy="48" r="40" strokeWidth="8" fill="transparent" stroke="var(--broki-bg-subtle)" />
            <circle cx="48" cy="48" r="40" strokeWidth="8" fill="transparent" stroke="currentColor" className={tone} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="tabular text-xl font-bold text-fg">{pct} %</span>
            <span className="text-[11px] font-semibold uppercase text-fg-subtle">llenas</span>
          </div>
        </div>

        <dl className="flex-1 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-muted p-3">
            <dt className="flex items-center gap-2 text-sm font-medium text-fg-muted">
              <span className="rounded-md bg-success-muted p-1.5 text-success-strong" aria-hidden>
                <CheckCircle size={16} weight="fill" />
              </span>
              Llenas
            </dt>
            <dd>
              {editing ? (
                <TextField label={`Botellas llenas ${name}`} className="w-24 [&_label]:sr-only" type="number" inputMode="numeric" min={0} step={1} value={draft?.full ?? String(full)} onChange={(e) => onFullChange(e.target.value)} error={errors?.full} />
              ) : (
                <span className="tabular text-xl font-bold text-fg">{full}</span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted p-3">
            <dt className="flex items-center gap-2 text-sm font-medium text-fg-muted">
              <span className="rounded-md bg-warning-muted p-1.5 text-warning-strong" aria-hidden>
                <WarningCircle size={16} weight="fill" />
              </span>
              Vacías
            </dt>
            <dd>
              {editing ? (
                <TextField label={`Botellas vacías ${name}`} className="w-24 [&_label]:sr-only" type="number" inputMode="numeric" min={0} step={1} value={draft?.empty ?? String(empty)} onChange={(e) => onEmptyChange(e.target.value)} error={errors?.empty} />
              ) : (
                <span className="tabular text-xl font-bold text-fg">{empty}</span>
              )}
            </dd>
          </div>
          <p className="tabular text-right text-[11px] text-fg-subtle">Total {total} botellas</p>
        </dl>
      </div>
    </section>
  );
}
