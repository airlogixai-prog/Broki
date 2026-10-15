"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";

type Kind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: Kind;
  title: string;
  message?: string;
}

interface ToastApi {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const STYLE: Record<Kind, { cls: string; Icon: typeof Info }> = {
  success: { cls: "border-success/40 bg-success-muted text-success-strong", Icon: CheckCircle },
  error: { cls: "border-danger/40 bg-danger-muted text-danger-strong", Icon: WarningCircle },
  info: { cls: "border-info/40 bg-info-muted text-info-strong", Icon: Info },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((kind: Kind, title: string, message?: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, kind, title, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 8000 : 4000);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, m) => push("success", t, m),
      error: (t, m) => push("error", t, m),
      info: (t, m) => push("info", t, m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[110] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6" aria-live="polite">
        {toasts.map((t) => {
          const { cls, Icon } = STYLE[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border bg-surface px-4 py-3 shadow-lg ${cls}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs text-fg-muted">{t.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
                className="rounded p-1 text-fg-subtle hover:text-fg"
                aria-label="Cerrar aviso"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}
