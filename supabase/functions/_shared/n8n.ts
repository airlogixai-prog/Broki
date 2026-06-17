const DEFAULT_BASE = "https://n8n.airlogixai.com/webhook";
const TIMEOUT_MS = 15_000;

export function getN8nBase(): string {
  const base = Deno.env.get("N8N_BASE_URL") ?? DEFAULT_BASE;
  return base.replace(/\/$/, "");
}

function webhookUrl(path: string, cacheBust = false): string {
  const url = new URL(`${getN8nBase()}/${path.replace(/^\//, "")}`);
  if (cacheBust) url.searchParams.set("_ts", String(Date.now()));
  return url.toString();
}

async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function n8nGet(path: string, cacheBust = false): Promise<Response> {
  return fetchWithTimeout(webhookUrl(path, cacheBust), {
    headers: { Accept: "application/json" },
  });
}

export async function n8nGetJson(
  path: string,
  cacheBust = false,
): Promise<unknown> {
  const res = await n8nGet(path, cacheBust);
  if (!res.ok) throw new Error(`n8n ${res.status}`);
  return res.json();
}

export async function n8nPost(path: string, body: unknown): Promise<Response> {
  return fetchWithTimeout(webhookUrl(path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function n8nPostJson(path: string, body: unknown): Promise<unknown> {
  const res = await n8nPost(path, body);
  if (!res.ok) throw new Error(`n8n ${res.status}`);
  return res.json().catch(() => ({}));
}

export async function n8nPostForm(path: string, formData: FormData): Promise<unknown> {
  const res = await fetchWithTimeout(webhookUrl(path), {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`n8n ${res.status}`);
  return res.json().catch(() => ({}));
}
