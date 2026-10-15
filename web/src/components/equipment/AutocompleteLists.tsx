"use client";

import { useApp } from "@/context/AppContext";

/**
 * Shared <datalist>s referenced by `list="broki-aircraft-regs"` and
 * `list="broki-personnel-names"` across the dashboard (equipment modal,
 * incidents, relays). Mounted once in the dashboard layout.
 */
export function AutocompleteLists() {
  const { aircraft, personal } = useApp();
  return (
    <>
      <datalist id="broki-aircraft-regs">
        {aircraft.map((a) => (
          <option key={a.reg} value={a.reg}>
            {a.airline}
          </option>
        ))}
      </datalist>
      <datalist id="broki-personnel-names">
        {personal.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
    </>
  );
}
