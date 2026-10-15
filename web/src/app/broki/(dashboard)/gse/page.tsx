"use client";

import { EquipmentListPage } from "@/components/equipment/EquipmentListPage";
import { useApp } from "@/context/AppContext";
import { Wrench } from "@phosphor-icons/react";

export default function GsePage() {
  const { gse, loading } = useApp();
  return (
    <EquipmentListPage
      title="Equipos GSE"
      icon={<Wrench size={28} />}
      items={gse}
      loading={loading}
    />
  );
}
