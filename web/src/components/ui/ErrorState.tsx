"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "./Button";

interface Props {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  /** Inline banner (default) or full block. */
  block?: boolean;
}

/** Visible, actionable error. Never swallow a failed write or load. */
export function ErrorState({ title = "No se pudieron cargar los datos", message, onRetry, retryLabel = "Reintentar", block = false }: Props) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border border-danger/40 bg-danger-muted px-4 py-3 ${block ? "flex-col items-center py-10 text-center" : ""}`}
    >
      <WarningCircle size={22} className="shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-danger-strong">{title}</p>
        {message && <p className="mt-0.5 break-words text-xs text-fg-muted">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

/** Small inline error under a form or inside a modal. */
export function InlineError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-danger-strong">
      <WarningCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}
