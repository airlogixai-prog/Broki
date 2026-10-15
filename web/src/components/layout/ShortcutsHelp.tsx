"use client";

import { Keyboard } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";

export const NAV_SHORTCUTS = [
  "/broki",
  "/broki/furgonetas",
  "/broki/gse",
  "/broki/aviones",
  "/broki/incidencias",
  "/broki/planner",
  "/broki/roster",
  "/broki/fleet",
  "/broki/stock",
] as const;

const ROWS: [string, string][] = [
  ["Ctrl + K  ·  /", "Ir al buscador"],
  ["Ctrl + R  ·  ⌘ + R", "Actualizar datos"],
  ["Esc", "Cerrar diálogo o menú"],
  ["Ctrl + 1 … 9", "Dashboard, Furgonetas, GSE, Aviones, Incidencias, Planificador, Horario, Relevos, Stock"],
  ["Ctrl + ?  ·  Shift + ?", "Esta ayuda"],
];

/** Keyboard shortcut reference (legacy Ctrl+? panel). */
export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Atajos de teclado" icon={<Keyboard size={18} />} size="sm">
      <dl className="space-y-2">
        {ROWS.map(([keys, desc]) => (
          <div key={keys} className="flex items-start justify-between gap-4 text-sm">
            <dt className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-fg">{keys}</dt>
            <dd className="text-right text-fg-muted">{desc}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
