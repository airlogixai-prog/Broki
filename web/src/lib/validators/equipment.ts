export interface EquipmentFormValues {
  parking: string;
  usualLocation: string;
  plane: string;
  worker: string;
  fuel: string;
  adblue: string;
  status: string;
  notes: string;
  botella_1: string;
  botella_2: string;
  botella_3: string;
  botella_4: string;
}

/** Canonical operational states (legacy free text normalised; getStatusCategory understands all). */
export const EQUIPMENT_STATUSES = ["Disponible", "En Uso", "Reservado", "Mantenimiento", "Inoperativo"] as const;

export type FieldErrors = Partial<Record<keyof EquipmentFormValues, string>>;

/** Returns per-field messages; empty object means valid. */
export function validateEquipmentFields(
  values: EquipmentFormValues,
  opts: { isFurgo: boolean; isNitrogen: boolean },
): FieldErrors {
  const errors: FieldErrors = {};
  const pct = (raw: string, label: string) => {
    if (!raw.trim()) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) return `${label} debe estar entre 0 y 100`;
    return null;
  };
  const psi = (raw: string, label: string) => {
    if (!raw.trim()) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return `${label} debe ser un número ≥ 0`;
    if (n > 6000) return `${label} fuera de rango (máx. 6000 PSI)`;
    return null;
  };

  if (!values.status.trim()) errors.status = "Selecciona un estado";
  if (opts.isFurgo) {
    const f = pct(values.fuel, "Combustible");
    if (f) errors.fuel = f;
    const a = pct(values.adblue, "AdBlue");
    if (a) errors.adblue = a;
  }
  if (opts.isNitrogen) {
    (["botella_1", "botella_2", "botella_3", "botella_4"] as const).forEach((k, i) => {
      const e = psi(values[k], `Botella ${i + 1}`);
      if (e) errors[k] = e;
    });
  }
  if (values.notes.length > 2000) errors.notes = "Notas demasiado largas (máx. 2000)";
  if (values.plane.length > 32) errors.plane = "Matrícula demasiado larga";
  return errors;
}

/** First error message or null (kept for existing callers/tests). */
export function validateEquipmentForm(
  values: EquipmentFormValues,
  opts: { isFurgo: boolean; isNitrogen: boolean },
): string | null {
  const errors = validateEquipmentFields(values, opts);
  const first = Object.values(errors)[0];
  return first ?? null;
}
