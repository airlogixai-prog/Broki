/**
 * request-auth.ts
 * Dual auth dispatcher for Edge Functions.
 *
 * Decision tree:
 *  1. If X-Broki-Service-Id present → service path (service-auth + function allowlist)
 *     Partial headers (id without secret) → 401 immediately, no fallback to user.
 *  2. Otherwise → user path (user-auth via getUser())
 *
 * Returns AuthContext on success or a Response on failure.
 * Callers: `const auth = await authorizeOrRespond(req, "fn-name", opts); if (auth instanceof Response) return auth;`
 */
import { authenticateServiceRequest, type BrokiServiceId } from "./service-auth.ts";
import { authenticateBrokiUser } from "./user-auth.ts";
import { FUNCTION_SERVICE_ACCESS } from "./function-access.ts";
import { jsonResponse } from "./response.ts";

export type UserContext = {
  kind: "user";
  userId: string;
  email: string | undefined;
  permissions: string[];
};

export type ServiceContext = {
  kind: "service";
  serviceId: BrokiServiceId;
  requestId: string;
  timestamp: number;
  idempotencyKey: string | null;
};

export type AuthContext = UserContext | ServiceContext;

export async function authorizeOrRespond(
  req: Request,
  functionName: string,
  opts: { mutation?: boolean } = {},
): Promise<AuthContext | Response> {
  const serviceIdHeader = req.headers.get("x-broki-service-id");

  if (serviceIdHeader !== null) {
    // Service path — all four headers must be present
    const allowed = FUNCTION_SERVICE_ACCESS[functionName] ?? [];

    // Public functions never accept service requests
    if (allowed.length === 0) {
      return jsonResponse(req, { error: "unauthorized_service_request" }, 403);
    }

    const result = authenticateServiceRequest(req, allowed);
    if (!result.ok) {
      return jsonResponse(req, { error: result.error }, result.status);
    }

    // For writes, Idempotency-Key is expected (not hard-enforced here, enforced in idempotency.ts)
    const idempotencyKey = req.headers.get("idempotency-key");

    return {
      kind: "service",
      serviceId: result.serviceId,
      requestId: result.requestId,
      timestamp: result.timestamp,
      idempotencyKey,
    };
  }

  // User path — no service headers expected
  // If user somehow sends partial service headers alongside user JWT, reject
  if (
    req.headers.get("x-broki-service-secret") ||
    req.headers.get("x-broki-request-id") ||
    req.headers.get("x-broki-timestamp")
  ) {
    // Partial service context mixed with user request → reject
    return jsonResponse(req, { error: "ambiguous_auth_context" }, 403);
  }

  const result = await authenticateBrokiUser(req);
  if (!result.ok) {
    return jsonResponse(req, { error: result.error }, result.status);
  }

  return {
    kind: "user",
    userId: result.userId,
    email: result.email,
    permissions: result.permissions,
  };
}
