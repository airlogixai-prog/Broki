#!/usr/bin/env node
/** Non-destructive data invariant check for release:verify. Exit 1 on regression. */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MID = "fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c";

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
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function count(path) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { headers: { ...h, Prefer: "count=exact" } });
  const m = (res.headers.get("content-range") || "").match(/\/(\d+)$/);
  return m ? Number(m[1]) : -1;
}
async function rpc(name, args = {}) {
  const res = await fetch(`${BASE}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(args),
  });
  return { status: res.status, body: await res.json() };
}

const raw = await count(`broki_legacy_rows?select=id&last_migration_id=eq.${MID}`);
const assets = await count("broki_assets?select=id");
const rel = await rpc("broki_verify_relation_integrity", {});
const cleanup = await rpc("broki_verify_canonical_cleanup", { p_migration_id: MID });

const report = {
  raw_v7: raw,
  assets,
  relation_ok: rel.body?.ok === true,
  cleanup: cleanup.body,
  source_parity: process.env.LEGACY_DATABASE_URL || process.env.BROKI_LEGACY_DATABASE_URL
    ? "CREDENTIAL_PRESENT_RUN_DIFF"
    : "BLOCKED_EXTERNAL",
  ok:
    raw === 9316 &&
    assets === 94 &&
    rel.body?.ok === true &&
    cleanup.body?.logical_asset_dups === 0 &&
    cleanup.body?.smoke_movements === 0,
};

// orphan_groups/tasks from app/smoke post-F11 fail full cleanup.ok — surface as fail
if (cleanup.body?.ok !== true) report.ok = false;

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
