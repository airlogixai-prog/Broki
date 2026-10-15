import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  plannerMatKey,
  selectPlannerTasks,
  tareaBusinessKey,
  type TareaRawRow,
} from "../_shared/planner-normalize.ts";

Deno.test("dedup: EC-NTB y ECNTB + mismo codigo/fecha → 1 fila", () => {
  const rows: TareaRawRow[] = [
    {
      source_system: "n8n_postgres_pro",
      external_id: "a",
      row_data: {
        codigo: "14212",
        matricula_avion: "EC-NTB",
        fecha: "2025-12-31T10:00:00Z",
        fecha_modificacion: "2025-01-01T00:00:00Z",
      },
    },
    {
      source_system: "n8n_postgres_pro",
      external_id: "b",
      row_data: {
        codigo: "14212",
        matricula_avion: "ECNTB",
        fecha: "2025-12-31T22:00:00Z",
        fecha_modificacion: "2025-08-01T00:00:00Z",
      },
    },
  ];
  assertEquals(plannerMatKey("EC-NTB"), "ECNTB");
  assertEquals(tareaBusinessKey(rows[0]), tareaBusinessKey(rows[1]));
  assertEquals(tareaBusinessKey(rows[0]), "ECNTB|14212|2025-12-31");
  const sel = selectPlannerTasks(rows);
  assertEquals(sel.length, 1);
  assertEquals(sel[0].external_id, "b");
  assertEquals(sel[0].row_data, rows[1].row_data);
});

Deno.test("idempotencia de selección", () => {
  const rows: TareaRawRow[] = [
    {
      source_system: "s",
      external_id: "1",
      row_data: {
        codigo: "9",
        matricula: "XY",
        fecha: "2024-06-01T00:00:00Z",
        fecha_modificacion: "2024-06-02T00:00:00Z",
      },
    },
    {
      source_system: "s",
      external_id: "2",
      row_data: {
        codigo: "9",
        matricula: "X-Y",
        fecha: "2024-06-01T12:00:00Z",
        fecha_modificacion: "2024-06-01T00:00:00Z",
      },
    },
  ];
  assertEquals(selectPlannerTasks(rows), selectPlannerTasks(rows));
});

Deno.test("sin codigo/fecha: no colapsan (clave por external_id)", () => {
  const rows: TareaRawRow[] = [
    {
      source_system: "s",
      external_id: "1",
      row_data: { descripcion: "x" },
    },
    {
      source_system: "s",
      external_id: "2",
      row_data: { descripcion: "y" },
    },
  ];
  assertEquals(selectPlannerTasks(rows).length, 2);
});

Deno.test("RAW input intacto tras selección", () => {
  const rows: TareaRawRow[] = [
    {
      source_system: "s",
      external_id: "1",
      row_data: {
        codigo: "1",
        matricula: "A",
        fecha: "2024-01-01T00:00:00Z",
        fecha_modificacion: "2024-01-01T00:00:00Z",
      },
    },
    {
      source_system: "s",
      external_id: "2",
      row_data: {
        codigo: "1",
        matricula: "A",
        fecha: "2024-01-01T00:00:00Z",
        fecha_modificacion: "2024-02-01T00:00:00Z",
      },
    },
  ];
  selectPlannerTasks(rows);
  assertEquals(rows.length, 2);
});
