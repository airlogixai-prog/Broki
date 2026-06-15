const DEFAULT_ORIGINS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "https://broki-iota.vercel.app",
];

function getAllowedOrigins(): Set<string> {
  const fromEnv =
    Deno.env.get("ALLOWED_ORIGINS")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  return new Set([...DEFAULT_ORIGINS, ...fromEnv]);
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (getAllowedOrigins().has(origin)) return true;

  // Vercel preview deployments for this project (broki-*.vercel.app)
  if (/^https:\/\/broki[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;

  return false;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = isAllowedOrigin(origin) ? origin : DEFAULT_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  return null;
}
