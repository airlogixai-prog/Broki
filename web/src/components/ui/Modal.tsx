"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

/** Open modals, innermost last: only the topmost reacts to Escape. */
const stack: symbol[] = [];

type Size = "sm" | "md" | "lg" | "xl";
const SIZE: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  size?: Size;
  children: ReactNode;
  footer?: ReactNode;
  /** Block closing via backdrop/Escape while a write is in flight. */
  busy?: boolean;
}

/**
 * Accessible dialog: focus trap, Escape, focus restore, scroll lock, portal.
 * Fits the viewport on 360px (header/footer fixed, body scrolls).
 */
export function Modal({ open, onClose, title, description, icon, size = "md", children, footer, busy = false }: Props) {
  const ref = useFocusTrap(open);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const token = Symbol("modal");
    stack.push(token);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && stack[stack.length - 1] === token) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      stack.splice(stack.indexOf(token), 1);
      if (stack.length === 0) document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose, busy]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"
        onClick={() => !busy && onClose()}
        aria-label="Cerrar"
        tabIndex={-1}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={`relative flex max-h-[100dvh] w-full flex-col rounded-t-2xl border border-border bg-surface text-fg shadow-2xl sm:max-h-[90vh] sm:rounded-2xl ${SIZE[size]}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300" aria-hidden>
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-base font-bold leading-tight sm:text-lg">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-0.5 text-xs text-fg-muted">
                  {description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg disabled:opacity-50"
            aria-label="Cerrar diálogo"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle bg-muted px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
