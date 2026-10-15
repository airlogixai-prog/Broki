"use client";

import { EquipmentListPage } from "@/components/equipment/EquipmentListPage";
import { useApp } from "@/context/AppContext";
import { Van } from "@phosphor-icons/react";

export default function FurgonetasPage() {
  const { furgonetas, loading } = useApp();
  return (
    <EquipmentListPage
      title="Furgonetas"
      icon={<Van size={28} />}
      items={furgonetas}
      loading={loading}
    />
  );
}
