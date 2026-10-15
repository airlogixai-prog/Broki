import { useId, type ReactNode } from "react";

/** Surface container. With a title it is a labelled region (`aria-labelledby`). `padded` false for lists/tables that manage their own padding. */
export function Card({ children, className = "", padded = true, title, actions }: { children: ReactNode; className?: string; padded?: boolean; title?: ReactNode; actions?: ReactNode }) {
  const titleId = useId();
  return (
    <section className={`rounded-xl border border-border bg-surface shadow-sm ${className}`} aria-labelledby={title ? titleId : undefined}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
          {title && <h3 id={titleId} className="text-sm font-bold uppercase tracking-wide text-fg">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}
