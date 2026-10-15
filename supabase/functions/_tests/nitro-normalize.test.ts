/**
 * Nitro stock normalization selection rules (offline).
 * Mirrors supabase/migrations/20260804215000_fix_broki_nitro_stock_normalization.sql
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  nitroRowEventAt,
  nitroUbicacionDisplay,
  nitroUbicacionKey,
  selectNitroCanonical,
  shouldUpdateCanonical,
  type NitroRawRow,
} from "../_shared/nitro-normalize.ts";

Deno.test("1-2: dos filas misma ubicacion → gana la más reciente", () => {
  const rows: NitroRawRow[] = [
    {
      external_id: "a",
      row_data: {
        ubicacion: "Hangar",
        updatedAt: "2021-01-01T00:00:00Z",
        botellas_llenas: 1,
      },
    },
    {
      external_id: "b",
      row_data: {
        ubicacion: "Hangar",
        updatedAt: "2023-05-01T00:00:00Z",
        botellas_llenas: 5,
      },
    },
  ];
  const selected = selectNitroCanonical(rows);
  assertEquals(selected.length, 1);
  assertEquals(selected[0].external_id, "b");
  assertEquals(selected[0].botellas_llenas, 5);
});

Deno.test("3-4: t4S y T4S consolidan en una canonical", () => {
  const rows: NitroRawRow[] = [
    {
      external_id: "1",
      row_data: { ubicacion: "t4S", updatedAt: "2022-01-01T00:00:00Z" },
    },
    {
      external_id: "2",
      row_data: { ubicacion: "T4S", updatedAt: "2024-01-01T00:00:00Z" },
    },
  ];
  assertEquals(nitroUbicacionKey(rows[0].row_data, "1"), "t4s");
  assertEquals(nitroUbicacionKey(rows[1].row_data, "2"), "t4s");
  const selected = selectNitroCanonical(rows);
  assertEquals(selected.length, 1);
  assertEquals(selected[0].external_id, "2");
  assertEquals(selected[0].ubicacion, "T4S");
});

Deno.test("5: raw_payload es exactamente la fila seleccionada", () => {
  const newer = {
    ubicacion: "X",
    updatedAt: "2025-01-01T00:00:00Z",
    botellas_llenas: 3,
  };
  const rows: NitroRawRow[] = [
    {
      external_id: "old",
      row_data: { ubicacion: "X", updatedAt: "2020-01-01T00:00:00Z" },
    },
    { external_id: "new", row_data: newer },
  ];
  const selected = selectNitroCanonical(rows);
  assertEquals(selected[0].raw_payload, newer);
  assert(selected[0].raw_payload !== rows[0].row_data);
});

Deno.test("6: las dos filas RAW siguen en la entrada (no se borran)", () => {
  const rows: NitroRawRow[] = [
    { external_id: "1", row_data: { ubicacion: "A", updatedAt: "2020-01-01T00:00:00Z" } },
    { external_id: "2", row_data: { ubicacion: "A", updatedAt: "2021-01-01T00:00:00Z" } },
  ];
  selectNitroCanonical(rows);
  assertEquals(rows.length, 2);
});

Deno.test("7: reejecutar selección es idempotente", () => {
  const rows: NitroRawRow[] = [
    { external_id: "1", row_data: { ubicacion: "Z", updatedAt: "2022-01-01T00:00:00Z" } },
    { external_id: "2", row_data: { ubicacion: "Z", updatedAt: "2023-01-01T00:00:00Z" } },
  ];
  const a = selectNitroCanonical(rows);
  const b = selectNitroCanonical(rows);
  assertEquals(a, b);
});

Deno.test("8: fila antigua no pisa canonical más reciente", () => {
  const existing = Date.parse("2024-06-01T00:00:00Z");
  const older = Date.parse("2020-01-01T00:00:00Z");
  assertEquals(shouldUpdateCanonical(existing, older), false);
  assertEquals(shouldUpdateCanonical(older, existing), true);
});

Deno.test("9: ubicacion vacía usa fallback external_id", () => {
  assertEquals(nitroUbicacionDisplay({ ubicacion: "  " }, "row-9"), "row-9");
  assertEquals(nitroUbicacionDisplay({}, "row-9"), "row-9");
});

Deno.test("10: fechas inválidas no rompen; usa siguiente criterio", () => {
  const t = nitroRowEventAt({
    external_id: "e",
    row_data: {
      updatedAt: "@@@",
      createdAt: "2021-02-03T00:00:00Z",
    },
  });
  assertEquals(t, Date.parse("2021-02-03T00:00:00Z"));
});

Deno.test("11: muchas ubicaciones → una canonical por key (sin colisión lógica)", () => {
  const rows: NitroRawRow[] = [];
  for (let i = 0; i < 20; i++) {
    rows.push({
      external_id: `dup-${i}`,
      row_data: {
        ubicacion: i % 2 === 0 ? "T4S" : " t4s ",
        updatedAt: `2020-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`,
        botellas_llenas: i,
      },
    });
  }
  rows.push({
    external_id: "other",
    row_data: { ubicacion: "T1", updatedAt: "2020-01-01T00:00:00Z" },
  });
  const selected = selectNitroCanonical(rows);
  assertEquals(selected.length, 2);
  const t4 = selected.find((s) => nitroUbicacionKey({ ubicacion: s.ubicacion }, s.external_id) === "t4s");
  assert(t4);
  // newest among T4S variants: day 20 for i=19 → 2020-01-20, but i=19 is odd → " t4s "; i=18 → day 19
  // max day among 1..20 for even/odd both map to t4s: i=19 → day 20
  assertEquals(t4!.botellas_llenas, 19);
});
