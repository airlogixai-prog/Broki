"use client";

import { useCallback, useRef, useState } from "react";
import { FilePdf } from "@phosphor-icons/react";

const MAX_BYTES = 15 * 1024 * 1024;

interface Props {
  file: File | null;
  onFile: (file: File | null) => void;
  label?: string;
  disabled?: boolean;
}

function validatePdf(file: File): string | null {
  if (file.type && file.type !== "application/pdf") {
    return "Solo se admiten archivos PDF.";
  }
  if (file.size > MAX_BYTES) {
    return `El archivo supera el límite de ${MAX_BYTES / (1024 * 1024)} MB.`;
  }
  if (file.size === 0) {
    return "El archivo está vacío.";
  }
  return null;
}

export function PdfDropZone({
  file,
  onFile,
  label = "Arrastra un PDF o haz clic para seleccionar",
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(
    (next: File | null) => {
      if (!next) {
        setError(null);
        onFile(null);
        return;
      }
      const msg = validatePdf(next);
      if (msg) {
        setError(msg);
        return;
      }
      setError(null);
      onFile(next);
    },
    [onFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) accept(dropped);
    },
    [accept, disabled],
  );

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        disabled={disabled}
        onChange={(e) => accept(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`w-full border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver
            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
            : "border-border-strong hover:border-brand-400"
        } disabled:opacity-50`}
      >
        <FilePdf size={32} className="mx-auto mb-2 text-fg-subtle" aria-hidden />
        <p className="text-xs font-medium text-fg-muted">
          {file ? file.name : label}
        </p>
        <span className="text-[11px] text-fg-subtle">PDF · máx. 15 MB</span>
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger-strong">
          {error}
        </p>
      )}
    </div>
  );
}
