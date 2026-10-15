"use client";

import { useState, type ReactNode } from "react";
import { WarningOctagon } from "@phosphor-icons/react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { InlineError } from "./ErrorState";

interface Props {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  /** May throw; the error is shown inline and the dialog stays open. */
  onConfirm: () => Promise<void> | void;
}

/** Replacement for window.confirm: accessible, non-blocking, shows failures. */
export function ConfirmDialog({ open, title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", danger = false, onCancel, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      busy={busy}
      icon={danger ? <WarningOctagon size={18} className="text-danger" /> : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={confirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <div className="text-sm text-fg-muted">{message}</div>}
      <div className="mt-2">
        <InlineError message={error} />
      </div>
    </Modal>
  );
}
