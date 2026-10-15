"use client";

import { KpiWidgets } from "@/components/equipment/KpiWidgets";
import { FilterBar } from "@/components/equipment/FilterBar";
import { EquipmentGrid } from "@/components/equipment/EquipmentGrid";
import { LemdWeatherWidget } from "@/components/weather/LemdWeatherWidget";
import { SystemStatusBar } from "@/components/dashboard/SystemStatusBar";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useApp } from "@/context/AppContext";
import { openEquipment } from "@/lib/hooks/useEquipmentModal";
import { Van, Wrench, SquaresFour, Plugs } from "@phosphor-icons/react";
import { KpiSkeletonRow } from "@/components/ui/BlockSkeleton";

export default function DashboardPage() {
  const { furgonetas, gse, loading, fetchError, refreshRef } = useApp();
  const empty = furgonetas.length === 0 && gse.length === 0;

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Centro de operaciones"
        subtitle={`${furgonetas.length} furgonetas · ${gse.length} equipos GSE`}
        icon={<SquaresFour size={22} />}
        actions={<QuickActions />}
      />

      {fetchError && <ErrorState message={fetchError} onRetry={() => refreshRef.current?.()} />}

      {loading && empty ? <KpiSkeletonRow /> : <KpiWidgets />}

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <LemdWeatherWidget />
        <SystemStatusBar />
      </div>

      <FilterBar />

      <EquipmentGrid items={furgonetas} sectionTitle="Furgonetas" sectionIcon={<Van size={20} />} onSelect={openEquipment} loading={loading} />
      <EquipmentGrid items={gse} sectionTitle="Equipos GSE" sectionIcon={<Wrench size={20} />} onSelect={openEquipment} loading={loading} />

      {empty && !loading && !fetchError && (
        <EmptyState icon={<Plugs size={28} />} title="Sin datos de inventario" description="La base no ha devuelto equipos. Comprueba la conexión o la importación." />
      )}
    </div>
  );
}
