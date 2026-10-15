#!/usr/bin/env node
/**
 * Audit data parity: pro.* / nitro_stock → broki_legacy_rows.row_data → broki_*.
 * Read-only. Requires SUPABASE_SERVICE_ROLE_KEY.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/audit-broki-data-parity.mjs
 *   node scripts/audit-broki-data-parity.mjs --json --fix-hint
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAP_PATH = join(ROOT, "config/broki/legacy-field-map.json");
const JSON_OUT = process.argv.includes("--json");
const FIX_HINT = process.argv.includes("--fix-hint");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq);
    const val = t.slice(eq + 1).replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(join(ROOT, "web/.env.local"));
loadEnvFile(join(ROOT, ".secrets/broki-service-secrets.env"));

const BASE =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!BASE || !KEY) {
  console.error(
    "FAIL: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read-only audit)",
  );
  process.exit(1);
}

const fieldMap = JSON.parse(readFileSync(MAP_PATH, "utf8"));

function resolveFields(entity) {
  if (entity.fields) return entity.fields;
  if (entity.fields_ref === "shared_groups.asset_fields") {
    return fieldMap.shared_groups.asset_fields;
  }
  return [];
}

function allJsonKeys(entity) {
  const keys = new Set(entity.postgres_columns ?? []);
  for (const f of resolveFields(entity)) {
    for (const k of f.json_keys ?? []) keys.add(k);
  }
  for (const c of entity.raw_only_columns ?? []) keys.add(c);
  if (entity.child_tables) {
    for (const ch of entity.child_tables) {
      for (const n of ch.positions ?? []) {
        keys.add(ch.json_key_pattern.replace("{n}", String(n)));
      }
    }
  }
  return keys;
}

const report = { ok: true, workflow: fieldMap.workflow.name, checks: [], summary: { pass: 0, fail: 0, warn: 0 } };

function record(name, status, detail = {}) {
  report.checks.push({ name, status, ...detail });
  report.summary[status === "pass" ? "pass" : status === "warn" ? "warn" : "fail"]++;
  if (status === "fail") report.ok = false;
}

async function rest(path, opts = {}) {
  const url = `${BASE.replace(/\/$/, "")}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${path}: ${typeof body === "object" ? body.message ?? JSON.stringify(body) : body}`);
  }
  return { res, body };
}

async function rpc(fn, args = {}) {
  const { body } = await rest(`rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
  return body;
}

async function countEq(table, filter) {
  const params = new URLSearchParams({ select: "id", ...filter });
  const { res } = await rest(`${table}?${params}`, {
    headers: { Prefer: "count=exact" },
  });
  const range = res.headers.get("content-range") ?? "";
  const m = range.match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

async function sampleKeys(sourceTable, limit = 500) {
  const params = new URLSearchParams({
    select: "row_data",
    source_table: `eq.${sourceTable}`,
    limit: String(limit),
  });
  const { body } = await rest(`broki_legacy_rows?${params}`);
  const observed = new Map();
  for (const row of body ?? []) {
    for (const k of Object.keys(row.row_data ?? {})) {
      observed.set(k, (observed.get(k) ?? 0) + 1);
    }
  }
  return { observed, sampled: (body ?? []).length };
}

async function main() {
  const { body: snapshots } = await rest(
    "broki_legacy_table_snapshots?select=source_table,status,imported_rows,failed_rows,started_at&order=started_at.desc&limit=20",
  ).catch((e) => ({ body: null, err: e }));

  if (!snapshots?.length) {
    record("import_snapshots", "warn", { message: "no snapshots or table missing" });
  } else {
    record("import_snapshots", "pass", { count: snapshots.length, latest: snapshots[0] });
  }

  try {
    const counts = await rpc("broki_audit_entity_counts");
    for (const row of counts ?? []) {
      record(`count:${row.entity}`, row.status === "OK" || row.status === "EMPTY" ? "pass" : "fail", row);
    }
  } catch (e) {
    record("entity_counts", "warn", {
      message: "apply migration 20260802180000 for broki_audit_entity_counts",
      error: String(e),
    });
    for (const entity of fieldMap.entities) {
      const st = entity.import.source_table;
      const raw = await countEq("broki_legacy_rows", { source_table: `eq.${st}` });
      record(`count_raw:${st}`, raw > 0 ? "pass" : "warn", { raw_count: raw });
    }
  }

  try {
    const drift = await rpc("broki_audit_raw_payload_parity");
    record("raw_payload_parity", drift?.length ? "fail" : "pass", {
      drifts: drift?.length ?? 0,
      sample: (drift ?? []).slice(0, 5),
    });
  } catch (e) {
    record("raw_payload_parity", "warn", { error: String(e) });
  }

  for (const entity of fieldMap.entities) {
    const st = entity.import.source_table;
    const expected = allJsonKeys(entity);
    const { observed, sampled } = await sampleKeys(st);
    if (sampled === 0) {
      record(`keys:${st}`, "warn", { message: "no raw rows" });
      continue;
    }
    const observedKeys = new Set(observed.keys());
    const missing = [...expected].filter(
      (k) => !observedKeys.has(k) && !observedKeys.has(k.toUpperCase()),
    );
    const extra = [...observedKeys].filter((k) => {
      const lower = k.toLowerCase();
      return ![...expected].some((e) => e.toLowerCase() === lower);
    });
    record(`keys:${st}`, missing.length ? "warn" : "pass", {
      sampled,
      missing_in_sample: missing.slice(0, 15),
      extra_keys: extra.slice(0, 15),
    });
  }

  const errCount = await countEq("broki_legacy_import_errors", {});
  record("import_errors", errCount === 0 ? "pass" : "fail", { count: errCount });

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\nBROKI data parity — ${report.ok ? "PASS" : "FAIL"}`);
    console.log(`Workflow: ${fieldMap.workflow.name}\n`);
    for (const c of report.checks) {
      const tag = c.status === "pass" ? "ok " : c.status === "warn" ? "!!" : "FAIL";
      console.log(`  [${tag}] ${c.name}`, c.message ?? "", c.delta != null ? `Δ=${c.delta}` : "");
      if (c.missing_in_sample?.length) console.log(`       missing: ${c.missing_in_sample.join(", ")}`);
      if (c.extra_keys?.length) console.log(`       extra: ${c.extra_keys.join(", ")}`);
    }
    console.log(`\n${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail`);
    if (FIX_HINT) console.log("\nRe-normalize: select * from broki_normalize_legacy_all();");
  }

  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error("audit crashed:", e.message ?? e);
  process.exit(2);
});
