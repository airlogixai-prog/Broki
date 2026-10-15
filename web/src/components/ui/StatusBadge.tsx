import type { ReactNode } from "react";
import {
  CheckCircle,
  Clock,
  Prohibit,
  Question,
  Wrench,
  WarningOctagon,
} from "@phosphor-icons/react";
import { getStatusCategory } from "@/lib/mappers/equipment";
import type { StatusCategory } from "@/lib/types/equipment";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE: Record<Tone, string> = {
  success: "bg-success-muted text-success-strong border-success/30",
  warning: "bg-warning-muted text-warning-strong border-warning/30",
  danger: "bg-danger-muted text-danger-strong border-danger/30",
  info: "bg-info-muted text-info-strong border-info/30",
  neutral: "bg-neutral-muted text-fg-muted border-border",
};

interface BadgeProps {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
}

/** Generic pill. Never relies on colour alone: pass an icon or explicit text. */
export function Badge({ tone = "neutral", icon, children, className = "", size = "md" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-semibold uppercase tracking-wide ${
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"
      } ${TONE[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<StatusCategory, Tone> = {
  available: "success",
  occupied: "warning",
  inoperative: "danger",
  unknown: "neutral",
};

function statusIcon(cat: StatusCategory, raw: string) {
  const s = raw.toUpperCase();
  if (cat === "available") return <CheckCircle size={12} weight="bold" aria-hidden />;
  if (cat === "occupied") return <Clock size={12} weight="bold" aria-hidden />;
  if (cat === "inoperative")
    return s.includes("MANTEN") ? <Wrench size={12} weight="bold" aria-hidden /> : <Prohibit size={12} weight="bold" aria-hidden />;
  return <Question size={12} weight="bold" aria-hidden />;
}

/** Equipment status pill: category colour + icon + raw status text. */
export function StatusBadge({ status, size = "md", className = "", block = false }: { status: string; size?: "sm" | "md"; className?: string; block?: boolean }) {
  const cat = getStatusCategory(status);
  const label = status?.trim() || "Sin estado";
  return (
    <Badge tone={STATUS_TONE[cat]} size={size} icon={statusIcon(cat, label)} className={`${block ? "w-full justify-center" : ""} ${className}`}>
      {label}
    </Badge>
  );
}

export function IncidentBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <Badge tone="danger" size={size} icon={<WarningOctagon size={12} weight="bold" aria-hidden />}>
      Incidencia
    </Badge>
  );
}
