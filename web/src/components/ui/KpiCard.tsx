import type { ReactNode } from "react";
import type { Tone } from "./StatusBadge";

const TONE: Record<Tone | "brand", string> = {
  success: "bg-success-muted text-success-strong",
  warning: "bg-warning-muted text-warning-strong",
  danger: "bg-danger-muted text-danger-strong",
  info: "bg-info-muted text-info-strong",
  neutral: "bg-neutral-muted text-fg-muted",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
};

interface Props {
  label: string;
  value: ReactNode;
  /** Secondary figure: percentage, delta, unit. */
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone | "brand";
  /** Make the whole tile a navigation/filter action. */
  onClick?: () => void;
  href?: string;
  emphasis?: boolean;
}

export function KpiCard({ label, value, sub, icon, tone = "neutral", onClick, href, emphasis = false }: Props) {
  const inner = (
    <>
      {icon && (
        <span className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg @[11rem]:flex ${TONE[tone]}`} aria-hidden>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="line-clamp-2 text-[11px] font-semibold uppercase leading-tight tracking-wide text-fg-muted">{label}</p>
        <p className={`tabular text-xl font-bold leading-tight ${emphasis ? TONE[tone].split(" ")[1] : "text-fg"}`}>
          {value}
          {sub && <span className="ml-1.5 text-xs font-medium text-fg-subtle">{sub}</span>}
        </p>
      </div>
    </>
  );
  // @container: the icon disappears on narrow tiles so the label never gets clipped.
  const cls =
    "@container flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm text-left w-full";
  if (href) {
    return (
      <a href={href} className={`${cls} hover:border-brand-300`}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} hover:border-brand-300`}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}
