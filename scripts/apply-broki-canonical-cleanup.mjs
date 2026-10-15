#!/usr/bin/env node
/**
 * Fase 11 — apply broki_canonical_cleanup via PostgREST RPC.
 *   node scripts/apply-broki-canonical-cleanup.mjs --dry-run
 *   node scripts/apply-broki-canonical-cleanup.mjs --apply
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/broki/data-audit");
const MID =
  process.argv.find((a) => a.startsWith("--migration-id="))?.split("=")[1] ||
  "fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c";
const APPLY = process.argv.includes("--apply");
const DRY = process.argv.includes("--dry-run") || !APPLY;

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i);
    const v = t.slice(i + 1).replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv(join(ROOT, "web/.env.local"));

const BASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
if (!BASE || !KEY) {
  console.error("missing URL/KEY");
  process.exit(2);
}

async function rpc(fn, body) {
  const res = await fetch(`${BASE}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${fn} ${res.status}: ${String(text).slice(0, 500)}`);
  return data;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const before = await rpc("broki_verify_canonical_cleanup", { p_migration_id: MID });
  const result = await rpc("broki_canonical_cleanup", {
    p_migration_id: MID,
    p_dry_run: DRY,
  });
  const after = await rpc("broki_verify_canonical_cleanup", { p_migration_id: MID });
  const out = {
    migration_id: MID,
    dry_run: DRY,
    at: new Date().toISOString(),
    before,
    result,
    after,
  };
  const name = DRY ? "15-canonical-cleanup-dry-run.json" : "15-canonical-cleanup-apply.json";
  writeFileSync(join(OUT, name), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (!DRY && after && after.ok !== true) process.exit(3);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
