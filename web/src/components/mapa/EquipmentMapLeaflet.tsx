"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Equipment, StatusCategory } from "@/lib/types/equipment";
import { getStatusCategory } from "@/lib/mappers/equipment";

export type MapPin = { item: Equipment; pos: { x: number; y: number }; hasIncident?: boolean };

export interface MapImage {
  /** Full-size WebP for desktop. */
  src: string;
  /** Lighter variant for narrow screens. */
  srcSmall: string;
  width: number;
  height: number;
}

type Props = {
  mapName: string;
  image: MapImage;
  pins: MapPin[];
  onSelect: (item: Equipment) => void;
};

const STATUS_VAR: Record<StatusCategory, string> = {
  available: "var(--broki-success)",
  occupied: "var(--broki-warning)",
  inoperative: "var(--broki-danger)",
  unknown: "var(--broki-neutral)",
};

const VAN_PATH =
  "M248 128a8 8 0 0 0-8-8h-16l-21-40a16 16 0 0 0-14-8H56a16 16 0 0 0-16 16v88a16 16 0 0 0 16 16h9a28 28 0 0 0 54 0h18a28 28 0 0 0 54 0h41a16 16 0 0 0 16-16Z";
const WRENCH_PATH =
  "M226 96a66 66 0 0 1-83 80l-73 73a24 24 0 0 1-34-34l73-73a66 66 0 0 1 80-83l-37 37 13 34 34 13Z";

/** Tooltip/marker HTML is built from editable text (worker, parking, status): always escape. */
function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** SVG marker: shape = type (square van / round GSE), colour = status, letter = status initial. */
function pinIcon(item: Equipment, hasIncident: boolean) {
  const cat = getStatusCategory(item.status);
  const isVan = item.type === "furgo";
  const color = STATUS_VAR[cat];
  const letter = cat === "available" ? "D" : cat === "occupied" ? "U" : cat === "inoperative" ? "I" : "?";
  const html = `<div style="position:relative;width:30px;height:30px;border-radius:${isVan ? "8px" : "999px"};background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgb(0 0 0 / .35);display:flex;align-items:center;justify-content:center;color:#fff;${
    hasIncident ? "outline:3px solid var(--broki-danger);outline-offset:1px;" : ""
  }">
    <svg viewBox="0 0 256 256" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="${isVan ? VAN_PATH : WRENCH_PATH}"/></svg>
    <span style="position:absolute;right:-5px;bottom:-5px;width:14px;height:14px;border-radius:999px;background:#fff;color:${color};font:700 9px/14px system-ui;text-align:center">${letter}</span>
  </div>`;
  return L.divIcon({ html, className: "", iconSize: [30, 30], iconAnchor: [15, 15] });
}

/**
 * Terminal plan (static image, legacy `assets/maps/*_real.jpg`, converted to WebP)
 * in a Leaflet CRS.Simple canvas. Positions are operational parking zones, not
 * GPS; pins are placed from the equipment's parking/location number.
 */
export function EquipmentMapLeaflet({ mapName, image, pins, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const bounds: L.LatLngBoundsExpression = [
      [0, 0],
      [image.height, image.width],
    ];
    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -5,
      maxZoom: 2,
      zoomSnap: 0.25,
      zoomControl: true,
      attributionControl: false,
    });
    const narrow = typeof window !== "undefined" && window.innerWidth < 768;
    L.imageOverlay(narrow ? image.srcSmall : image.src, bounds, { alt: `Plano ${mapName}` }).addTo(map);
    map.fitBounds(bounds);
    map.setMinZoom(map.getBoundsZoom(bounds));
    map.setMaxBounds(bounds);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [mapName, image]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    pins.forEach(({ item, pos, hasIncident }) => {
      const lat = image.height - (pos.y / 100) * image.height;
      const lng = (pos.x / 100) * image.width;
      const marker = L.marker([lat, lng], { icon: pinIcon(item, !!hasIncident), keyboard: true, title: `${item.id} · ${item.status}` });
      const where = item.parking || item.location || "";
      marker.bindTooltip(
        `<strong>${esc(item.id)}</strong> · ${esc(item.status)}<br/>${esc(item.model)}${where ? `<br/><em>Parking ${esc(where)}</em>` : ""}${item.worker ? `<br/>${esc(item.worker)}` : ""}`,
        { direction: "top", offset: [0, -14] },
      );
      marker.on("click", () => onSelect(item));
      marker.on("keypress", (e) => {
        if ((e.originalEvent as KeyboardEvent).key === "Enter") onSelect(item);
      });
      marker.addTo(layer);
    });
  }, [pins, onSelect, image]);

  return (
    <div
      ref={containerRef}
      className="h-[60vh] min-h-[420px] w-full rounded-xl border border-border bg-subtle"
      role="application"
      aria-label={`Plano de ${mapName} con ${pins.length} equipos posicionados`}
    />
  );
}
