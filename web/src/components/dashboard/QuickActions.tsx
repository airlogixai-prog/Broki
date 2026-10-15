"use client";

import Link from "next/link";
import { WarningOctagon, ArrowsClockwise, MapTrifold, ChartPieSlice } from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/Button";

const linkCls =
  "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-fg hover:bg-subtle";

/** Page-header actions: refresh plus direct access to incidents, map and analytics. */
export function QuickActions() {
  const { refreshRef, loading } = useApp();
  return (
    <>
      <Link href="/broki/incidencias" className={linkCls}>
        <WarningOctagon size={16} aria-hidden /> Incidencias
      </Link>
      <Link href="/broki/mapa" className={linkCls}>
        <MapTrifold size={16} aria-hidden /> Mapa
      </Link>
      <Link href="/broki/analytics" className={linkCls}>
        <ChartPieSlice size={16} aria-hidden /> Analítica
      </Link>
      <Button variant="secondary" size="sm" icon={<ArrowsClockwise size={16} />} loading={loading} onClick={() => refreshRef.current?.()}>
        Actualizar
      </Button>
    </>
  );
}
