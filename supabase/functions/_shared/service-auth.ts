/**
 * service-auth.ts
 * Validates server-to-server requests using X-Broki-Service-* headers.
 * Constant-time comparison, timestamp window, UUID validation.
 * Never logs or returns the received secret.
 */

export type BrokiServiceId =
  | "n8n"
  | "internal-function"
  | "next-server"
  | "remote-smoke";

export type ServiceAuthResult =
  | {
      ok: true;
      serviceId: BrokiServiceId;
      requestId: string;
      timestamp: number;
    }
  | {
      ok: false;
      status: 400 | 401 | 403;
      error: string;
    };

// Each service id maps to an env var name; optionally a *_PREVIOUS for rotation.
const SERVICE_SECRET_ENV: Record<BrokiServiceId, string> = {
  "n8n": "BROKI_N8N_SECRET",
  "internal-function": "BROKI_INTERNAL_FUNCTION_SECRET",
  "next-server": "BROKI_NEXT_SERVER_SECRET",
  "remote-smoke": "BROKI_REMOTE_TEST_SECRET",
};

const TIMESTAMP_WINDOW_S = 300;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Constant-time byte comparison. Returns true iff a === b.
// Pads shorter string with NUL bytes so length doesn't leak via timing.
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bytesA = enc.encode(a);
  const bytesB = enc.encode(b);
  const maxLen = Math.max(bytesA.length, bytesB.length);
  let diff = bytesA.length ^ bytesB.length; // non-zero if lengths differ
  for (let i = 0; i < maxLen; i++) {
    diff |= (bytesA[i] ?? 0) ^ (bytesB[i] ?? 0);
  }
  return diff === 0;
}

export function authenticateServiceRequest(
  request: Request,
  allowedServices: readonly BrokiServiceId[],
): ServiceAuthResult {
  const serviceIdRaw = request.headers.get("x-broki-service-id");
  const secretRaw = request.headers.get("x-broki-service-secret");
  const requestId = request.headers.get("x-broki-request-id");
  const timestampRaw = request.headers.get("x-broki-timestamp");

  // All four headers must be present together; partial set → 401
  if (!serviceIdRaw || !secretRaw || !requestId || !timestampRaw) {
    return { ok: false, status: 401, error: "unauthorized_service_request" };
  }

  // Validate service id
  if (!Object.prototype.hasOwnProperty.call(SERVICE_SECRET_ENV, serviceIdRaw)) {
    return { ok: false, status: 403, error: "unauthorized_service_request" };
  }
  const serviceId = serviceIdRaw as BrokiServiceId;

  // Validate that this service is allowed for this function
  if (!(allowedServices as readonly string[]).includes(serviceId)) {
    return { ok: false, status: 403, error: "unauthorized_service_request" };
  }

  // Validate UUID
  if (!UUID_RE.test(requestId)) {
    return { ok: false, status: 400, error: "unauthorized_service_request" };
  }

  // Validate timestamp
  const ts = Number(timestampRaw);
  if (!Number.isInteger(ts) || ts <= 0) {
    return { ok: false, status: 401, error: "unauthorized_service_request" };
  }
  const nowS = Math.floor(Date.now() / 1000);
  if (Math.abs(nowS - ts) > TIMESTAMP_WINDOW_S) {
    return { ok: false, status: 401, error: "unauthorized_service_request" };
  }

  // Validate secret — try current then previous (rotation support)
  const envName = SERVICE_SECRET_ENV[serviceId];
  const current = Deno.env.get(envName) ?? "";
  const previous = Deno.env.get(`${envName}_PREVIOUS`) ?? "";

  if (!current) {
    // Secret not configured — server misconfiguration, still return generic 401
    return { ok: false, status: 401, error: "unauthorized_service_request" };
  }

  const matchCurrent = constantTimeEqual(secretRaw, current);
  const matchPrevious = previous ? constantTimeEqual(secretRaw, previous) : false;

  if (!matchCurrent && !matchPrevious) {
    return { ok: false, status: 401, error: "unauthorized_service_request" };
  }

  return { ok: true, serviceId, requestId, timestamp: ts };
}

/** Build X-Broki-* headers for server callers (Next, n8n, smoke). Never log the secret. */
export function buildServiceAuthHeaders(
  serviceId: BrokiServiceId,
  secret: string,
  opts: { requestId?: string; idempotencyKey?: string } = {},
): Record<string, string> {
  return {
    "X-Broki-Service-Id": serviceId,
    "X-Broki-Service-Secret": secret,
    "X-Broki-Request-Id": opts.requestId ?? crypto.randomUUID(),
    "X-Broki-Timestamp": Math.floor(Date.now() / 1000).toString(),
    ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
  };
}

// Self-check (ponytail: fails if constant-time compare or UUID regex breaks)
if (import.meta.main) {
  const a = "abc";
  const b = "abc";
  const c = "abd";
  console.assert(constantTimeEqual(a, b) === true, "equal strings must match");
  console.assert(constantTimeEqual(a, c) === false, "different strings must not match");
  console.assert(constantTimeEqual("", "") === true, "empty equal");
  console.assert(constantTimeEqual("a", "") === false, "different lengths");
  console.assert(UUID_RE.test("550e8400-e29b-41d4-a716-446655440000"), "valid uuid");
  console.assert(!UUID_RE.test("not-a-uuid"), "invalid uuid");
  const h = buildServiceAuthHeaders("remote-smoke", "s", { idempotencyKey: "k1" });
  console.assert(h["X-Broki-Service-Id"] === "remote-smoke");
  console.assert(h["Idempotency-Key"] === "k1");
  console.log("service-auth self-check OK");
}
