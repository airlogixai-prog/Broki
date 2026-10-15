"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  SquaresFour,
  MapTrifold,
  Van,
  Wrench,
  Airplane,
  WarningOctagon,
  ChartPieSlice,
  ClipboardText,
  Calendar,
  Notebook,
  Cylinder,
  Toolbox,
  X,
} from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { splitIssues } from "@/lib/equipment/kpis";

const NAV_GROUPS = [
  {
    label: "Operación",
    items: [
      { href: "/broki", label: "Dashboard", Icon: SquaresFour },
      { href: "/broki/mapa", label: "Mapa", Icon: MapTrifold },
      { href: "/broki/furgonetas", label: "Furgonetas", Icon: Van },
      { href: "/broki/gse", label: "Equipos GSE", Icon: Wrench },
      { href: "/broki/aviones", label: "Aviones", Icon: Airplane },
      { href: "/broki/incidencias", label: "Incidencias", Icon: WarningOctagon, badge: "issues" as const },
    ],
  },
  {
    label: "Planificación",
    items: [
      { href: "/broki/planner", label: "Planificador", Icon: ClipboardText },
      { href: "/broki/roster", label: "Horario", Icon: Calendar },
      { href: "/broki/fleet", label: "Relevos", Icon: Notebook },
    ],
  },
  {
    label: "Recursos",
    items: [
      { href: "/broki/stock", label: "Stock nitrógeno", Icon: Cylinder },
      { href: "/broki/tooling", label: "Tooling", Icon: Toolbox },
      { href: "/broki/analytics", label: "Analítica", Icon: ChartPieSlice },
    ],
  },
];

interface Props {
  onClose?: () => void;
}

export function Sidebar({ onClose }: Props) {
  const pathname = usePathname();
  const { syncMode, fetchError, furgonetas, gse, incidentsMemory } = useApp();
  const issues = splitIssues([...furgonetas, ...gse], incidentsMemory).total;

  const status = fetchError
    ? { label: "Error de conexión", cls: "text-danger", dot: "bg-danger" }
    : syncMode === "realtime"
      ? { label: "Realtime", cls: "text-success", dot: "bg-success" }
      : syncMode === "polling"
        ? { label: "Polling 30 s", cls: "text-warning", dot: "bg-warning" }
        : syncMode === "error"
          ? { label: "Sin sincronización", cls: "text-danger", dot: "bg-danger" }
          : { label: "Conectando…", cls: "text-fg-muted", dot: "bg-neutral" };

  return (
    <div className="broki-sidebar">
      <div className="broki-sidebar__header">
        <Link href="/broki" className="broki-sidebar__brand" onClick={onClose}>
          <Image src="/assets/icon.jpg" alt="" width={36} height={36} className="broki-sidebar__logo" priority />
          <span>
            <span className="broki-sidebar__title">BROKI</span>
            <span className="broki-sidebar__subtitle">Operaciones LEMD</span>
          </span>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} className="broki-icon-btn md:hidden" aria-label="Cerrar menú">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="broki-sidebar__nav broki-scrollbar" aria-label="Navegación principal">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="broki-nav-group">
            <p className="broki-nav-group__label">{group.label}</p>
            {group.items.map(({ href, label, Icon, badge }) => {
              const isActive = href === "/broki" ? pathname === "/broki" : pathname === href || pathname.startsWith(`${href}/`);
              const count = badge === "issues" ? issues : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={`broki-nav-link${isActive ? " broki-nav-link--active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={18} weight={isActive ? "fill" : "regular"} className="broki-nav-link__icon" aria-hidden />
                  <span className="flex-1 truncate">{label}</span>
                  {count > 0 && (
                    <span className="broki-nav-badge" aria-label={`${count} equipos con incidencia`}>
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="broki-sidebar__footer">
        <div className="broki-status-pill" role="status" aria-live="polite">
          <span className={`broki-status-pill__dot ${status.dot}`} aria-hidden />
          <p className={`broki-status-pill__label ${status.cls}`}>{status.label}</p>
        </div>
      </div>
    </div>
  );
}
