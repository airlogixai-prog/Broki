/**
 * Server-only Edge Function client (Route Handlers / Server Actions).
 * Uses BROKI_NEXT_SERVER_SECRET — never import from client components.
 */

function requireNextServerSecret(): string {
  const secret = process.env.BROKI_NEXT_SERVER_SECRET;
  if (!secret) throw new Error("BROKI_NEXT_SERVER_SECRET is not configured");
  return secret;
}

export function brokiServerAuthHeaders(opts: {
  requestId?: string;
  idempotencyKey?: string;
} = {}): Record<string, string> {
  return {
    "X-Broki-Service-Id": "next-server",
    "X-Broki-Service-Secret": requireNextServerSecret(),
    "X-Broki-Request-Id": opts.requestId ?? crypto.randomUUID(),
    "X-Broki-Timestamp": Math.floor(Date.now() / 1000).toString(),
    ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
  };
}

export async function invokeBrokiFunction(
  functionName: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");

  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(brokiServerAuthHeaders())) {
    headers.set(key, value);
  }

  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (anon) {
    headers.set("Authorization", `Bearer ${anon}`);
    headers.set("apikey", anon);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${base}/functions/v1/${functionName}`, { ...init, headers });
}
