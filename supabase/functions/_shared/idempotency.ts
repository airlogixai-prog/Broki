/**
 * idempotency.ts
 * HTTP-level idempotency for service-to-service mutations.
 * Only applies when caller is a service (kind === "service") and sends Idempotency-Key.
 *
 * Same key + same request hash → replay stored response.
 * Same key + different hash    → 409 Conflict.
 * No key or user caller        → skip (no-op).
 */
import type { ServiceContext } from "./request-auth.ts";
import { createServiceClient } from "./supabase-admin.ts";
import { jsonResponse } from "./response.ts";

const MAX_BODY_BYTES = 4096;

function truncateBody(body: unknown): unknown {
  if (body === null || body === undefined) return null;
  const s = JSON.stringify(body);
  if (s.length <= MAX_BODY_BYTES) return body;
  return { _truncated: true, preview: s.slice(0, MAX_BODY_BYTES) };
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function checkIdempotency(
  req: Request,
  auth: ServiceContext,
  requestPath: string,
  requestBodyText: string,
): Promise<
  | { hit: true; response: Response }
  | { hit: false }
> {
  const key = auth.idempotencyKey;
  if (!key) return { hit: false };

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    return { hit: false };
  }
  const hash = await sha256Hex(requestBodyText);

  const { data: existing } = await supabase
    .from("broki_idempotency_keys")
    .select("request_hash, response_status, response_body")
    .eq("service_id", auth.serviceId)
    .eq("idempotency_key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existing) {
    if (existing.request_hash !== hash) {
      // Same key, different payload → conflict
      return {
        hit: true,
        response: jsonResponse(req, { error: "idempotency_key_payload_mismatch" }, 409),
      };
    }
    // Replay stored response
    return {
      hit: true,
      response: jsonResponse(req, existing.response_body, existing.response_status),
    };
  }

  return { hit: false };
}

export async function storeIdempotency(
  auth: ServiceContext,
  requestPath: string,
  requestBodyText: string,
  responseStatus: number,
  responseBody: unknown,
): Promise<void> {
  const key = auth.idempotencyKey;
  if (!key) return;

  try {
    const supabase = createServiceClient();
    const hash = await sha256Hex(requestBodyText);
    await supabase.from("broki_idempotency_keys").upsert({
      service_id: auth.serviceId,
      idempotency_key: key,
      request_path: requestPath,
      request_hash: hash,
      response_status: responseStatus,
      response_body: truncateBody(responseBody),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    }, { onConflict: "service_id,idempotency_key" });
  } catch (err) {
    // ponytail: idempotency store failure must not break the main operation
    console.error("[idempotency] store failed", err);
  }
}

// ponytail: pure helpers only; DB path needs integration smoke
if (import.meta.main) {
  const big = { data: "x".repeat(5000) };
  const t = truncateBody(big) as { _truncated?: boolean };
  console.assert(t._truncated === true, "truncate large body");
  console.assert(truncateBody({ ok: 1 }) !== null);
  console.log("idempotency self-check OK");
}
