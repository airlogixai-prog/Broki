#!/usr/bin/env node
/**
 * Fase 11.1 — dry-run plan for canonical cleanup.
 * Does NOT mutate. Writes docs/broki/data-audit/15-canonical-cleanup-plan.{json,md}
 *
 *   node scripts/plan-broki-canonical-cleanup.mjs --migration-id=<uuid>
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
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

const BASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
if (!BASE || !KEY) {
  console.error("missing URL/KEY");
  process.exit(2);
}

async function rest(path) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact" },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${res.status} ${path}: ${String(text).slice(0, 250)}`);
  return body || [];
}

async function allPages(pathBase) {
  const page = 1000;
  let offset = 0;
  const rows = [];
  for (;;) {
    const sep = pathBase.includes("?") ? "&" : "?";
    const chunk = await rest(`${pathBase}${sep}limit=${page}&offset=${offset}`);
    rows.push(...chunk);
    if (chunk.length < page) break;
    offset += page;
  }
  return rows;
}

const KIND_RANK = { van: 3, gse: 2, inventory: 1, other: 0 };

function isV7(mid) {
  return mid === MID;
}

function smokeBlob(s) {
  return /BAC-SMK|\bSMOKE\b|\bE2E\b|remote-test/i.test(String(s || ""));
}

/** Prefer human code (BRK-*, G4-6) over numeric scheme leftovers. */
function logicalKey(a) {
  const id = String(a.identifier || "").trim();
  const ext = String(a.external_id || "").trim();
  const looksCode = (s) => /[A-Za-z-]/.test(s) && !/^\d+$/.test(s);
  if (looksCode(id)) return id.toUpperCase();
  if (looksCode(ext)) return ext.toUpperCase();
  return (id || ext).toUpperCase();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const actions = [];
  const push = (a) => actions.push(a);

  const assets = await allPages(
    "broki_assets?select=id,external_id,legacy_id,identifier,source_system,source_table,asset_kind,estado,parking,avion_text,current_worker_text,current_worker_id,combustible,adblue,nitrogeno_1,nitrogeno_2,nitrogeno_3,nitrogeno_4,notas,descripcion,nombre_equipo,matricula,familia,plazas,ubicacion_habitual,raw_payload,created_at,updated_at",
  );
  const rawAsset = await allPages(
    `broki_legacy_rows?select=external_id,source_table,last_migration_id&source_table=in.(inventario,furgonetas,gse)`,
  );
  const midMap = new Map(
    rawAsset.map((r) => [`${r.source_table}|${r.external_id}`, r.last_migration_id]),
  );

  const byIdent = new Map();
  for (const a of assets) {
    const key = logicalKey(a);
    if (!key) {
      push({
        entity_type: "asset",
        canonical_id: a.id,
        action: "MANUAL_REVIEW",
        reason: "missing_identifier",
        evidence: [`ext=${a.external_id}`, `st=${a.source_table}`],
      });
      continue;
    }
    const st = (a.source_table || "").replace(/^pro\./, "");
    const mid = midMap.get(`${st}|${a.external_id}`) ?? null;
    const row = { ...a, mid, logical_key: key };
    if (!byIdent.has(key)) byIdent.set(key, []);
    byIdent.get(key).push(row);
  }

  for (const [key, list] of byIdent) {
    if (list.length === 1) {
      const only = list[0];
      push({
        entity_type: "asset",
        canonical_id: only.id,
        action: isV7(only.mid) ? "KEEP" : only.mid == null ? "DELETE_CANDIDATE" : "MANUAL_REVIEW",
        reason: isV7(only.mid) ? "singleton_v7" : "singleton_non_v7",
        logical_key: key,
        evidence: [`ext=${only.external_id}`, `mid=${only.mid}`, `kind=${only.asset_kind}`],
      });
      continue;
    }

    // Prefer V7 + operational kind
    const ranked = [...list].sort((a, b) => {
      const va = isV7(a.mid) ? 1 : 0;
      const vb = isV7(b.mid) ? 1 : 0;
      if (vb !== va) return vb - va;
      return (KIND_RANK[b.asset_kind] || 0) - (KIND_RANK[a.asset_kind] || 0);
    });
    const keeper = ranked[0];
    const donors = ranked.slice(1);

    push({
      entity_type: "asset",
      canonical_id: keeper.id,
      action: "KEEP",
      reason: "logical_keeper",
      logical_key: key,
      evidence: [
        `ext=${keeper.external_id}`,
        `kind=${keeper.asset_kind}`,
        `mid=${keeper.mid}`,
        `donors=${donors.length}`,
      ],
    });

    for (const d of donors) {
      push({
        entity_type: "asset",
        canonical_id: d.id,
        action: "MERGE",
        reason: isV7(d.mid) && d.asset_kind !== keeper.asset_kind
          ? "cross_source_inventory_vs_operational"
          : "external_id_scheme_zombie",
        logical_key: key,
        merge_into: keeper.id,
        evidence: [
          `ext=${d.external_id}`,
          `kind=${d.asset_kind}`,
          `mid=${d.mid}`,
          `→${keeper.id}`,
        ],
      });
    }
  }

  // Personnel
  const personnel = await allPages(
    "broki_personnel?select=id,external_id,source_system,source_table,nombre,created_at,raw_payload",
  );
  const persRaw = await allPages(
    `broki_legacy_rows?select=external_id&source_table=eq.personal&source_system=eq.n8n_postgres_pro&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const persV7 = new Set(persRaw.map((r) => r.external_id));
  for (const p of personnel) {
    if (persV7.has(p.external_id)) {
      push({
        entity_type: "personnel",
        canonical_id: p.id,
        action: "KEEP",
        reason: "v7_raw",
        evidence: [`ext=${p.external_id}`],
      });
      continue;
    }
    if (/public_registration|registrobroki|broki/i.test(`${p.source_system}|${p.source_table}`)) {
      push({
        entity_type: "personnel",
        canonical_id: p.id,
        action: "KEEP",
        reason: "web_registration",
        evidence: [`src=${p.source_system}/${p.source_table}`],
      });
      continue;
    }
    if (smokeBlob(p.nombre) || smokeBlob(JSON.stringify(p.raw_payload))) {
      push({
        entity_type: "personnel",
        canonical_id: p.id,
        action: "DELETE_CANDIDATE",
        reason: "smoke",
        evidence: [`ext=${p.external_id}`],
      });
      continue;
    }
    push({
      entity_type: "personnel",
      canonical_id: p.id,
      action: "MANUAL_REVIEW",
      reason: "not_in_v7_unknown_origin",
      evidence: [`ext=${p.external_id}`, `src=${p.source_system}`],
    });
  }

  // Planner
  const groups = await allPages(
    "broki_planner_groups?select=id,external_id,legacy_id,created_at",
  );
  const grpRaw = await allPages(
    `broki_legacy_rows?select=external_id&source_table=eq.grupo_trabajo&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const grpV7 = new Set(grpRaw.map((r) => r.external_id));
  for (const g of groups) {
    if (grpV7.has(g.external_id)) {
      push({
        entity_type: "planner_group",
        canonical_id: g.id,
        action: "KEEP",
        reason: "v7_raw",
        evidence: [`ext=${g.external_id}`],
      });
    } else {
      push({
        entity_type: "planner_group",
        canonical_id: g.id,
        action: "DELETE_CANDIDATE",
        reason: "orphan_group_zombie",
        evidence: [`ext=${g.external_id}`],
      });
    }
  }

  const tasks = await allPages(
    "broki_planner_tasks?select=id,external_id,group_id,raw_payload,codigo,descripcion",
  );
  const taskRaw = await allPages(
    `broki_legacy_rows?select=external_id,row_data&source_table=eq.tareas&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const taskV7 = new Set(taskRaw.map((r) => r.external_id));
  for (const t of tasks) {
    if (taskV7.has(t.external_id)) {
      push({
        entity_type: "planner_task",
        canonical_id: t.id,
        action: "KEEP",
        reason: t.group_id ? "v7_linked" : "v7_source_group_null",
        evidence: [`ext=${t.external_id}`, `group_id=${t.group_id}`],
      });
    } else {
      push({
        entity_type: "planner_task",
        canonical_id: t.id,
        action: "DELETE_CANDIDATE",
        reason: "orphan_task_zombie",
        evidence: [`ext=${t.external_id}`],
      });
    }
  }

  // Tooling movements
  const moves = await allPages(
    "broki_tooling_movements?select=id,external_id,bac_bact,tool_id,date_in,date_out,remarks",
  );
  const tools = await allPages("broki_tooling_catalog?select=id,bac_bact");
  const toolByBac = new Map(
    tools
      .filter((t) => t.bac_bact)
      .map((t) => [String(t.bac_bact).toUpperCase(), t.id]),
  );
  for (const m of moves) {
    const bac = String(m.bac_bact || "").toUpperCase();
    if (smokeBlob(m.bac_bact) || smokeBlob(m.external_id) || smokeBlob(m.remarks)) {
      push({
        entity_type: "tooling_movement",
        canonical_id: m.id,
        action: "DELETE_CANDIDATE",
        reason: "smoke",
        evidence: [`bac=${m.bac_bact}`, `ext=${m.external_id}`],
      });
      continue;
    }
    if (!m.tool_id && toolByBac.has(bac)) {
      push({
        entity_type: "tooling_movement",
        canonical_id: m.id,
        action: "REBUILD",
        reason: "broken_relation_link_tool_id",
        merge_into: toolByBac.get(bac),
        evidence: [`bac=${m.bac_bact}`, `tool=${toolByBac.get(bac)}`],
      });
      continue;
    }
    push({
      entity_type: "tooling_movement",
      canonical_id: m.id,
      action: "KEEP",
      reason: m.tool_id ? "legacy_valid" : "unknown_tool_manual",
      evidence: [`bac=${m.bac_bact}`, `tool_id=${m.tool_id}`],
    });
  }

  // Open checkout dups
  const openByBac = new Map();
  for (const m of moves) {
    if (m.date_in == null && m.bac_bact) {
      const k = String(m.bac_bact).toUpperCase();
      if (!openByBac.has(k)) openByBac.set(k, []);
      openByBac.get(k).push(m);
    }
  }
  for (const [bac, list] of openByBac) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) =>
      String(b.date_out || "").localeCompare(String(a.date_out || "")),
    );
    push({
      entity_type: "tooling_movement",
      canonical_id: sorted[0].id,
      action: "KEEP",
      reason: "open_checkout_keeper",
      evidence: [`bac=${bac}`, `opens=${list.length}`],
    });
    for (const d of sorted.slice(1)) {
      push({
        entity_type: "tooling_movement",
        canonical_id: d.id,
        action: "DELETE_CANDIDATE",
        reason: "duplicate_open_checkout",
        evidence: [`bac=${bac}`, `keeper=${sorted[0].id}`],
      });
    }
  }

  const counts = actions.reduce((a, x) => {
    a[x.action] = (a[x.action] || 0) + 1;
    return a;
  }, {});

  const plan = {
    migration_id: MID,
    generated_at: new Date().toISOString(),
    dry_run: true,
    counts,
    actions,
    strategy: {
      assets:
        "logical_key=upper(identifier); keeper=V7 preferred then kind van>gse>inventory; donors MERGE then DELETE; reassign FKs; alias donors",
      personnel: "KEEP v7 + web_registration; no blind deletes",
      planner: "DELETE groups/tasks not in V7 raw; KEEP v7 tasks even if group_id null",
      tooling: "DELETE smoke; REBUILD tool_id; enforce one open checkout/BAC",
      raw: "broki_legacy_rows untouched",
    },
  };

  writeFileSync(join(OUT, "15-canonical-cleanup-plan.json"), JSON.stringify(plan, null, 2));
  writeFileSync(
    join(OUT, "15-canonical-cleanup-plan.md"),
    [
      "# 15 — Canonical cleanup plan (dry-run)",
      "",
      `migration_id: \`${MID}\``,
      "",
      "## Counts",
      "",
      "```json",
      JSON.stringify(counts, null, 2),
      "```",
      "",
      "## Strategy",
      "",
      ...Object.entries(plan.strategy).map(([k, v]) => `- **${k}**: ${v}`),
      "",
      `Total actions: ${actions.length}`,
      "",
      "No mutations executed by this script.",
      "",
    ].join("\n"),
  );

  console.log(JSON.stringify({ counts, total: actions.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
