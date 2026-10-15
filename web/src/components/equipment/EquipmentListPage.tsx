"use client";

import { FilterBar } from "@/components/equipment/FilterBar";
import { EquipmentGrid } from "@/components/equipment/EquipmentGrid";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { openEquipment } from "@/lib/hooks/useEquipmentModal";
import { useApp } from "@/context/AppContext";
import type { Equipment } from "@/lib/types/equipment";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  icon: ReactNode;
  items: Equipment[];
  loading?: boolean;
};

export function EquipmentListPage({ title, subtitle, icon, items, loading }: Props) {
  const { fetchError, refreshRef } = useApp();
  return (
    <div className="space-y-4 pb-10">
      <PageHeader title={title} subtitle={subtitle ?? `${items.length} equipos`} icon={icon}>
        <FilterBar />
      </PageHeader>
      {fetchError && <ErrorState message={fetchError} onRetry={() => refreshRef.current?.()} />}
      <EquipmentGrid items={items} onSelect={openEquipment} loading={loading} />
    </div>
  );
}
