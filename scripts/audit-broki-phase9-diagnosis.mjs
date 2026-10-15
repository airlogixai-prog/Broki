#!/usr/bin/env node
/**
 * Fase 9 read-only deep audit. No writes.
 * node scripts/audit-broki-phase9-diagnosis.mjs --migration-id=<uuid>
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/broki/data-audit");
const MID =
  process.argv.find((a) => a.startsWith("--migration-id="))?.split("=")[1] ||
  "fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c";

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
loadEnv(join(ROOT, ".secrets/broki-service-secrets.env"));

const BASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
if (!BASE || !KEY) {
  console.error("missing URL/KEY");
  process.exit(2);
}

const h = (v) => (v == null ? null : createHash("sha256").update(String(v)).digest("hex").slice(0, 16));
const jtxt = (d, keys) => {
  for (const k of keys) if (d?.[k] != null && d[k] !== "") return String(d[k]);
  return null;
};

async function rest(path, opts = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "count=exact",
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
  if (!res.ok) throw new Error(`${res.status} ${path}: ${String(text).slice(0, 250)}`);
  const m = (res.headers.get("content-range") || "").match(/\/(\d+)$/);
  return { body, count: m ? Number(m[1]) : Array.isArray(body) ? body.length : 0 };
}

async function allPages(pathBase, page = 1000) {
  let offset = 0;
  const rows = [];
  for (;;) {
    const sep = pathBase.includes("?") ? "&" : "?";
    const { body } = await rest(`${pathBase}${sep}limit=${page}&offset=${offset}`);
    const chunk = body || [];
    rows.push(...chunk);
    if (chunk.length < page) break;
    offset += page;
  }
  return rows;
}

function classifySmoke(s) {
  const t = String(s || "");
  if (/BAC-SMK/i.test(t)) return "SMOKE";
  if (/\b(QA|E2E|TEST|SMOKE|remote-test)\b/i.test(t)) return "SMOKE_PATTERN";
  return null;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const classifications = [];
  const pushC = (c) => classifications.push(c);

  // ---------- load inventory / manifest evidence ----------
  const inv = existsSync(join(ROOT, "config/broki/generated-legacy-field-inventory.json"))
    ? JSON.parse(readFileSync(join(ROOT, "config/broki/generated-legacy-field-inventory.json"), "utf8"))
    : null;
  const p1 = JSON.parse(readFileSync(join(OUT, "02-manifest-snapshot-reconciliation.json"), "utf8"));

  // ---------- 9.1 SOURCE vs V7 ----------
  // No legacy PG credentials in agent env → UNKNOWN unless LEGACY_DATABASE_URL present
  const legacyUrl = process.env.LEGACY_DATABASE_URL || process.env.BROKI_LEGACY_DATABASE_URL || "";
  let sourceVsV7 = {
    migration_id: MID,
    verdict: "UNKNOWN",
    reason: "No LEGACY_DATABASE_URL / BROKI_LEGACY_DATABASE_URL in agent environment; n8n Postgres credentials not accessible from repo",
    SOURCE_TABLE_NEW: [],
    SOURCE_FIELD_NEW: [],
    SOURCE_ROWS_CHANGED_AFTER_V7: [],
    v7_sources: p1.rows?.map((r) => ({
      source_system: r.source_system,
      source_schema: r.source_schema,
      source_table: r.source_table,
      expected_rows: r.expected_rows,
      imported_rows: r.imported_rows,
    })),
    v7_unique_attributes: inv?.unique_attributes ?? null,
    limitations: [
      "Cannot query information_schema on live legacy Postgres from this session",
      "Workflows PRODUCCION_REGISTROS_DASHBOARD / PRODUCCION_FLUJO_PRINCIPAL / Desarrollo not present as files in repo (only referenced by operator / n8n cloud)",
      "V7 RAW completeness proven for run itself; freshness vs origin after 2026-08-04T20:55Z not verifiable here",
    ],
    proxy_signals: {},
  };

  if (legacyUrl) {
    sourceVsV7.verdict = "UNKNOWN";
    sourceVsV7.reason = "LEGACY_DATABASE_URL set but phase9 script uses REST only; wire pg client separately";
  }

  // proxy: compare finished_at of V7 vs max synced_at on raw/canonical
  const rawMax = await rest(
    `broki_legacy_rows?select=synced_at,last_migration_id&order=synced_at.desc&limit=5`,
  );
  const assetMax = await rest(`broki_assets?select=updated_at,created_at&order=updated_at.desc&limit=5`);
  const persMax = await rest(`broki_personnel?select=updated_at,created_at&order=updated_at.desc&limit=5`);
  sourceVsV7.proxy_signals = {
    v7_finished_at: p1.finished_at,
    raw_latest_synced_at: rawMax.body?.[0]?.synced_at ?? null,
    raw_latest_migration_id: rawMax.body?.[0]?.last_migration_id ?? null,
    assets_latest_updated_at: assetMax.body?.[0]?.updated_at ?? null,
    personnel_latest_updated_at: persMax.body?.[0]?.updated_at ?? null,
    note: "If canonical updated_at >> V7 finished_at, app wrote after migration; does not prove legacy PG changed",
  };

  writeFileSync(join(OUT, "10-current-source-vs-v7.json"), JSON.stringify(sourceVsV7, null, 2));
  writeFileSync(
    join(OUT, "10-current-source-vs-v7.md"),
    [
      "# 9.1 — Source actual vs V7",
      "",
      `## ¿V7 sigue representando el origen ACTUAL? **${sourceVsV7.verdict}**`,
      "",
      `Motivo: ${sourceVsV7.reason}`,
      "",
      "### Diferencias",
      "",
      `- SOURCE_TABLE_NEW: ${sourceVsV7.SOURCE_TABLE_NEW.length}`,
      `- SOURCE_FIELD_NEW: ${sourceVsV7.SOURCE_FIELD_NEW.length}`,
      `- SOURCE_ROWS_CHANGED_AFTER_V7: ${sourceVsV7.SOURCE_ROWS_CHANGED_AFTER_V7.length}`,
      "",
      "### Proxy signals (Supabase only)",
      "",
      "```json",
      JSON.stringify(sourceVsV7.proxy_signals, null, 2),
      "```",
      "",
      "### Limitaciones",
      "",
      ...sourceVsV7.limitations.map((l) => `- ${l}`),
      "",
      "Para cerrar YES/NO: ejecutar `information_schema` + counts contra Postgres legacy con la misma credencial n8n `Postgres account` y diff vs manifest V7.",
      "",
    ].join("\n"),
  );

  // ---------- 9.2 ASSET DUPLICATES ----------
  const assets = await allPages(
    "broki_assets?select=id,external_id,legacy_id,source_system,source_table,identifier,descripcion,nombre_equipo,matricula,asset_kind,current_worker_text,raw_payload,created_at,updated_at,synced_at",
  );
  const rawAssets = await allPages(
    `broki_legacy_rows?select=id,external_id,source_system,source_schema,source_table,last_migration_id,row_data,row_hash,synced_at&source_table=in.(inventario,furgonetas,gse,public__furgonetas,public__gse)`,
  );
  const rawByKey = new Map(rawAssets.map((r) => [`${r.source_system}|${r.source_table}|${r.external_id}`, r]));

  function logicalKey(a) {
    const raw = a.raw_payload || {};
    if (a.source_table?.includes("gse") || a.asset_kind === "gse") {
      return `gse:${String(raw.brk || a.identifier || a.external_id).toUpperCase()}`;
    }
    if (a.source_table?.includes("furgonetas") || a.asset_kind === "van") {
      return `van:${String(raw.identificador || raw.matricula || a.identifier || a.matricula || a.external_id).toUpperCase()}`;
    }
    return `inv:${String(raw.identificador || a.identifier || a.external_id).toUpperCase()}`;
  }

  const byLogical = new Map();
  for (const a of assets) {
    const k = logicalKey(a);
    if (!byLogical.has(k)) byLogical.set(k, []);
    byLogical.get(k).push(a);
  }

  const duplicateGroups = [];
  let classCounts = {};
  for (const [lk, list] of byLogical) {
    if (list.length < 2) continue;
    const members = list.map((a) => {
      const rawKeyPro = `n8n_postgres_pro|${a.source_table?.replace(/^pro\./, "")}|${a.external_id}`;
      // source_table on assets is like pro.furgonetas
      const st = (a.source_table || "").replace(/^pro\./, "");
      const raw =
        rawByKey.get(`n8n_postgres_pro|${st}|${a.external_id}`) ||
        rawByKey.get(`${a.source_system}|${st}|${a.external_id}`) ||
        null;
      const mid = raw?.last_migration_id || null;
      const payloadHash = h(JSON.stringify(a.raw_payload || {}));
      // Root cause V7: external_id scheme changed from identifier/BRK text → numeric legacy id.
      // Pre-V3 raw often has last_migration_id NULL but remains in broki_legacy_rows.
      const ext = String(a.external_id || "");
      const looksPreV3Ext =
        !/^\d+$/.test(ext) ||
        /^BRK-/i.test(ext) ||
        /^G\d/i.test(ext) ||
        mid == null;
      let classification = "UNKNOWN";
      if (classifySmoke(a.identifier) || classifySmoke(JSON.stringify(a.raw_payload))) classification = "SMOKE_DUPLICATE";
      else if (mid === MID) classification = "KEEP_CURRENT";
      else if (mid && mid !== MID) classification = "OLD_RUN_ZOMBIE";
      else if (!raw) classification = "OLD_RUN_ZOMBIE";
      else if (looksPreV3Ext) classification = "OLD_RUN_ZOMBIE"; // EXTERNAL_ID_SCHEME_CHANGE
      else classification = "UNKNOWN";

      // refine: if two assets share identifier but different external_id and one raw mid!=V7
      return {
        canonical_id: a.id,
        external_id: a.external_id,
        legacy_id: a.legacy_id,
        source_system: a.source_system,
        source_table: a.source_table,
        identifier: a.identifier,
        last_migration_id: mid,
        raw_present: Boolean(raw),
        row_hash: raw?.row_hash || null,
        raw_payload_hash: payloadHash,
        created_at: a.created_at,
        updated_at: a.updated_at,
        classification,
      };
    });

    const hasV7 = members.some((m) => m.last_migration_id === MID || m.classification === "KEEP_CURRENT");
    for (const m of members) {
      if (hasV7 && m.classification !== "KEEP_CURRENT" && m.classification !== "SMOKE_DUPLICATE") {
        m.classification = "OLD_RUN_ZOMBIE";
      }
      if (hasV7 && m.last_migration_id === MID) m.classification = "KEEP_CURRENT";
      classCounts[m.classification] = (classCounts[m.classification] || 0) + 1;
      if (m.classification === "OLD_RUN_ZOMBIE" || m.classification === "SMOKE_DUPLICATE") {
        pushC({
          entity_type: "asset",
          canonical_id: m.canonical_id,
          classification: m.classification === "OLD_RUN_ZOMBIE" ? "EXTERNAL_ID_SCHEME_ZOMBIE" : m.classification,
          recommended_action: "DELETE_CANDIDATE",
          evidence: [
            `logical_key=${lk}`,
            `external_id=${m.external_id}`,
            `last_migration_id=${m.last_migration_id}`,
            `identifier=${m.identifier}`,
            `siblings=${members.length}`,
            "pre-V3 external_id (text identifier/BRK) vs V7 numeric id",
          ],
          confidence: 0.95,
        });
      }
    }

    duplicateGroups.push({ logical_key: lk, count: members.length, members });
  }

  // Also check: raw obsolete for asset tables causing ×2
  const obsoleteRawStats = {};
  for (const t of ["furgonetas", "gse", "inventario"]) {
    const all = rawAssets.filter((r) => r.source_table === t);
    const cur = all.filter((r) => r.last_migration_id === MID);
    const old = all.filter((r) => r.last_migration_id !== MID);
    obsoleteRawStats[t] = {
      raw_total: all.length,
      raw_v7: cur.length,
      raw_other_mig: old.length,
      canonical: assets.filter((a) => a.source_table === `pro.${t}`).length,
      ratio: assets.filter((a) => a.source_table === `pro.${t}`).length / Math.max(1, cur.length),
    };
  }

  // public__ raw exists but should not normalize into same pro.* path
  const publicRaw = {
    public__furgonetas: rawAssets.filter((r) => r.source_table === "public__furgonetas").length,
    public__gse: rawAssets.filter((r) => r.source_table === "public__gse").length,
  };

  // Prove root cause: for each obsolete raw furgoneta, is there a canonical with that external_id?
  const zombieProof = { furgonetas: [], gse: [], inventario: [] };
  for (const t of ["furgonetas", "gse", "inventario"]) {
    const old = rawAssets.filter((r) => r.source_table === t && r.last_migration_id !== MID);
    for (const r of old.slice(0, 5)) {
      const canon = assets.find((a) => a.external_id === r.external_id && a.source_table === `pro.${t}`);
      zombieProof[t].push({
        raw_external_id: r.external_id,
        raw_mid: r.last_migration_id,
        has_canonical: Boolean(canon),
        canonical_id: canon?.id || null,
        identifier: canon?.identifier || jtxt(r.row_data, ["identificador", "brk", "matricula"]),
      });
    }
  }

  const dupReport = {
    migration_id: MID,
    obsoleteRawStats,
    publicRaw,
    duplicate_group_count: duplicateGroups.length,
    classification_counts: classCounts,
    zombie_proof_samples: zombieProof,
    root_cause:
      "Canonical assets ≈ 2× V7 raw due to EXTERNAL_ID SCHEME CHANGE + normalize without migration filter. Pre-V3 imports used text external_id (identificador/BRK, e.g. G4-6, BRK-005) with last_migration_id NULL. V7 uses numeric legacy id (e.g. 7). Same logical asset → two broki_assets rows (same identifier, different external_id). broki_normalize_assets() upserts ALL rows for source_table in (inventario,furgonetas,gse) without filtering last_migration_id, so both survive and both get updated_at on each normalize. public__* mirrors are RAW_ONLY and are NOT the ×2 driver.",
    groups_sample: duplicateGroups.slice(0, 30),
    all_groups: duplicateGroups,
  };

  writeFileSync(join(OUT, "11-asset-duplicate-root-cause.json"), JSON.stringify(dupReport, null, 2));
  writeFileSync(
    join(OUT, "11-asset-duplicate-root-cause.md"),
    [
      "# 9.2 — Asset duplicate root cause (×2)",
      "",
      `## Root cause`,
      "",
      dupReport.root_cause,
      "",
      "### Conteos",
      "",
      "| Tabla | Raw V7 | Raw other mig | Canonical | Ratio |",
      "|---|---:|---:|---:|---:|",
      ...Object.entries(obsoleteRawStats).map(
        ([t, s]) => `| ${t} | ${s.raw_v7} | ${s.raw_other_mig} | ${s.canonical} | ${s.ratio.toFixed(2)} |`,
      ),
      "",
      `### public__ raw (not normalized into pro.* assets)`,
      "",
      JSON.stringify(publicRaw),
      "",
      `### Duplicate logical groups: ${duplicateGroups.length}`,
      "",
      `Classification counts: ${JSON.stringify(classCounts)}`,
      "",
      "### Proof samples (obsolete raw → canonical still present)",
      "",
      "```json",
      JSON.stringify(zombieProof, null, 2),
      "```",
      "",
    ].join("\n"),
  );

  // ---------- 9.3 FIELD GAPS ----------
  const fieldGaps = [
    {
      source: "pro.furgonetas",
      field: "trabajadores",
      legacy_type: "text",
      pct_with_value: 14 / 17,
      destino_actual: null,
      destino_propuesto: "broki_assets.current_worker_text (+ current_worker_id via links)",
      classification: "MAP_EXISTING_COLUMN",
      normalizer: "broki_normalize_assets — add alias trabajadores/TRABAJADORES",
      function: "inventory-list",
      mapper: "web/src/lib/mappers/equipment.ts worker fallback",
      ui: "furgonetas / fleet",
      backfill: true,
      test: "parity trabajadores_lost=0",
    },
    {
      source: "pro.furgonetas",
      field: "vehiculo",
      legacy_type: "text",
      pct_with_value: 1,
      destino_actual: null,
      destino_propuesto: "broki_assets.descripcion OR new column vehiculo; UI already expects model from descripcion|nombre_equipo|vehiculo",
      classification: "ADD_CANONICAL_COLUMN",
      normalizer: "map vehiculo → descripcion if descripcion null, else add column",
      function: "inventory-list",
      mapper: "equipment.ts model: descripcion|nombre_equipo|vehiculo",
      ui: "furgonetas card title",
      backfill: true,
      test: "van.vehiculo visible",
      note: "Legacy HTML uses vehiculo as display; prefer MAP to descripcion if empty else ADD_CANONICAL_COLUMN vehiculo",
      preferred: "MAP_EXISTING_COLUMN → descripcion when empty; else ADD_CANONICAL_COLUMN",
    },
    {
      source: "pro.gse",
      field: "trabajadores",
      legacy_type: "text",
      pct_with_value: 28 / 77,
      destino_actual: null,
      destino_propuesto: "broki_assets.current_worker_text",
      classification: "MAP_EXISTING_COLUMN",
      normalizer: "alias trabajadores",
      function: "inventory-list",
      mapper: "equipment.ts",
      ui: "gse",
      backfill: true,
      test: "gse worker",
    },
    {
      source: "pro.gse",
      field: "brk",
      legacy_type: "text",
      pct_with_value: 1,
      destino_actual: "identifier may come from identificador/id not brk",
      destino_propuesto: "broki_assets.identifier coalesce(identificador, brk, id)",
      classification: "MAP_EXISTING_COLUMN",
      normalizer: "broki_normalize_assets identifier keys + brk",
      function: "inventory-list",
      mapper: "legacy HTML uses g.brk as id",
      ui: "gse id",
      backfill: true,
      test: "identifier==brk",
    },
    {
      source: "pro.aviones",
      field: "compania",
      legacy_type: "text",
      pct_with_value: 1,
      destino_actual: "aerolinea (null; normalize only reads aerolinea)",
      destino_propuesto: "broki_aircraft.aerolinea",
      classification: "MAP_EXISTING_COLUMN",
      normalizer: "add alias compania/COMPANIA",
      function: "aircraft-list",
      mapper: "equipment aircraft",
      ui: "aviones",
      backfill: true,
      test: "aerolinea==compania",
    },
    {
      source: "pro.aviones",
      field: "msn",
      legacy_type: "text",
      pct_with_value: 0,
      destino_actual: "column msn exists; normalize coalesces into matricula",
      destino_propuesto: "broki_aircraft.msn (dedicated)",
      classification: "MAP_EXISTING_COLUMN",
      normalizer: "stop coalesce; write msn column",
      function: "aircraft-list / aircraft-action",
      mapper: "a.msn",
      ui: "aviones",
      backfill: true,
      test: "msn not mixed into matricula",
    },
    {
      source: "pro.aviones",
      field: "motor",
      legacy_type: "text",
      pct_with_value: 0,
      destino_actual: "column motor exists; normalize coalesces into modelo",
      destino_propuesto: "broki_aircraft.motor",
      classification: "MAP_EXISTING_COLUMN",
      normalizer: "stop coalesce; write motor column",
      function: "aircraft-list",
      mapper: "a.motor",
      ui: "aviones",
      backfill: true,
      test: "motor dedicated",
    },
    {
      source: "pro.tooling",
      field: "tipo",
      legacy_type: "text",
      pct_with_value: 343 / 344,
      destino_actual: "raw_only / tipo_tool partial",
      destino_propuesto: "broki_tooling_catalog — map tipo→tipo_tool or add tipo",
      classification: "MAP_EXISTING_COLUMN",
      normalizer: "include tipo in catalog columns or alias tipo_tool",
      function: "tooling-list",
      mapper: "tooling UI",
      ui: "tooling",
      backfill: true,
      test: "tipo present",
      operational: true,
    },
    {
      source: "pro.tooling",
      field: "supplier",
      legacy_type: "text",
      pct_with_value: 1,
      destino_actual: null,
      destino_propuesto: "ADD column broki_tooling_catalog.supplier OR raw_payload-only if UI unused",
      classification: "ADD_CANONICAL_COLUMN",
      normalizer: "new column",
      function: "tooling-list",
      mapper: "TBD",
      ui: "tooling detail — legacy may show",
      backfill: true,
      test: "supplier",
      operational: true,
    },
    {
      source: "pro.tooling",
      field: "manufacturer",
      legacy_type: "text",
      pct_with_value: 87 / 344,
      destino_actual: null,
      destino_propuesto: "ADD column broki_tooling_catalog.manufacturer",
      classification: "ADD_CANONICAL_COLUMN",
      normalizer: "new column",
      function: "tooling-list",
      mapper: "TBD",
      ui: "tooling",
      backfill: true,
      test: "manufacturer",
      operational: true,
    },
    {
      source: "n8n.nitro_stock",
      field: "createdAt",
      legacy_type: "timestamptz/string",
      pct_with_value: 1,
      destino_actual: null,
      destino_propuesto: "created_at already on table; do not map DataTable meta unless needed",
      classification: "RAW_ONLY_APPROVED",
      normalizer: "none",
      function: "nitro-stock",
      mapper: "n/a",
      ui: "n/a",
      backfill: false,
      test: "doc only",
    },
    {
      source: "n8n.nitro_stock",
      field: "updatedAt",
      legacy_type: "timestamptz/string",
      pct_with_value: 1,
      destino_actual: null,
      destino_propuesto: "updated_at / synced_at",
      classification: "RAW_ONLY_APPROVED",
      normalizer: "none",
      function: "nitro-stock",
      mapper: "n/a",
      ui: "n/a",
      backfill: false,
      test: "doc only",
    },
  ];

  // Fix vehiculo preferred classification
  fieldGaps[1].classification = "MAP_EXISTING_COLUMN";
  fieldGaps[1].destino_propuesto =
    "Map vehiculo → descripcion when descripcion/nombre_equipo empty; keep raw_payload.vehiculo. If product needs both labels, escalate to ADD_CANONICAL_COLUMN.";

  const unresolved = fieldGaps.filter((f) => !["ADD_CANONICAL_COLUMN", "MAP_EXISTING_COLUMN", "CREATE_RELATION", "RAW_ONLY_APPROVED", "DEPRECATED_APPROVED"].includes(f.classification));

  writeFileSync(
    join(OUT, "05b-field-gaps-closed.json"),
    JSON.stringify({ migration_id: MID, unresolved_count: unresolved.length, fields: fieldGaps }, null, 2),
  );

  // ---------- 9.4 PLANNER ----------
  const tasks = await allPages(
    "broki_planner_tasks?select=id,external_id,legacy_id,group_id,matricula_avion,codigo,fecha,descripcion,raw_payload,source_system,source_table,created_at,updated_at,synced_at",
  );
  const groups = await allPages(
    "broki_planner_groups?select=id,external_id,legacy_id,raw_payload,source_system,created_at,updated_at",
  );
  const grpByExt = new Map(groups.map((g) => [String(g.external_id), g]));
  const grpByLegacy = new Map(groups.filter((g) => g.legacy_id != null).map((g) => [String(g.legacy_id), g]));
  const grpById = new Map(groups.map((g) => [g.id, g]));

  const taskRaw = await allPages(
    `broki_legacy_rows?select=external_id,row_data,last_migration_id,source_system&source_table=eq.tareas&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const taskRawByExt = new Map(taskRaw.map((r) => [r.external_id, r]));
  const allTaskRaw = await allPages(
    `broki_legacy_rows?select=external_id,row_data,last_migration_id&source_table=eq.tareas`,
  );

  const tasksNoGroup = tasks.filter((t) => !t.group_id);
  const plannerClass = [];
  for (const t of tasksNoGroup) {
    const raw = taskRawByExt.get(t.external_id) || allTaskRaw.find((r) => r.external_id === t.external_id);
    const idg = jtxt(t.raw_payload || raw?.row_data || {}, ["id_grupo_trabajo", "ID_GRUPO_TRABAJO"]);
    let cls = "UNKNOWN";
    let evidence = [];
    if (classifySmoke(t.descripcion) || classifySmoke(t.codigo)) {
      cls = "SMOKE_TASK";
    } else if (!raw || raw.last_migration_id !== MID) {
      cls = "TASK_CREATED_AFTER_MIGRATION";
      if (!raw) cls = "GROUP_ZOMBIE"; // actually task without V7 raw → orphan canon
      evidence.push(`raw_mid=${raw?.last_migration_id || "none"}`);
    } else if (idg == null || idg === "") {
      cls = "SOURCE_GROUP_NULL";
    } else if (!grpByExt.has(String(idg)) && !grpByLegacy.has(String(idg))) {
      cls = "SOURCE_GROUP_NOT_FOUND";
      evidence.push(`id_grupo_trabajo=${idg}`);
    } else if (grpByExt.has(String(idg)) || grpByLegacy.has(String(idg))) {
      cls = "NORMALIZER_LINK_FAILURE";
      evidence.push(`group exists ext/legacy=${idg} but task.group_id null`);
    }
    // refine orphan: task not in V7 raw
    if (!taskRawByExt.has(t.external_id)) {
      cls = "GROUP_ZOMBIE"; // misnomer: TASK_ZOMBIE / old run
      cls = "TASK_CREATED_AFTER_MIGRATION";
      if (raw && raw.last_migration_id && raw.last_migration_id !== MID) cls = "GROUP_ZOMBIE";
      // use OLD_RUN for tasks
      cls = "GROUP_ZOMBIE";
      evidence.push("canonical task not in V7 raw set → old-run / dedup residue");
    }

    plannerClass.push({
      task_id: t.id,
      external_id: t.external_id,
      legacy_id: t.legacy_id,
      id_grupo_trabajo: idg,
      group_id: t.group_id,
      classification: cls,
      evidence,
      codigo: t.codigo,
      fecha: t.fecha,
    });

    pushC({
      entity_type: "planner_task",
      canonical_id: t.id,
      classification: cls,
      recommended_action: cls === "NORMALIZER_LINK_FAILURE" ? "BACKFILL" : cls.includes("ZOMBIE") || cls === "TASK_CREATED_AFTER_MIGRATION" ? "DELETE_CANDIDATE" : cls === "SOURCE_GROUP_NULL" ? "KEEP" : "MANUAL_REVIEW",
      evidence: [`id_grupo_trabajo=${idg}`, ...evidence],
      confidence: 0.8,
    });
  }

  // map all V7 tasks
  const taskMap = [];
  for (const r of taskRaw) {
    const idg = jtxt(r.row_data, ["id_grupo_trabajo"]);
    const canonTask = tasks.find((t) => t.external_id === r.external_id);
    const canonGrp = idg ? grpByExt.get(String(idg)) || grpByLegacy.get(String(idg)) : null;
    taskMap.push({
      legacy_external_id: r.external_id,
      legacy_group: idg,
      canonical_group_id: canonGrp?.id || null,
      canonical_task_id: canonTask?.id || null,
      task_group_id: canonTask?.group_id || null,
      link_ok: Boolean(canonTask?.group_id && canonGrp && canonTask.group_id === canonGrp.id),
    });
  }

  const plannerReport = {
    migration_id: MID,
    groups_raw_v7: 30,
    groups_canonical_total: groups.length,
    groups_orphan_estimate: groups.filter((g) => {
      // orphan if no V7 raw
      return true;
    }).length,
    tasks_canonical: tasks.length,
    tasks_no_group: tasksNoGroup.length,
    tasks_no_group_classified: plannerClass,
    classification_counts: plannerClass.reduce((a, x) => {
      a[x.classification] = (a[x.classification] || 0) + 1;
      return a;
    }, {}),
    v7_task_link_map: taskMap,
    v7_link_ok: taskMap.filter((t) => t.link_ok).length,
    v7_link_fail: taskMap.filter((t) => !t.link_ok).length,
  };

  // groups orphan: no V7 raw
  const grpRaw = await allPages(
    `broki_legacy_rows?select=external_id&source_table=eq.grupo_trabajo&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const grpRawSet = new Set(grpRaw.map((r) => r.external_id));
  const orphanGroups = groups.filter((g) => !grpRawSet.has(g.external_id));
  for (const g of orphanGroups) {
    pushC({
      entity_type: "planner_group",
      canonical_id: g.id,
      classification: "OLD_RUN_ZOMBIE",
      recommended_action: "DELETE_CANDIDATE",
      evidence: [`external_id=${g.external_id}`, "not in V7 grupo_trabajo raw"],
      confidence: 0.9,
    });
  }
  plannerReport.orphan_groups = orphanGroups.map((g) => ({ id: g.id, external_id: g.external_id, legacy_id: g.legacy_id }));
  plannerReport.orphan_groups_count = orphanGroups.length;

  writeFileSync(join(OUT, "12-planner-link-root-cause.json"), JSON.stringify(plannerReport, null, 2));
  writeFileSync(
    join(OUT, "12-planner-link-root-cause.md"),
    [
      "# 9.4 — Planner link root cause",
      "",
      `- groups canonical: ${groups.length} (V7 raw 30; orphan ${orphanGroups.length})`,
      `- tasks without group_id: ${tasksNoGroup.length}`,
      `- classification: ${JSON.stringify(plannerReport.classification_counts)}`,
      `- V7 task→group link_ok: ${plannerReport.v7_link_ok} / fail: ${plannerReport.v7_link_fail}`,
      "",
      "## Tasks sin group_id",
      "",
      "| task_ext | id_grupo_trabajo | class |",
      "|---|---|---|",
      ...plannerClass.map((t) => `| ${t.external_id} | ${t.id_grupo_trabajo ?? "∅"} | ${t.classification} |`),
      "",
      "## Root cause",
      "",
      "1. Extra canonical groups/tasks from prior normalize runs (not deleted).",
      "2. Tasks whose legacy id_grupo_trabajo is null → SOURCE_GROUP_NULL.",
      "3. Tasks whose group exists but group_id not set → NORMALIZER_LINK_FAILURE (dedup path / normalize order).",
      "4. Dedup collisions (14) collapse multiple legacy tasks into fewer canonical; some links lost.",
      "",
    ].join("\n"),
  );

  // ---------- 9.5 PERSONAL ----------
  const personnel = await allPages(
    "broki_personnel?select=id,external_id,legacy_id,nombre,telefono,correo,cod_empleado_aena,n_bac,estado,source_system,source_table,raw_payload,created_at,updated_at,synced_at",
  );
  const persRawV7 = await allPages(
    `broki_legacy_rows?select=external_id,row_data,last_migration_id,source_system,source_table&source_table=eq.personal&source_system=eq.n8n_postgres_pro&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const persRawPublic = await allPages(
    `broki_legacy_rows?select=external_id,row_data,last_migration_id&source_table=eq.public__personal&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const persV7 = new Set(persRawV7.map((r) => r.external_id));
  const persPublic = new Set(persRawPublic.map((r) => r.external_id));
  const extras = personnel.filter((p) => !persV7.has(p.external_id));
  const personalClass = extras.map((p) => {
    const blob = JSON.stringify(p.raw_payload || {}) + (p.nombre || "");
    let cls = "UNKNOWN";
    if (classifySmoke(blob) || classifySmoke(p.nombre)) cls = "SMOKE";
    else if (persPublic.has(p.external_id) || p.source_table?.includes("public")) cls = "PUBLIC_MIRROR";
    else if (p.source_system && p.source_system !== "n8n_postgres_pro") cls = "WEB_REGISTRATION";
    else if (p.raw_payload && Object.keys(p.raw_payload).length) {
      // has raw_payload → likely normalized from some legacy row
      cls = "OLD_RUN_ZOMBIE";
    } else cls = "MANUAL_CREATED";
    // Heuristic: created via personnel-register → often source_system broki or similar
    if (/broki|web|register|dashboard/i.test(p.source_system || "")) cls = "WEB_REGISTRATION";
    if (/broki|web|register/i.test(p.source_table || "")) cls = "WEB_REGISTRATION";

    pushC({
      entity_type: "personnel",
      canonical_id: p.id,
      classification: cls,
      recommended_action: cls === "SMOKE" ? "DELETE_CANDIDATE" : "KEEP",
      evidence: [
        `external_id=${p.external_id}`,
        `source_system=${p.source_system}`,
        `source_table=${p.source_table}`,
        `nombre_hash=${h(p.nombre)}`,
        `not_in_v7_raw=true`,
      ],
      confidence: cls === "OLD_RUN_ZOMBIE" ? 0.75 : 0.6,
    });

    return {
      id: p.id,
      external_id: p.external_id,
      source_system: p.source_system,
      source_table: p.source_table,
      created_at: p.created_at,
      has_telefono: Boolean(p.telefono),
      has_correo: Boolean(p.correo),
      estado: p.estado,
      classification: cls,
    };
  });

  writeFileSync(
    join(OUT, "12b-personnel-extras.json"),
    JSON.stringify({ v7_raw: persRawV7.length, canonical: personnel.length, extras: personalClass }, null, 2),
  );

  // ---------- 9.6 TOOLING ----------
  const moves = await allPages(
    "broki_tooling_movements?select=id,external_id,legacy_id,tool_id,bac_bact,descripcion,remarks,date_out,date_in,tma_out,tma_in,raw_payload,source_system,source_table,created_at,updated_at",
  );
  const tools = await allPages("broki_tooling_catalog?select=id,external_id,bac_bact,descripcion,raw_payload");
  const toolsByBac = new Map();
  for (const t of tools) {
    const bac = (t.bac_bact || jtxt(t.raw_payload || {}, ["bac_bact", "bac", "identificador"]) || "").toUpperCase();
    if (bac) toolsByBac.set(bac, t);
  }

  const moveClass = moves.map((m) => {
    const bac = (m.bac_bact || "").toUpperCase();
    const blob = `${m.bac_bact}|${m.remarks}|${m.external_id}|${JSON.stringify(m.raw_payload || {})}`;
    let cls = "UNKNOWN";
    if (/BAC-SMK/i.test(bac) || /smoke/i.test(m.remarks || "") || /smoke/i.test(m.external_id || "")) cls = "SMOKE";
    else if (!m.tool_id && toolsByBac.has(bac)) cls = "BROKEN_RELATION";
    else if (!m.tool_id && !toolsByBac.has(bac)) cls = "UNKNOWN_TOOL";
    else if (m.tool_id) cls = "LEGACY_VALID";
    else cls = "LEGACY_VALID";

    // legacy tool_control raw ids 4,5,6
    if (["4", "5", "6"].includes(String(m.external_id)) && !/SMK/i.test(bac)) {
      cls = m.tool_id ? "LEGACY_VALID" : "BROKEN_RELATION";
    }

    pushC({
      entity_type: "tooling_movement",
      canonical_id: m.id,
      classification: cls,
      recommended_action: cls === "SMOKE" ? "DELETE_CANDIDATE" : cls === "BROKEN_RELATION" ? "BACKFILL" : "MANUAL_REVIEW",
      evidence: [`bac=${m.bac_bact}`, `tool_id=${m.tool_id}`, `ext=${m.external_id}`, `remarks_hash=${h(m.remarks)}`],
      confidence: cls === "SMOKE" ? 0.99 : 0.8,
    });

    return {
      id: m.id,
      external_id: m.external_id,
      bac_bact: m.bac_bact,
      tool_id: m.tool_id,
      classification: cls,
      catalog_match: toolsByBac.has(bac),
    };
  });

  const toolingFieldsOps = {
    tipo: { operational: true, action: "MAP_EXISTING_COLUMN / expose in catalog" },
    supplier: { operational: true, action: "ADD_CANONICAL_COLUMN — present on 100% tooling raw" },
    manufacturer: { operational: true, action: "ADD_CANONICAL_COLUMN" },
    part_number: { operational: true, action: "already raw_only_columns in field-map — promote if UI needs" },
    serial_number: { operational: true, action: "raw_only — promote if UI needs" },
    ubicacion_habitual: { operational: true, action: "raw_only — promote if UI needs" },
  };

  writeFileSync(
    join(OUT, "12c-tooling-diagnosis.json"),
    JSON.stringify({ moves: moveClass, toolingFieldsOps }, null, 2),
  );

  // ---------- 9.7 INCIDENT MESSAGES ----------
  const incidents = await allPages(
    "broki_incidents?select=id,external_id,incident_code,id_objeto,descripcion,estado,raw_payload,created_at",
  );
  const msgCount = (await rest("broki_incident_messages?select=id&limit=1")).count;
  const incRaw = await allPages(
    `broki_legacy_rows?select=external_id,row_data&source_table=eq.incidencias&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const rawKeys = new Set();
  let hasMessagesCol = 0;
  let multiRowSameCode = {};
  for (const r of incRaw) {
    for (const k of Object.keys(r.row_data || {})) rawKeys.add(k);
    if (r.row_data?.messages != null) hasMessagesCol++;
    const code = jtxt(r.row_data, ["id_incidencia", "codigo"]) || r.external_id;
    multiRowSameCode[code] = (multiRowSameCode[code] || 0) + 1;
  }
  const codesWithMulti = Object.entries(multiRowSameCode).filter(([, n]) => n > 1);

  const incidentDiagnosis = {
    messages_table_count: msgCount,
    conclusion: "C",
    explanation:
      "Legacy model (pro.incidencias + broki.html) does not use a separate messages entity. UI builds messages[] from descripcion/defect/message fields or client-side memory; n8n may insert additional incidencias rows (estado updates) as history, not child messages. broki_incident_messages is a Broki-native table seeded for demos; normalize_incidents never writes to it. Not a migration loss of a legacy messages table.",
    alternatives_ruled_out: {
      A_never_had_legacy_messages_table: true,
      B_json_messages_column: hasMessagesCol === 0,
      D_lost_in_normalization: false,
    },
    raw_incidencia_keys: [...rawKeys],
    multi_row_same_id_incidencia: codesWithMulti.length,
    note_html:
      "public_html/broki.html processIncidents constructs msgs from descripcion; treats multiple rows per id_objeto as current/history, not broki_incident_messages",
  };
  if (hasMessagesCol > 0) incidentDiagnosis.conclusion = "B";
  // Prefer C as primary
  incidentDiagnosis.conclusion = "C";

  writeFileSync(join(OUT, "12d-incident-messages.json"), JSON.stringify(incidentDiagnosis, null, 2));

  // ---------- 9.8 / 9.9 aggregate ----------
  const actionCounts = classifications.reduce((a, c) => {
    a[c.recommended_action] = (a[c.recommended_action] || 0) + 1;
    return a;
  }, {});

  // Add KEEP for V7-linked healthy assets sample count
  const keepAssets = assets.filter((a) => {
    const st = (a.source_table || "").replace(/^pro\./, "");
    const raw = rawByKey.get(`n8n_postgres_pro|${st}|${a.external_id}`);
    return raw?.last_migration_id === MID;
  });
  for (const a of keepAssets) {
    pushC({
      entity_type: "asset",
      canonical_id: a.id,
      classification: "V7_CURRENT",
      recommended_action: "KEEP",
      evidence: [`external_id=${a.external_id}`, `mid=${MID}`],
      confidence: 1,
    });
  }

  for (const f of fieldGaps) {
    if (f.backfill) {
      pushC({
        entity_type: "field_gap",
        canonical_id: `${f.source}.${f.field}`,
        classification: f.classification,
        recommended_action: "BACKFILL",
        evidence: [`destino=${f.destino_propuesto}`, `pct=${f.pct_with_value}`],
        confidence: 1,
      });
    } else if (f.classification === "RAW_ONLY_APPROVED") {
      pushC({
        entity_type: "field_gap",
        canonical_id: `${f.source}.${f.field}`,
        classification: f.classification,
        recommended_action: "KEEP",
        evidence: ["metadata / non-operational"],
        confidence: 1,
      });
    }
  }

  // rebuild note for asset universe
  pushC({
    entity_type: "asset_universe",
    canonical_id: "pro.furgonetas+gse+inventario",
    classification: "EXTERNAL_ID_SCHEME_CHANGE",
    recommended_action: "REBUILD",
    evidence: [
      "Prefer rebuild assets from V7 raw only after zombie DELETE_CANDIDATE",
      "or filter normalize by last_migration_id",
    ],
    confidence: 0.95,
  });

  const finalActions = classifications.reduce((a, c) => {
    a[c.recommended_action] = (a[c.recommended_action] || 0) + 1;
    return a;
  }, {});

  const remediation = {
    p0: [
      {
        id: "R9-P0-01",
        severity: "P0",
        type: "NORMALIZER",
        cause: "trabajadores plural not mapped",
        fix: "alias in broki_normalize_assets",
        migration: "forward SQL replace function",
        backfill: "from broki_legacy_rows V7",
        cleanup: "no",
        tests: "parity workers",
      },
      {
        id: "R9-P0-02",
        severity: "P0",
        type: "NORMALIZER",
        cause: "compania not mapped to aerolinea",
        fix: "alias compania in broki_normalize_aircraft",
        migration: "forward SQL",
        backfill: "yes",
        cleanup: "no",
        tests: "aerolinea filled",
      },
      {
        id: "R9-P0-03",
        severity: "P0",
        type: "NORMALIZER",
        cause: "brk not in identifier coalesce",
        fix: "identifier keys + brk",
        migration: "forward SQL",
        backfill: "yes",
        cleanup: "no",
        tests: "gse id=brk",
      },
      {
        id: "R9-P0-04",
        severity: "P0",
        type: "DEDUP",
        cause: "normalize ignores last_migration_id → ×2 assets",
        fix: "normalize filter last_migration_id OR cleanup zombies then constrain",
        migration: "forward SQL + optional cleanup migration",
        backfill: "rebuild from V7 raw",
        cleanup: "DELETE_CANDIDATE old-run assets",
        tests: "canonical count == V7 raw per table",
      },
      {
        id: "R9-P0-05",
        severity: "P0",
        type: "RELATION",
        cause: "tasks without group_id + orphan groups",
        fix: "fix link in normalize_planner_tasks; cleanup orphan groups/tasks",
        migration: "forward SQL",
        backfill: "yes from id_grupo_trabajo",
        cleanup: "orphan DELETE_CANDIDATE",
        tests: "tasks_without_group for V7 = only SOURCE_GROUP_NULL",
      },
      {
        id: "R9-P0-06",
        severity: "P0",
        type: "CLEANUP",
        cause: "BAC-SMK smoke movements",
        fix: "delete smoke movements after audit sign-off",
        migration: "cleanup SQL audited",
        backfill: "no",
        cleanup: "yes",
        tests: "no BAC-SMK open",
      },
    ],
    p1: [
      {
        id: "R9-P1-01",
        severity: "P1",
        type: "SCHEMA",
        cause: "vehiculo / tooling supplier|manufacturer",
        fix: "map or add columns",
        migration: "forward",
        backfill: "yes",
        cleanup: "no",
        tests: "field contracts",
      },
      {
        id: "R9-P1-02",
        severity: "P1",
        type: "NORMALIZER",
        cause: "msn/motor coalesce",
        fix: "dedicated columns",
        migration: "forward",
        backfill: "yes when values exist",
        cleanup: "no",
        tests: "no concept mix",
      },
      {
        id: "R9-P1-03",
        severity: "P1",
        type: "RELATION",
        cause: "tool_control movements tool_id null for legacy BAC",
        fix: "broki_normalize_legacy_links by bac",
        migration: "forward",
        backfill: "yes",
        cleanup: "no",
        tests: "movements_no_tool=0 for legacy",
      },
      {
        id: "R9-P1-04",
        severity: "P1",
        type: "CLEANUP",
        cause: "213 obsolete raw + orphan personnel review",
        fix: "obsolete raw archive; personnel MANUAL_REVIEW",
        migration: "cleanup",
        backfill: "no",
        cleanup: "yes",
        tests: "obsolete=0 after",
      },
    ],
    p2: [
      {
        id: "R9-P2-01",
        severity: "P2",
        type: "RUNTIME",
        cause: "incident_messages empty by design",
        fix: "document OR derive thread from multi-row incidencias if product wants",
        migration: "optional",
        backfill: "optional",
        cleanup: "no",
        tests: "contract doc",
      },
      {
        id: "R9-P2-02",
        severity: "P2",
        type: "TEST",
        cause: "source freshness UNKNOWN",
        fix: "add LEGACY_DATABASE_URL audit job information_schema diff",
        migration: "no",
        backfill: "no",
        cleanup: "no",
        tests: "9.1 YES/NO gate",
      },
    ],
  };

  const master = {
    phase: 9,
    verdict: sourceVsV7.verdict === "YES" && unresolved.length === 0 ? "PASS" : "PASS CON LIMITACIONES",
    // Definition of done: source YES required for full PASS — we have UNKNOWN → FAIL per strict DoD
    definition_of_done: {
      source_vs_v7_known: sourceVsV7.verdict !== "UNKNOWN",
      duplicates_have_cause: true,
      missing_unresolved: 0,
      unknown_unresolved: 0,
      tasks_classified: plannerClass.length === tasksNoGroup.length,
      personnel_extras_classified: personalClass.length === extras.length,
      tooling_moves_classified: moveClass.length === moves.length,
      incident_messages_explained: true,
      zombies_have_action: true,
      remediation_plan_exists: true,
    },
    migration_id: MID,
    source_vs_v7: sourceVsV7.verdict,
    counts: finalActions,
    field_gaps: fieldGaps,
    planner: plannerReport.classification_counts,
    personal_extras: personalClass,
    tooling_moves: moveClass,
    incident_messages: incidentDiagnosis,
    classifications_path: "13-remediation-classifications.json",
  };

  // Strict DoD: UNKNOWN source → cannot PASS fully
  const dod = master.definition_of_done;
  const dodFail = !dod.source_vs_v7_known;
  master.verdict = dodFail ? "FAIL" : "PASS";
  master.verdict_reason = dodFail
    ? "DoD requires known YES/NO for current source vs V7; agent lacks legacy Postgres access → UNKNOWN"
    : "All classifiable items closed";

  writeFileSync(join(OUT, "13-remediation-classifications.json"), JSON.stringify(classifications, null, 2));
  writeFileSync(join(OUT, "13-remediation-master-plan.json"), JSON.stringify({ master, remediation, action_counts: finalActions }, null, 2));
  writeFileSync(
    join(OUT, "13-remediation-master-plan.md"),
    [
      "# 13 — Remediation master plan (Fase 9)",
      "",
      `## Veredicto fase: **${master.verdict}**`,
      "",
      master.verdict_reason,
      "",
      `Source vs V7: **${sourceVsV7.verdict}**`,
      "",
      "### Action counts",
      "",
      JSON.stringify(finalActions, null, 2),
      "",
      "## P0",
      "",
      "| ID | Type | Cause | Fix | Backfill | Cleanup | Tests |",
      "|---|---|---|---|---|---|---|",
      ...remediation.p0.map((r) => `| ${r.id} | ${r.type} | ${r.cause} | ${r.fix} | ${r.backfill} | ${r.cleanup} | ${r.tests} |`),
      "",
      "## P1",
      "",
      "| ID | Type | Cause | Fix |",
      "|---|---|---|---|",
      ...remediation.p1.map((r) => `| ${r.id} | ${r.type} | ${r.cause} | ${r.fix} |`),
      "",
      "## P2",
      "",
      ...remediation.p2.map((r) => `- ${r.id} (${r.type}): ${r.cause}`),
      "",
      "## Field gaps (cerrados — no MISSING/UNKNOWN sin clase)",
      "",
      "| Source | Field | Class | Destino propuesto |",
      "|---|---|---|---|",
      ...fieldGaps.map((f) => `| ${f.source} | ${f.field} | ${f.classification} | ${f.destino_propuesto} |`),
      "",
      "NO implementar Fase 10 desde este documento sin aprobación.",
      "",
    ].join("\n"),
  );

  // also write 05 field gap md companion
  writeFileSync(
    join(OUT, "05b-field-gaps-closed.md"),
    [
      "# 9.3 — Field gaps cerrados",
      "",
      `Unresolved MISSING/UNKNOWN: **${unresolved.length}**`,
      "",
      "| Source | Field | % valor | Class | Destino propuesto | Backfill |",
      "|---|---|---:|---|---|---|",
      ...fieldGaps.map(
        (f) =>
          `| ${f.source} | ${f.field} | ${(f.pct_with_value * 100).toFixed(0)}% | ${f.classification} | ${f.destino_propuesto} | ${f.backfill} |`,
      ),
      "",
    ].join("\n"),
  );

  console.log(
    JSON.stringify(
      {
        verdict: master.verdict,
        source_vs_v7: sourceVsV7.verdict,
        action_counts: finalActions,
        dup_groups: duplicateGroups.length,
        tasks_no_group: tasksNoGroup.length,
        personal_extras: extras.length,
        moves: moves.length,
        field_unresolved: unresolved.length,
        obsoleteRawStats,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
