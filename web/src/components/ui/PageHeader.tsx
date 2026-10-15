import type { ReactNode } from "react";

interface Props {
  title: string;
  /** Short operational context (date, count, scope). */
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Primary and secondary actions, right-aligned; wrap on small screens. */
  actions?: ReactNode;
  /** Optional row rendered under the title (filters, tabs). */
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, icon, actions, children }: Props) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"
              aria-hidden
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold leading-tight text-fg sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
