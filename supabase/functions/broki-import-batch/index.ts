import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";

const BATCH_MAX = 1000;
const ID_KEYS = [
  "external_id",
  "id",
  "identificador",
  "brk",
  "codigo",
  "id_incidencia",
] as const;

type ImportBody = {
  source_system: string;
  source_schema?: string;
  source_table: string;
  items: Record<string, unknown>[];
};

type ImportError = {
  external_id?: string;
  message: string;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) =>
    `${JSON.stringify(key)}:${stableStringify(obj[key])}`
  ).join(",")}}`;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function resolveExternalId(item: Record<string, unknown>): string | null {
  for (const key of ID_KEYS) {
    const value = item[key];
    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

async function getOrCreateSnapshot(
  supabase: ReturnType<typeof createClient>,
  body: ImportBody,
): Promise<string | null> {
  const { data: existing, error: findError } = await supabase
    .from("broki_legacy_table_snapshots")
    .select("id")
    .eq("source_system", body.source_system)
    .eq("source_table", body.source_table)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.error("[broki-import-batch] snapshot lookup failed", findError);
    return null;
  }
  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("broki_legacy_table_snapshots")
    .insert({
      source_system: body.source_system,
      source_schema: body.source_schema ?? null,
      source_table: body.source_table,
      status: "running",
    })
    .select("id")
    .single();

  if (createError) {
    console.error("[broki-import-batch] snapshot create failed", createError);
    return null;
  }
  return created.id;
}

async function incrementSnapshotCounts(
  supabase: ReturnType<typeof createClient>,
  snapshotId: string,
  imported: number,
  failed: number,
): Promise<void> {
  const { data: snap, error: readError } = await supabase
    .from("broki_legacy_table_snapshots")
    .select("imported_rows, failed_rows")
    .eq("id", snapshotId)
    .single();

  if (readError || !snap) {
    console.error("[broki-import-batch] snapshot read failed", readError);
    return;
  }

  const { error: updateError } = await supabase
    .from("broki_legacy_table_snapshots")
    .update({
      imported_rows: (snap.imported_rows ?? 0) + imported,
      failed_rows: (snap.failed_rows ?? 0) + failed,
    })
    .eq("id", snapshotId);

  if (updateError) {
    console.error("[broki-import-batch] snapshot update failed", updateError);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "invalid_json" }, 400);
  }

  if (
    !body?.source_system || !body?.source_table || !Array.isArray(body.items)
  ) {
    return jsonResponse(req, { error: "invalid_body" }, 400);
  }
  if (body.items.length > BATCH_MAX) {
    return jsonResponse(req, { error: "batch_too_large", max: BATCH_MAX }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, { error: "server_misconfigured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const snapshotId = await getOrCreateSnapshot(supabase, body);

  const received = body.items.length;
  let upserted = 0;
  const errors: ImportError[] = [];

  for (const item of body.items) {
    try {
      const canonical = stableStringify(item);
      let externalId = resolveExternalId(item);
      if (!externalId) externalId = await sha256Hex(canonical);

      const { error } = await supabase
        .from("broki_legacy_rows")
        .upsert(
          {
            source_system: body.source_system,
            source_schema: body.source_schema ?? null,
            source_table: body.source_table,
            external_id: externalId,
            row_hash: await sha256Hex(canonical),
            row_data: item,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "source_system,source_table,external_id" },
        );

      if (error) throw new Error(error.message);
      upserted++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      errors.push({
        external_id: resolveExternalId(item) ?? undefined,
        message,
      });

      if (snapshotId) {
        await supabase.from("broki_legacy_import_errors").insert({
          snapshot_id: snapshotId,
          source_system: body.source_system,
          source_table: body.source_table,
          external_id: resolveExternalId(item),
          error_message: message,
          row_data: item,
        });
      }
    }
  }

  if (snapshotId) {
    await incrementSnapshotCounts(supabase, snapshotId, upserted, errors.length);
  }

  return jsonResponse(req, {
    ok: true,
    source_table: body.source_table,
    received,
    upserted,
    errors,
  });
});

// ponytail: smallest runnable check for stable id resolution
if (import.meta.main) {
  const sample = { brk: " 42 ", nombre: "test" };
  console.assert(resolveExternalId(sample) === "42");
  console.assert(stableStringify({ b: 1, a: 2 }) === '{"a":2,"b":1}');
}
