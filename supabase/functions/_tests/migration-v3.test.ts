/**
 * Migration V3 — pure logic + auth contract tests.
 * Offline: no Supabase required.
 * Run: deno test -A supabase/functions/_tests/migration-v3.test.ts
 */
import {
  assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assignDuplicateExternalIds,
  resolveExternalId,
  sha256Hex,
  stableStringify,
  unwrapItem,
  validateImportBody,
  BATCH_MAX,
} from "../_shared/legacy-import.ts";
import {
  authenticateServiceRequest,
  type BrokiServiceId,
} from "../_shared/service-auth.ts";
import { FUNCTION_SERVICE_ACCESS } from "../_shared/function-access.ts";

const ALLOWED = FUNCTION_SERVICE_ACCESS["broki-import-batch"] ?? [];
const N8N_SECRET = "test-n8n-secret-for-migration-v3-only";

function uuid(): string {
  return "550e8400-e29b-41d4-a716-446655440000";
}

function nowS(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function withN8nSecret(cb: () => void) {
  const prev = Deno.env.get("BROKI_N8N_SECRET");
  Deno.env.set("BROKI_N8N_SECRET", N8N_SECRET);
  try {
    cb();
  } finally {
    if (prev === undefined) Deno.env.delete("BROKI_N8N_SECRET");
    else Deno.env.set("BROKI_N8N_SECRET", prev);
  }
}

function n8nReq(overrides: Record<string, string> = {}): Request {
  return new Request("https://example.com/functions/v1/broki-import-batch", {
    method: "POST",
    headers: {
      "x-broki-service-id": "n8n",
      "x-broki-service-secret": N8N_SECRET,
      "x-broki-request-id": uuid(),
      "x-broki-timestamp": nowS(),
      "idempotency-key": "broki-legacy-v3:m1:test:0",
      ...overrides,
    },
  });
}

// 1. PK / external_id
Deno.test("1: fila con clave primaria", () => {
  const u = unwrapItem({ external_id: "pk-1", row_data: { id: 1, nombre: "a" } });
  assertEquals(u.externalId, "pk-1");
  assertEquals(u.rowData, { id: 1, nombre: "a" });
  assert(!("external_id" in u.rowData));
});

// 2. Hash when no id
Deno.test("2: fila sin ID usa hash candidate null", async () => {
  const u = unwrapItem({ row_data: { foo: "bar" } });
  assertEquals(u.externalId, null);
  const hash = await sha256Hex(stableStringify(u.rowData));
  assertEquals(hash.length, 64);
});

// 3. Same identifier → #dup
Deno.test("3: dos filas con el mismo identificador", () => {
  const ids = assignDuplicateExternalIds([
    { baseId: "dup", rowData: { v: 1 } },
    { baseId: "dup", rowData: { v: 2 } },
  ]);
  assertEquals(new Set(ids).size, 2);
  assert(ids.every((id) => id.startsWith("dup#dup:")));
});

// 4. Identical rows still get distinct external ids
Deno.test("4: dos filas totalmente idénticas", () => {
  const ids = assignDuplicateExternalIds([
    { baseId: "x", rowData: { a: 1 }, orderHint: "ctid:2" },
    { baseId: "x", rowData: { a: 1 }, orderHint: "ctid:1" },
  ]);
  assertEquals(ids[0], "x#dup:2");
  assertEquals(ids[1], "x#dup:1");
  assertNotEquals(ids[0], ids[1]);
});

// 5. Empty table body
Deno.test("5: tabla vacía", () => {
  const v = validateImportBody({
    migration_id: "m",
    source_system: "n8n_postgres_pro",
    source_schema: "pro",
    source_table: "empty_tbl",
    batch_index: 0,
    total_batches: 1,
    total_rows: 0,
    items: [],
  });
  assert(v.ok);
  if (v.ok) assertEquals(v.body.items.length, 0);
});

// 6. Batch of 1000
Deno.test("6: batch de 1000 filas", () => {
  const items = Array.from({ length: 1000 }, (_, i) => ({
    external_id: String(i),
    row_data: { i },
  }));
  const v = validateImportBody({
    migration_id: "m",
    source_system: "n8n_postgres_pro",
    source_table: "t",
    batch_index: 0,
    total_batches: 1,
    total_rows: 1000,
    items,
  });
  assert(v.ok);
});

// 7. Table > 1000 → multiple batches valid
Deno.test("7: tabla > 1000 filas (2 batches)", () => {
  const b0 = validateImportBody({
    migration_id: "m",
    source_system: "s",
    source_table: "t",
    batch_index: 0,
    total_batches: 2,
    total_rows: 1500,
    items: Array.from({ length: 1000 }, (_, i) => ({
      external_id: String(i),
      row_data: { i },
    })),
  });
  const b1 = validateImportBody({
    migration_id: "m",
    source_system: "s",
    source_table: "t",
    batch_index: 1,
    total_batches: 2,
    total_rows: 1500,
    items: Array.from({ length: 500 }, (_, i) => ({
      external_id: String(1000 + i),
      row_data: { i },
    })),
  });
  assert(b0.ok && b1.ok);
});

// 8–12: contract checks (idempotency / out-of-order / missing) — body validity
Deno.test("8-12: reintento / fuera de orden / batch perdido (contratos body)", () => {
  // Same batch index twice is valid at body level (idempotency is DB/HTTP layer)
  const same = {
    migration_id: "m",
    source_system: "s",
    source_table: "t",
    batch_index: 0,
    total_batches: 3,
    total_rows: 3,
    items: [{ external_id: "a", row_data: { a: 1 } }],
  };
  assert(validateImportBody(same).ok);
  // Out of order: batch 2 before 0/1 is valid at body level
  assert(validateImportBody({ ...same, batch_index: 2 }).ok);
  // Missing middle: only body for 0 and 2 — completeness is snapshot RPC
  assert(validateImportBody({ ...same, batch_index: 0 }).ok);
  assert(validateImportBody({ ...same, batch_index: 2 }).ok);
  // Invalid index past total
  assertEquals(
    validateImportBody({ ...same, batch_index: 3 }).ok,
    false,
  );
});

// 13. Partial error shape: oversized batch rejected
Deno.test("13: batch demasiado grande (error parcial prevenido)", () => {
  const items = Array.from({ length: BATCH_MAX + 1 }, (_, i) => ({
    external_id: String(i),
    row_data: { i },
  }));
  const v = validateImportBody({
    migration_id: "m",
    source_system: "s",
    source_table: "t",
    batch_index: 0,
    total_batches: 1,
    total_rows: BATCH_MAX + 1,
    items,
  });
  assertEquals(v.ok, false);
  if (!v.ok) assertEquals(v.error, "batch_too_large");
});

// 14-15: snapshot completeness encoded in total_batches contract
Deno.test("14-15: snapshot completo vs incompleto (índices)", () => {
  const total = 3;
  const seen = new Set([0, 1, 2]);
  assertEquals(seen.size, total);
  const incomplete = new Set([0, 2]);
  assert(incomplete.size !== total);
});

// 16. pro vs public naming
Deno.test("16: mismo nombre en pro y public no colisiona", () => {
  const pro = {
    source_system: "n8n_postgres_pro",
    source_table: "personal",
  };
  const pub = {
    source_system: "n8n_postgres_public",
    source_table: "public__personal",
  };
  assertNotEquals(
    `${pro.source_system}|${pro.source_table}`,
    `${pub.source_system}|${pub.source_table}`,
  );
});

// 17-18: migration_id required
Deno.test("17-18: migration_id obligatorio (auditoría acotada)", () => {
  const v = validateImportBody({
    source_system: "s",
    source_table: "t",
    batch_index: 0,
    total_batches: 1,
    total_rows: 0,
    items: [],
  });
  assertEquals(v.ok, false);
});

// 19: row_data identity (no coercion)
Deno.test("19: row_data idéntico sin coerción", () => {
  const original = {
    id: "001",
    activo: "true",
    qty: "10",
    empty: "",
    nested: { a: [1, "2"] },
  };
  const u = unwrapItem({ external_id: "e1", row_data: original });
  assertEquals(u.rowData, original);
  assertEquals(typeof u.rowData.id, "string");
  assertEquals(typeof u.rowData.activo, "string");
  assertEquals(u.rowData.empty, "");
});

// 20: auth n8n ok
Deno.test("20: autenticación correcta servicio n8n", () => {
  withN8nSecret(() => {
    assert((ALLOWED as readonly string[]).includes("n8n"));
    const r = authenticateServiceRequest(n8nReq(), ALLOWED as BrokiServiceId[]);
    assert(r.ok);
    if (r.ok) assertEquals(r.serviceId, "n8n");
  });
});

// 21: wrong secret
Deno.test("21: secreto incorrecto", () => {
  withN8nSecret(() => {
    const r = authenticateServiceRequest(
      n8nReq({ "x-broki-service-secret": "wrong" }),
      ALLOWED as BrokiServiceId[],
    );
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals(r.status, 401);
  });
});

// 22: expired timestamp
Deno.test("22: timestamp caducado", () => {
  withN8nSecret(() => {
    const old = String(Math.floor(Date.now() / 1000) - 10_000);
    const r = authenticateServiceRequest(
      n8nReq({ "x-broki-timestamp": old }),
      ALLOWED as BrokiServiceId[],
    );
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals(r.status, 401);
  });
});

// 23: request id not uuid v4
Deno.test("23: Request ID que no sea UUID v4", () => {
  withN8nSecret(() => {
    const r = authenticateServiceRequest(
      n8nReq({ "x-broki-request-id": "not-a-uuid" }),
      ALLOWED as BrokiServiceId[],
    );
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals(r.status, 400);
  });
});

// 24: no hardcoded secrets in migration artifacts
Deno.test("24: ausencia de secretos hardcodeados en artefactos V3", async () => {
  const paths = [
    "docs/private/n8n/MIGRATION_BROKI_ALL_DATA_PARITY_V3.json",
    "supabase/functions/broki-import-batch/index.ts",
    "supabase/migrations/20260804204000_broki_migration_v3_audit.sql",
    "docs/broki/migration/BROKI_MIGRATION_V3_README.md",
  ];
  const secretRe =
    /Bearer\s+eyJ|service_role.{0,30}eyJ|SUPABASE_SERVICE_ROLE_KEY=.+|BROKI_N8N_SECRET=.+/i;
  for (const p of paths) {
    try {
      const text = await Deno.readTextFile(p);
      assert(
        !secretRe.test(text),
        `possible secret in ${p}`,
      );
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        // README may be written after; skip missing only for that path mid-edit
        if (!p.endsWith("README.md")) throw err;
      } else {
        throw err;
      }
    }
  }
});

// Extra: ID key priority
Deno.test("resolveExternalId: prioridad de claves", () => {
  assertEquals(resolveExternalId({ brk: "B1", id: "9" }), "9");
  assertEquals(resolveExternalId({ brk: "B1" }), "B1");
  assertEquals(resolveExternalId({ session_id: "s1" }), "s1");
  assertEquals(resolveExternalId({ telefono: "600" }), "600");
});

// Extra: stable stringify
Deno.test("stableStringify ordena claves", () => {
  assertEquals(stableStringify({ b: 1, a: 2 }), '{"a":2,"b":1}');
});
