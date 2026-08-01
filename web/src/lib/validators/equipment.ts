export interface EquipmentFormValues {
  parking: string;
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

export function validateEquipmentForm(
  values: EquipmentFormValues,
  opts: { isFurgo: boolean; isNitrogen: boolean },
): string | null {
  const pct = (raw: string, label: string) => {
    if (!raw.trim()) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) return `${label} debe estar entre 0 y 100`;
    return null;
  };
  const psi = (raw: string, label: string) => {
    if (!raw.trim()) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return `${label} debe ser un numero >= 0`;
    return null;
  };

  if (opts.isFurgo) {
    const fuelErr = pct(values.fuel, "Combustible");
    if (fuelErr) return fuelErr;
    const adblueErr = pct(values.adblue, "AdBlue");
    if (adblueErr) return adblueErr;
  }

  if (opts.isNitrogen) {
    for (const [raw, label] of [
      [values.botella_1, "Botella 1"],
      [values.botella_2, "Botella 2"],
      [values.botella_3, "Botella 3"],
      [values.botella_4, "Botella 4"],
    ] as const) {
      const err = psi(raw, label);
      if (err) return err;
    }
  }

  if (values.notes.length > 2000) return "Notas demasiado largas";
  return null;
}
