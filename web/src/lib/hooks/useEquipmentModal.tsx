"use client";

import dynamic from "next/dynamic";
import { BlockSkeleton } from "@/components/ui/BlockSkeleton";
import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import type { Equipment } from "@/lib/types/equipment";

const EquipmentDetailModal = dynamic(
  () =>
    import("@/components/modals/EquipmentDetailModal").then((m) => m.EquipmentDetailModal),
  {
    ssr: false,
    loading: () => <BlockSkeleton className="fixed inset-0 z-[100] m-auto h-64 w-full max-w-md" label="Cargando equipo" />,
  },
);

let openEquipmentByIdBridge: ((id: string) => void) | null = null;
let openEquipmentBridge: ((item: Equipment) => void) | null = null;

export function openEquipmentById(id: string) {
  openEquipmentByIdBridge?.(id);
}

export function openEquipment(item: Equipment) {
  openEquipmentBridge?.(item);
}

export function EquipmentModalHost() {
  const { furgonetas, gse } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const all = useMemo(() => [...furgonetas, ...gse], [furgonetas, gse]);
  const paramId = searchParams.get("equipo");
  const selected =
    paramId ? all.find((i) => i.id === paramId) ?? null : null;

  const closeEquipment = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("equipo");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openEquipment = useCallback(
    (item: Equipment) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("equipo", item.id);
      router.push(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    openEquipmentBridge = openEquipment;
    openEquipmentByIdBridge = (id: string) => {
      const item = all.find((i) => i.id === id);
      if (item) {
        openEquipment(item);
        return;
      }
      const p = new URLSearchParams(searchParams.toString());
      p.set("equipo", id);
      router.push(`${pathname}?${p.toString()}`, { scroll: false });
    };
    return () => {
      openEquipmentBridge = null;
      openEquipmentByIdBridge = null;
    };
  }, [all, openEquipment, pathname, router, searchParams]);

  return <EquipmentDetailModal item={selected} onClose={closeEquipment} />;
}
