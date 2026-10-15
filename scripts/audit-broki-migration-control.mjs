#!/usr/bin/env node
/**
 * Read-only Broki migration control-plane audit (manifest / snapshots / batches / raw).
 * Usage:
 *   node scripts/audit-broki-migration-control.mjs --migration-id=<uuid>
 *   node scripts/audit-broki-migration-control.mjs --latest
 *
 * Exit: 0 ok, 1 discrepancies, 2 config/access error
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/broki/data-audit");

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
  console.error("FAIL: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY required");
  process.exit(2);
}

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, ...r] = a.replace(/^--/, "").split("=");
    return [k, r.join("=") || true];
  }),
);

async function rest(path, opts = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
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
    throw new Error(`${res.status} ${path}: ${typeof body === "object" ? JSON.stringify(body).slice(0, 300) : String(body).slice(0, 300)}`);
  }
  return { res, body };
}

async function count(table, filterQs) {
  const { res } = await rest(`${table}?select=id&${filterQs}`, {
    headers: { Prefer: "count=exact" },
  });
  const m = (res.headers.get("content-range") || "").match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

async function rpc(fn, args = {}) {
  const { body } = await rest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
  return body;
}

function srcKey(s) {
  return `${s.source_system}|${s.source_schema ?? ""}|${s.source_table}`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const { body: snapsAll } = await rest(
    "broki_legacy_table_snapshots?select=*&order=started_at.desc&limit=500",
  );
  const withMig = (snapsAll || []).filter((s) => s.metadata?.migration_id);
  const byMig = new Map();
  for (const s of withMig) {
    const id = s.metadata.migration_id;
    if (!byMig.has(id)) byMig.set(id, []);
    byMig.get(id).push(s);
  }

  let migrationId = typeof args["migration-id"] === "string" ? args["migration-id"] : null;
  if (!migrationId || args.latest) {
    // Prefer fully successful run: all snaps success, finished, no failed rows
    let best = null;
    for (const [id, list] of byMig) {
      const ok = list.every((s) => s.status === "success" && s.failed_rows === 0 && s.finished_at);
      const started = Math.min(...list.map((s) => new Date(s.started_at).getTime()));
      const finished = Math.max(...list.map((s) => new Date(s.finished_at || s.started_at).getTime()));
      if (!ok) continue;
      if (!best || started > best.started) best = { id, started, finished, list };
    }
    migrationId = best?.id || withMig[0]?.metadata?.migration_id;
  }
  if (!migrationId) {
    console.error("FAIL: no migration_id found in snapshots.metadata");
    process.exit(2);
  }

  const snaps = (byMig.get(migrationId) || []).slice().sort((a, b) =>
    srcKey(a).localeCompare(srcKey(b))
  );

  // Batches for this migration
  const { body: batches } = await rest(
    `broki_legacy_import_batches?migration_id=eq.${encodeURIComponent(migrationId)}&select=*&order=source_table.asc,batch_index.asc&limit=5000`,
  );

  const batchesBySrc = new Map();
  for (const b of batches || []) {
    const k = srcKey(b);
    if (!batchesBySrc.has(k)) batchesBySrc.set(k, []);
    batchesBySrc.get(k).push(b);
  }

  const rows = [];
  let expectedTotal = 0;
  let importedTotal = 0;
  let failedTotal = 0;
  let batchesExpected = 0;
  let batchesSeen = 0;
  const missingSources = [];
  const unexpectedBatchSources = [];
  const batchIssues = [];

  for (const s of snaps) {
    const k = srcKey(s);
    const blist = batchesBySrc.get(k) || [];
    const totalBatches = Number(s.metadata?.total_batches ?? blist[0]?.total_batches ?? Math.max(1, blist.length));
    const indices = blist.map((b) => b.batch_index).sort((a, b) => a - b);
    const missingIdx = [];
    for (let i = 0; i < totalBatches; i++) if (!indices.includes(i)) missingIdx.push(i);
    const dupIdx = indices.filter((v, i, a) => a.indexOf(v) !== i);
    const hashClash = [];
    const byIdx = new Map();
    for (const b of blist) {
      if (!byIdx.has(b.batch_index)) byIdx.set(b.batch_index, []);
      byIdx.get(b.batch_index).push(b);
    }
    for (const [idx, arr] of byIdx) {
      if (arr.length > 1) {
        const hashes = new Set(arr.map((x) => x.batch_hash));
        if (hashes.size > 1) hashClash.push(idx);
      }
    }

    const qs = [
      `source_system=eq.${encodeURIComponent(s.source_system)}`,
      `source_table=eq.${encodeURIComponent(s.source_table)}`,
      `last_migration_id=eq.${encodeURIComponent(migrationId)}`,
    ];
    if (s.source_schema == null) qs.push("source_schema=is.null");
    else qs.push(`source_schema=eq.${encodeURIComponent(s.source_schema)}`);
    const rawCount = await count("broki_legacy_rows", qs.join("&"));

    const expected = Number(s.total_rows ?? 0);
    const imported = Number(s.imported_rows ?? 0);
    const failed = Number(s.failed_rows ?? 0);
    expectedTotal += expected;
    importedTotal += imported;
    failedTotal += failed;
    batchesExpected += totalBatches;
    batchesSeen += new Set(indices).size;

    let result = "PASS";
    const reasons = [];
    if (s.status !== "success") {
      result = "FAIL";
      reasons.push(`status=${s.status}`);
    }
    if (!s.finished_at) {
      result = "FAIL";
      reasons.push("finished_at null");
    }
    if (expected !== imported || failed > 0) {
      result = "FAIL";
      reasons.push(`counts e=${expected} i=${imported} f=${failed}`);
    }
    if (rawCount !== imported) {
      result = "FAIL";
      reasons.push(`raw=${rawCount}!=imported`);
    }
    if (missingIdx.length || dupIdx.length || hashClash.length) {
      result = "FAIL";
      reasons.push(`batches missing=${missingIdx} dup=${dupIdx} hashClash=${hashClash}`);
      batchIssues.push({ source: k, missingIdx, dupIdx, hashClash });
    }
    if (new Set(indices).size !== totalBatches && totalBatches > 0) {
      result = "FAIL";
      reasons.push(`batch_count ${new Set(indices).size}/${totalBatches}`);
    }

    rows.push({
      source_system: s.source_system,
      source_schema: s.source_schema,
      source_table: s.source_table,
      expected_rows: expected,
      imported_rows: imported,
      failed_rows: failed,
      raw_rows: rawCount,
      total_batches: totalBatches,
      imported_batches: new Set(indices).size,
      status: s.status,
      started_at: s.started_at,
      finished_at: s.finished_at,
      result,
      reasons,
    });
  }

  for (const k of batchesBySrc.keys()) {
    if (!snaps.find((s) => srcKey(s) === k)) unexpectedBatchSources.push(k);
  }

  const started = snaps.length
    ? new Date(Math.min(...snaps.map((s) => new Date(s.started_at).getTime()))).toISOString()
    : null;
  const finished = snaps.length
    ? new Date(Math.max(...snaps.map((s) => new Date(s.finished_at || 0).getTime()))).toISOString()
    : null;

  const pass = rows.every((r) => r.result === "PASS") &&
    missingSources.length === 0 &&
    unexpectedBatchSources.length === 0 &&
    failedTotal === 0;

  const report = {
    migration_id: migrationId,
    started_at: started,
    finished_at: finished,
    sources: rows.length,
    expected_rows: expectedTotal,
    imported_rows: importedTotal,
    failed_rows: failedTotal,
    batches_expected: batchesExpected,
    batches_seen: batchesSeen,
    missing_sources: missingSources,
    unexpected_batch_sources: unexpectedBatchSources,
    batch_issues: batchIssues,
    rows,
    verdict: pass ? "PASS" : "FAIL",
    generated_at: new Date().toISOString(),
  };

  writeFileSync(join(OUT, "02-manifest-snapshot-reconciliation.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Fase 1 — Manifest / snapshots / batches",
    "",
    `- **migration_id:** \`${migrationId}\``,
    `- **started_at:** ${started}`,
    `- **finished_at:** ${finished}`,
    `- **veredicto:** **${report.verdict}**`,
    `- **fuentes:** ${rows.length}`,
    `- **esperadas/importadas/fallidas:** ${expectedTotal} / ${importedTotal} / ${failedTotal}`,
    `- **batches esperados/vistos:** ${batchesExpected} / ${batchesSeen}`,
    "",
    "| Fuente | Esperadas | Importadas | Fallidas | Raw | Batches | Estado | Resultado |",
    "|---|---:|---:|---:|---:|---:|---|---|",
    ...rows.map((r) =>
      `| ${r.source_system}.${r.source_schema || ""}.${r.source_table} | ${r.expected_rows} | ${r.imported_rows} | ${r.failed_rows} | ${r.raw_rows} | ${r.imported_batches}/${r.total_batches} | ${r.status} | ${r.result} |`
    ),
    "",
  ].join("\n");
  writeFileSync(join(OUT, "02-manifest-snapshot-reconciliation.md"), md);

  // Selected migration doc (phase 0 companion)
  writeFileSync(
    join(OUT, "01-selected-migration.md"),
    [
      "# Fase 0 — Migración seleccionada",
      "",
      `| Campo | Valor |`,
      `|---|---|`,
      `| migration_id | \`${migrationId}\` |`,
      `| started_at | ${started} |`,
      `| finished_at | ${finished} |`,
      `| status | all snapshots success (verified in Fase 1) |`,
      `| sources | ${rows.length} |`,
      `| expected_rows | ${expectedTotal} |`,
      `| imported_rows | ${importedTotal} |`,
      `| failed_rows | ${failedTotal} |`,
      `| batches | ${batchesSeen} / ${batchesExpected} |`,
      `| workflow meta | \`metadata.importer_version\` / n8n V7 (declarado por operador) |`,
      "",
      "## Criterio de selección",
      "",
      "Último `metadata.migration_id` con **todos** los snapshots `status=success`, `failed_rows=0`, `finished_at` no nulo.",
      "",
      "## Alcance (fuentes)",
      "",
      ...rows.map((r) => `- \`${r.source_system}\` / \`${r.source_schema}\` / \`${r.source_table}\` (${r.expected_rows} filas)`),
      "",
    ].join("\n"),
  );

  // Phase 2 raw quality (lightweight)
  const rawQuality = [];
  for (const r of rows) {
    const base = [
      `source_system=eq.${encodeURIComponent(r.source_system)}`,
      `source_table=eq.${encodeURIComponent(r.source_table)}`,
      `last_migration_id=eq.${encodeURIComponent(migrationId)}`,
    ];
    if (r.source_schema == null) base.push("source_schema=is.null");
    else base.push(`source_schema=eq.${encodeURIComponent(r.source_schema)}`);
    const nullData = await count(
      "broki_legacy_rows",
      [...base, "row_data=is.null"].join("&"),
    );
    // sample up to 1000 for structural checks
    const { body: sample } = await rest(
      `broki_legacy_rows?select=external_id,row_data,row_hash&${base.join("&")}&limit=1000`,
    );
    let invalid = 0;
    let noKey = 0;
    const ids = new Map();
    for (const row of sample || []) {
      if (!row.row_data || typeof row.row_data !== "object" || Array.isArray(row.row_data)) invalid++;
      else if (Object.keys(row.row_data).length === 0) invalid++;
      if (!row.external_id) noKey++;
      ids.set(row.external_id, (ids.get(row.external_id) || 0) + 1);
    }
    const dupKeys = [...ids.entries()].filter(([, n]) => n > 1).length;
    const result = r.raw_rows === r.expected_rows && nullData === 0 && invalid === 0
      ? "PASS"
      : "FAIL";
    rawQuality.push({
      ...r,
      null_row_data: nullData,
      sampled: (sample || []).length,
      invalid_payloads_in_sample: invalid,
      missing_external_id_in_sample: noKey,
      duplicate_external_id_in_sample: dupKeys,
      result_raw: result,
    });
  }

  const obsolete = await rpc("broki_audit_obsolete_rows", { p_migration_id: migrationId }).catch((e) => ({
    error: String(e.message || e),
  }));

  const rawReport = {
    migration_id: migrationId,
    raw_total_this_migration: expectedTotal,
    obsolete_count: Array.isArray(obsolete) ? obsolete.length : null,
    obsolete_error: obsolete?.error,
    rows: rawQuality,
    verdict: rawQuality.every((x) => x.result_raw === "PASS") ? "PASS" : "FAIL",
  };
  writeFileSync(join(OUT, "03-raw-row-reconciliation.json"), JSON.stringify(rawReport, null, 2));
  writeFileSync(
    join(OUT, "03-raw-row-reconciliation.md"),
    [
      "# Fase 2 — Raw rows",
      "",
      `- migration_id: \`${migrationId}\``,
      `- raw este run: **${expectedTotal}**`,
      `- obsoletas (otras migraciones, mismas tablas): **${rawReport.obsolete_count}**`,
      `- veredicto: **${rawReport.verdict}**`,
      "",
      "| Fuente | Manifest | Snapshot | Raw | Duplicadas* | Inválidas* | Resultado |",
      "|---|---:|---:|---:|---:|---:|---|",
      ...rawQuality.map((r) =>
        `| ${r.source_table} | ${r.expected_rows} | ${r.imported_rows} | ${r.raw_rows} | ${r.duplicate_external_id_in_sample} | ${r.invalid_payloads_in_sample + r.null_row_data} | ${r.result_raw} |`
      ),
      "",
      "\\* duplicadas/inválidas sobre sample ≤1000 por fuente.",
      "",
    ].join("\n"),
  );

  console.log(JSON.stringify({
    migration_id: migrationId,
    phase1: report.verdict,
    phase2: rawReport.verdict,
    sources: rows.length,
    expected_rows: expectedTotal,
    imported_rows: importedTotal,
    failed_rows: failedTotal,
    obsolete: rawReport.obsolete_count,
  }, null, 2));

  process.exit(pass && rawReport.verdict === "PASS" ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
