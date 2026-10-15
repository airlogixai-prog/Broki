import type { Equipment, IncidentState } from "../types/equipment.ts";
import { getFamily, getStatusCategory } from "../mappers/equipment.ts";

/** Searchable text for an equipment row (legacy broki.html parity). */
export function equipmentSearchText(item: Equipment): string {
  return [
    item.id,
    item.model,
    item.plate,
    item.location,
    item.usualLocation,
    item.parking,
    item.plane,
    item.worker,
    item.notes,
    item.family,
    item.status,
    item.seats != null ? String(item.seats) : "",
    item.fuel != null ? String(item.fuel) : "",
    item.adblue != null ? String(item.adblue) : "",
    ...(item.pressures ?? []).map(String),
  ]
    .join(" ")
    .toLowerCase();
}

export function filterEquipment(
  items: Equipment[],
  opts: {
    filter: string;
    statusFilter: string;
    avionFilter: string;
    familyFilter: string;
    /** When given, "issues" also matches equipment with an open incident (same rule as the KPI). */
    incidents?: Record<string, IncidentState>;
  },
): Equipment[] {
  const q = opts.filter.trim().toLowerCase();
  return items.filter((item) => {
    const matchSearch = !q || equipmentSearchText(item).includes(q);
    const matchAvion = opts.avionFilter === "all" || item.plane === opts.avionFilter;
    const matchFamily =
      opts.familyFilter === "all" || getFamily(item) === opts.familyFilter;

    let matchStatus = true;
    const cat = getStatusCategory(item.status);
    if (opts.statusFilter === "available") matchStatus = cat === "available";
    else if (opts.statusFilter === "occupied") matchStatus = cat === "occupied";
    else if (opts.statusFilter === "active")
      matchStatus = cat === "available" || cat === "occupied";
    else if (opts.statusFilter === "issues")
      matchStatus = cat === "inoperative" || !!opts.incidents?.[item.id]?.current;

    return matchSearch && matchAvion && matchFamily && matchStatus;
  });
}
