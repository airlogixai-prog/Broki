import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { authenticateServiceRequest } from "../_shared/service-auth.ts";
import { FUNCTION_SERVICE_ACCESS } from "../_shared/function-access.ts";
import {
  readMutationBody,
  respondMutation,
  type ServiceContext,
} from "../_shared/request-auth.ts";
import { writeAudit } from "../_shared/audit.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import {
  BATCH_MAX,
  sha256Hex,
  stableStringify,
  unwrapItem,
  validateImportBody,
  type ImportBody,
  type ImportItem,
} from "../_shared/legacy-import.ts";

type ImportError = { external_id?: string; message: string };

async function authorizeImportBatch(
  req: Request,
): Promise<
  | { ok: true; auth: ServiceContext }
  | { ok: false; response: Response }
> {
  // Exclusive service path: n8n / remote-smoke via X-Broki-Service-*.
  // Legacy JWT-payload fallback removed (BROKI_ALLOW_LEGACY_IMPORT).
  const allowed = FUNCTION_SERVICE_ACCESS["broki-import-batch"] ?? [];
  const result = authenticateServiceRequest(req, allowed);
  if (!result.ok) {
    return {
      ok: false,
      response: jsonResponse(req, { error: result.error }, result.status),
    };
  }
  return {
    ok: true,
    auth: {
      kind: "service",
      serviceId: result.serviceId,
      requestId: result.requestId,
      timestamp: result.timestamp,
      idempotencyKey: req.headers.get("idempotency-key"),
    },
  };
}

async function batchPayloadHash(body: ImportBody): Promise<string> {
  return await sha256Hex(stableStringify({
    migration_id: body.migration_id,
    source_system: body.source_system,
    source_schema: body.source_schema ?? null,
    source_table: body.source_table,
    batch_index: body.batch_index,
    total_batches: body.total_batches,
    total_rows: body.total_rows,
    items: body.items,
  }));
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  const authorized = await authorizeImportBatch(req);
  if (!authorized.ok) return authorized.response;

  const parsed = await readMutationBody(req, authorized.auth, "broki-import-batch");
  if (!parsed.ok) return parsed.response;

  const validated = validateImportBody(parsed.body);
  if (!validated.ok) {
    const status = validated.error === "batch_too_large" ? 400 : 400;
    return jsonResponse(
      req,
      validated.error === "batch_too_large"
        ? { error: "batch_too_large", max: BATCH_MAX }
        : { error: validated.error },
      status,
    );
  }
  const body = validated.body;
  const bodyText = parsed.bodyText;
  const batchHash = await batchPayloadHash(body);

  const supabase = createServiceClient();
  const received = body.items.length;
  let upserted = 0;
  const errors: ImportError[] = [];

  // Pre-check: same batch + different hash must fail before mutating rows.
  let priorQuery = supabase
    .from("broki_legacy_import_batches")
    .select("batch_hash, imported_rows, failed_rows, snapshot_id")
    .eq("migration_id", body.migration_id)
    .eq("source_system", body.source_system)
    .eq("source_table", body.source_table)
    .eq("batch_index", body.batch_index);
  priorQuery = body.source_schema
    ? priorQuery.eq("source_schema", body.source_schema)
    : priorQuery.is("source_schema", null);
  const { data: priorBatch } = await priorQuery.maybeSingle();

  if (priorBatch) {
    if (priorBatch.batch_hash !== batchHash) {
      return jsonResponse(req, { error: "batch_content_mismatch" }, 409);
    }
    // Rows already applied; re-run completion RPC for current snapshot status.
    const { data: snap, error: snapErr } = await supabase.rpc(
      "broki_complete_import_batch",
      {
        p_migration_id: body.migration_id,
        p_source_system: body.source_system,
        p_source_schema: body.source_schema ?? null,
        p_source_table: body.source_table,
        p_batch_index: body.batch_index,
        p_total_batches: body.total_batches,
        p_total_rows: body.total_rows,
        p_received_rows: received,
        p_imported_rows: priorBatch.imported_rows,
        p_failed_rows: priorBatch.failed_rows,
        p_batch_hash: batchHash,
      },
    );
    if (snapErr) {
      return jsonResponse(req, {
        error: `batch_complete_failed: ${snapErr.message}`,
      }, 500);
    }
    const payload = {
      ok: priorBatch.failed_rows === 0,
      migration_id: body.migration_id,
      source_system: body.source_system,
      source_schema: body.source_schema ?? null,
      source_table: body.source_table,
      batch_index: body.batch_index,
      total_batches: body.total_batches,
      total_rows: body.total_rows,
      received,
      upserted: priorBatch.imported_rows,
      errors: [] as ImportError[],
      snapshot_id: (snap as { snapshot_id: string }).snapshot_id,
      snapshot_status: (snap as { snapshot_status: string }).snapshot_status,
      snapshot_imported_rows:
        (snap as { snapshot_imported_rows: number }).snapshot_imported_rows,
      snapshot_failed_rows:
        (snap as { snapshot_failed_rows: number }).snapshot_failed_rows,
      replay: true,
    };
    await writeAudit(
      "legacy.import_batch",
      "broki_legacy_table_snapshots",
      payload.snapshot_id,
      {
        migration_id: body.migration_id,
        source_table: body.source_table,
        batch_index: body.batch_index,
        replay: true,
      },
      authorized.auth,
    );
    return respondMutation(
      req,
      authorized.auth,
      "broki-import-batch",
      bodyText,
      200,
      payload,
    );
  }

  for (const item of body.items as ImportItem[]) {
    const { externalId: providedExternalId, rowData } = unwrapItem(item);
    try {
      const canonical = stableStringify(rowData);
      const externalId = providedExternalId ?? await sha256Hex(canonical);
      const { error } = await supabase.from("broki_legacy_rows").upsert({
        source_system: body.source_system,
        source_schema: body.source_schema ?? null,
        source_table: body.source_table,
        external_id: externalId,
        row_hash: await sha256Hex(canonical),
        row_data: rowData,
        last_migration_id: body.migration_id,
        synced_at: new Date().toISOString(),
      }, { onConflict: "source_system,source_table,external_id" });
      if (error) throw new Error(error.message);
      upserted++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      errors.push({
        external_id: providedExternalId ?? undefined,
        message,
      });
    }
  }

  const { data: snap, error: snapErr } = await supabase.rpc(
    "broki_complete_import_batch",
    {
      p_migration_id: body.migration_id,
      p_source_system: body.source_system,
      p_source_schema: body.source_schema ?? null,
      p_source_table: body.source_table,
      p_batch_index: body.batch_index,
      p_total_batches: body.total_batches,
      p_total_rows: body.total_rows,
      p_received_rows: received,
      p_imported_rows: upserted,
      p_failed_rows: errors.length,
      p_batch_hash: batchHash,
    },
  );

  if (snapErr) {
    const status = snapErr.message.includes("batch_content_mismatch")
      ? 409
      : 500;
    return jsonResponse(req, {
      error: `batch_complete_failed: ${snapErr.message}`,
    }, status);
  }

  const snapshotId = (snap as { snapshot_id: string }).snapshot_id;

  if (errors.length > 0) {
    await supabase.from("broki_legacy_import_errors").insert(
      errors.map((e) => ({
        snapshot_id: snapshotId,
        source_system: body.source_system,
        source_table: body.source_table,
        external_id: e.external_id ?? null,
        error_message: e.message,
        row_data: null,
      })),
    );
  }

  const payload = {
    ok: errors.length === 0,
    migration_id: body.migration_id,
    source_system: body.source_system,
    source_schema: body.source_schema ?? null,
    source_table: body.source_table,
    batch_index: body.batch_index,
    total_batches: body.total_batches,
    total_rows: body.total_rows,
    received,
    upserted,
    errors,
    snapshot_id: snapshotId,
    snapshot_status: (snap as { snapshot_status: string }).snapshot_status,
    snapshot_imported_rows:
      (snap as { snapshot_imported_rows: number }).snapshot_imported_rows,
    snapshot_failed_rows:
      (snap as { snapshot_failed_rows: number }).snapshot_failed_rows,
    replay: false,
  };

  await writeAudit(
    "legacy.import_batch",
    "broki_legacy_table_snapshots",
    snapshotId,
    {
      migration_id: body.migration_id,
      source_system: body.source_system,
      source_schema: body.source_schema ?? null,
      source_table: body.source_table,
      batch_index: body.batch_index,
      total_batches: body.total_batches,
      total_rows: body.total_rows,
      received,
      upserted,
      error_count: errors.length,
    },
    authorized.auth,
  );

  return respondMutation(
    req,
    authorized.auth,
    "broki-import-batch",
    bodyText,
    errors.length ? 207 : 200,
    payload,
  );
});
