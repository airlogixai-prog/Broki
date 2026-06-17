"use client";

import Link from "next/link";
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
  AirplaneTilt,
  Cylinder,
  Toolbox,
} from "@phosphor-icons/react";

const NAV_ITEMS = [
  { href: "/broki", label: "Dashboard", Icon: SquaresFour },
  { href: "/broki/mapa", label: "Mapa en Vivo", Icon: MapTrifold },
  { href: "/broki/furgonetas", label: "Furgonetas", Icon: Van },
  { href: "/broki/gse", label: "Equipos GSE", Icon: Wrench },
  { href: "/broki/aviones", label: "Por Avión", Icon: Airplane },
  { href: "/broki/incidencias", label: "Incidencias", Icon: WarningOctagon },
  { href: "/broki/analytics", label: "Analítica", Icon: ChartPieSlice },
  { href: "/broki/planner", label: "Planificador", Icon: ClipboardText },
  { href: "/broki/roster", label: "Horario", Icon: Calendar },
  { href: "/broki/fleet", label: "Flota / Relevos", Icon: AirplaneTilt },
  { href: "/broki/stock", label: "Stock Nitrógeno", Icon: Cylinder },
  { href: "/broki/tooling", label: "Tooling", Icon: Toolbox },
];

interface Props {
  onClose?: () => void;
}

export function Sidebar({ onClose }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
      {/* Logo */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/assets/icon.jpg"
            alt="BROKI"
            className="w-10 h-10 rounded-xl object-cover shadow-sm"
          />
          <h1 className="font-bold text-xl tracking-tight text-orange-500">BROKI</h1>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 p-1 md:hidden"
          >
            ✕
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive =
            href === "/broki"
              ? pathname === "/broki"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors w-full
                ${
                  isActive
                    ? "text-brand-600 bg-brand-50 dark:bg-slate-700 dark:text-brand-400"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                }
              `}
            >
              <Icon size={18} weight={isActive ? "fill" : "regular"} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Status footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Online</p>
        </div>
      </div>
    </div>
  );
}
