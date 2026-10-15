#!/usr/bin/env node
/**
 * Read-only entity parity: legacy raw (migration_id) ↔ canonical broki_*.
 * Usage: node scripts/audit-broki-migration-parity.mjs --migration-id=<uuid>
 * Exit: 0 complete, 1 discrepancies, 2 tech error
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/broki/data-audit");
const MID = process.argv.find((a) => a.startsWith("--migration-id="))?.split("=")[1];

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
if (!BASE || !KEY || !MID) {
  console.error("Need URL, KEY, --migration-id=");
  process.exit(2);
}

function h(v) {
  if (v == null) return null;
  return createHash("sha256").update(String(v)).digest("hex").slice(0, 16);
}

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

async function rpc(fn, args = {}) {
  const { body } = await rest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args), headers: { Prefer: "" } });
  return body;
}

async function allPages(pathBase, page = 1000) {
  let offset = 0;
  const rows = [];
  for (;;) {
    const { body } = await rest(`${pathBase}${pathBase.includes("?") ? "&" : "?"}limit=${page}&offset=${offset}`);
    const chunk = body || [];
    rows.push(...chunk);
    if (chunk.length < page) break;
    offset += page;
  }
  return rows;
}

function jtxt(d, keys) {
  for (const k of keys) {
    if (d?.[k] != null && d[k] !== "") return String(d[k]);
  }
  return null;
}

function diff(source, legacyKey, canonicalId, field, leg, can, classification, severity) {
  return {
    source,
    legacy_key: h(legacyKey),
    canonical_id: canonicalId,
    field,
    legacy_value_hash: h(leg),
    canonical_value_hash: can == null ? null : h(can),
    classification,
    severity,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const diffs = [];
  const warnings = [];
  const entities = {};

  const entityCounts = await rpc("broki_audit_entity_counts", { p_migration_id: MID }).catch((e) => {
    warnings.push(`entity_counts_scoped: ${e.message}`);
    return null;
  });
  const entityGlobal = await rpc("broki_audit_entity_counts", {}).catch((e) => {
    warnings.push(`entity_counts_global: ${e.message}`);
    return null;
  });
  const payloadParity = await rpc("broki_audit_raw_payload_parity", {}).catch((e) => {
    warnings.push(`payload_parity: ${e.message}`);
    return null;
  });
  const obsolete = await rpc("broki_audit_obsolete_rows", { p_migration_id: MID }).catch((e) => {
    warnings.push(`obsolete: ${e.message}`);
    return null;
  });
  const dedupCollisions = await rpc("broki_audit_tareas_dedup_collisions", {}).catch((e) => {
    warnings.push(`dedup: ${e.message}`);
    return null;
  });

  // --- PERSONAL ---
  const personalRaw = await allPages(
    `broki_legacy_rows?select=external_id,row_data&source_table=eq.personal&source_system=eq.n8n_postgres_pro&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const personnel = await allPages(
    `broki_personnel?select=id,external_id,nombre,telefono,correo,cod_empleado_aena,n_bac,estado,helper,cat_a,b1,b2,certificador,raw_payload`,
  );
  const persByExt = new Map(personnel.map((p) => [p.external_id, p]));
  let persMissing = 0;
  let persOk = 0;
  const phoneDup = new Map();
  const emailDup = new Map();
  const bacDup = new Map();
  for (const r of personalRaw) {
    const c = persByExt.get(r.external_id);
    if (!c) {
      persMissing++;
      diffs.push(diff("pro.personal", r.external_id, null, "*", null, null, "MISSING", "P0"));
      continue;
    }
    persOk++;
    const d = r.row_data || {};
    const pairs = [
      ["nombre", jtxt(d, ["nombre"]), c.nombre],
      ["telefono", jtxt(d, ["telefono"]), c.telefono],
      ["correo", jtxt(d, ["correo", "email"]), c.correo],
      ["cod_empleado_aena", jtxt(d, ["cod_empleado_aena", "cod_empleado"]), c.cod_empleado_aena],
      ["n_bac", jtxt(d, ["n_bac", "bac"]), c.n_bac],
    ];
    for (const [f, leg, can] of pairs) {
      if (leg && (can == null || String(can).trim() === "")) {
        diffs.push(diff("pro.personal", r.external_id, c.id, f, leg, can, "MISSING", "P0"));
      }
    }
    if (c.telefono) phoneDup.set(c.telefono, (phoneDup.get(c.telefono) || 0) + 1);
    if (c.correo) emailDup.set(c.correo, (emailDup.get(c.correo) || 0) + 1);
    if (c.n_bac) bacDup.set(c.n_bac, (bacDup.get(c.n_bac) || 0) + 1);
  }
  const rawPersExt = new Set(personalRaw.map((r) => r.external_id));
  const canonOnlyPers = personnel.filter((p) => !rawPersExt.has(p.external_id));
  entities.personal = {
    raw: personalRaw.length,
    canonical: personnel.length,
    reconciled: persOk,
    missing_canonical: persMissing,
    canonical_without_this_migration_raw: canonOnlyPers.length,
    dup_phones: [...phoneDup.entries()].filter(([, n]) => n > 1).length,
    dup_emails: [...emailDup.entries()].filter(([, n]) => n > 1).length,
    dup_bac: [...bacDup.entries()].filter(([, n]) => n > 1).length,
  };

  // --- ASSETS (inventario/furgonetas/gse) ---
  const assetTables = ["inventario", "furgonetas", "gse"];
  const assets = await allPages(
    `broki_assets?select=id,source_system,source_table,external_id,identifier,descripcion,nombre_equipo,matricula,estado,current_worker_text,combustible,adblue,raw_payload`,
  );
  const assetByKey = new Map(assets.map((a) => [`${a.source_system}|${a.source_table}|${a.external_id}`, a]));
  let assetMissing = 0;
  let assetOk = 0;
  let trabajadoresLost = 0;
  let vehiculoLost = 0;
  for (const st of assetTables) {
    const raw = await allPages(
      `broki_legacy_rows?select=external_id,row_data,source_system&source_table=eq.${st}&source_system=eq.n8n_postgres_pro&last_migration_id=eq.${encodeURIComponent(MID)}`,
    );
    for (const r of raw) {
      const key = `${r.source_system}|pro.${st}|${r.external_id}`;
      const c = assetByKey.get(key);
      if (!c) {
        assetMissing++;
        diffs.push(diff(`pro.${st}`, r.external_id, null, "*", null, null, "MISSING", "P0"));
        continue;
      }
      assetOk++;
      const d = r.row_data || {};
      const trab = jtxt(d, ["trabajadores", "trabajador"]);
      if (trab && !c.current_worker_text) {
        trabajadoresLost++;
        diffs.push(diff(`pro.${st}`, r.external_id, c.id, "trabajadores", trab, c.current_worker_text, "MISSING", "P0"));
      }
      const veh = jtxt(d, ["vehiculo"]);
      if (veh && !(c.descripcion || c.nombre_equipo || c.raw_payload?.vehiculo === veh)) {
        // vehiculo not a canonical column on assets
        if (!c.descripcion && !c.nombre_equipo) {
          vehiculoLost++;
          diffs.push(diff(`pro.${st}`, r.external_id, c.id, "vehiculo", veh, null, "MISSING", "P0"));
        } else if (veh && !String(c.descripcion || "").includes(veh) && !String(c.nombre_equipo || "").includes(veh)) {
          // still in raw_payload only — operational gap if UI uses descripcion only without fallback
          diffs.push(diff(`pro.${st}`, r.external_id, c.id, "vehiculo", veh, c.descripcion, "RAW_ONLY_BUT_OPERATIONAL", "P1"));
        }
      }
    }
  }
  const idDup = new Map();
  for (const a of assets) {
    if (a.identifier) idDup.set(a.identifier, (idDup.get(a.identifier) || 0) + 1);
  }
  entities.assets = {
    reconciled: assetOk,
    missing_canonical: assetMissing,
    trabajadores_lost: trabajadoresLost,
    vehiculo_issues: vehiculoLost,
    identifier_dups: [...idDup.entries()].filter(([, n]) => n > 1).length,
  };

  // --- AIRCRAFT ---
  const aviRaw = await allPages(
    `broki_legacy_rows?select=external_id,row_data&source_table=eq.aviones&source_system=eq.n8n_postgres_pro&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const aircraft = await allPages(
    `broki_aircraft?select=id,external_id,matricula,modelo,msn,motor,aerolinea,estado,raw_payload`,
  );
  const acByExt = new Map(aircraft.map((a) => [a.external_id, a]));
  let acMissing = 0;
  let msnLost = 0;
  let motorLost = 0;
  for (const r of aviRaw) {
    const c = acByExt.get(r.external_id);
    if (!c) {
      acMissing++;
      diffs.push(diff("pro.aviones", r.external_id, null, "*", null, null, "MISSING", "P0"));
      continue;
    }
    const d = r.row_data || {};
    const msn = jtxt(d, ["msn"]);
    const motor = jtxt(d, ["motor"]);
    const mat = jtxt(d, ["matricula"]);
    if (msn && !c.msn && c.matricula === msn && mat && mat !== msn) {
      msnLost++;
      diffs.push(diff("pro.aviones", r.external_id, c.id, "msn", msn, c.msn, "MISSING", "P0"));
    } else if (msn && !c.msn && mat !== msn) {
      // msn collapsed into matricula incorrectly
      if (c.matricula === msn) {
        msnLost++;
        diffs.push(diff("pro.aviones", r.external_id, c.id, "msn", msn, c.msn, "CONCEPT_MIX", "P0"));
      } else if (!c.msn) {
        msnLost++;
        diffs.push(diff("pro.aviones", r.external_id, c.id, "msn", msn, c.msn, "MISSING", "P0"));
      }
    } else if (msn && !c.msn) {
      msnLost++;
      diffs.push(diff("pro.aviones", r.external_id, c.id, "msn", msn, null, "MISSING", "P0"));
    }
    if (motor && !c.motor) {
      motorLost++;
      diffs.push(diff("pro.aviones", r.external_id, c.id, "motor", motor, c.motor, "MISSING", "P0"));
    }
  }
  entities.aircraft = { raw: aviRaw.length, canonical: aircraft.length, missing: acMissing, msn_lost: msnLost, motor_lost: motorLost };

  // --- INCIDENTS ---
  const incRaw = await allPages(
    `broki_legacy_rows?select=external_id,row_data&source_table=eq.incidencias&source_system=eq.n8n_postgres_pro&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const incidents = await allPages(`broki_incidents?select=id,external_id,asset_id,descripcion,estado,trabajador_text`);
  const incByExt = new Map(incidents.map((i) => [i.external_id, i]));
  let incMissing = 0;
  for (const r of incRaw) {
    if (!incByExt.get(r.external_id)) {
      incMissing++;
      diffs.push(diff("pro.incidencias", r.external_id, null, "*", null, null, "MISSING", "P0"));
    }
  }
  entities.incidents = {
    raw: incRaw.length,
    canonical: incidents.length,
    missing: incMissing,
    orphan_no_asset: incidents.filter((i) => !i.asset_id).length,
  };

  // --- PLANNER ---
  const grpRaw = await allPages(
    `broki_legacy_rows?select=external_id,row_data&source_table=eq.grupo_trabajo&source_system=eq.n8n_postgres_pro&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const groups = await allPages(
    `broki_planner_groups?select=id,external_id,vehiculo,hora_salida,hora_llegada,aircraft_id,responsable`,
  );
  const grpByExt = new Map(groups.map((g) => [g.external_id, g]));
  let grpMissing = 0;
  for (const r of grpRaw) {
    if (!grpByExt.get(r.external_id)) {
      grpMissing++;
      diffs.push(diff("pro.grupo_trabajo", r.external_id, null, "*", null, null, "MISSING", "P0"));
    }
  }
  const tasks = await allPages(
    `broki_planner_tasks?select=id,external_id,group_id,matricula_avion,codigo,fecha,raw_payload`,
  );
  const groupIds = new Set(groups.map((g) => g.id));
  const tasksNoGroup = tasks.filter((t) => !t.group_id || !groupIds.has(t.group_id));
  for (const t of tasksNoGroup.slice(0, 50)) {
    diffs.push(diff("pro.tareas", t.external_id, t.id, "group_id", t.raw_payload?.id_grupo_trabajo, t.group_id, "MISSING", "P0"));
  }
  entities.planner = {
    groups_raw: grpRaw.length,
    groups_canonical: groups.length,
    groups_missing: grpMissing,
    tasks: tasks.length,
    tasks_without_resolvable_group: tasksNoGroup.length,
    group_link_column: "group_id",
  };

  // --- TOOLING ---
  const toolRaw = await allPages(
    `broki_legacy_rows?select=external_id&source_table=eq.tooling&source_system=eq.n8n_postgres_pro&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const tools = await allPages(`broki_tooling_catalog?select=id,external_id,bac_bact`);
  const toolByExt = new Map(tools.map((t) => [t.external_id, t]));
  let toolMissing = 0;
  for (const r of toolRaw) {
    if (!toolByExt.get(r.external_id)) {
      toolMissing++;
      diffs.push(diff("pro.tooling", r.external_id, null, "*", null, null, "MISSING", "P0"));
    }
  }
  const moves = await allPages(`broki_tooling_movements?select=id,external_id,tool_id,bac_bact,date_in,date_out`);
  const openByBac = new Map();
  for (const m of moves) {
    if (!m.date_in) {
      const k = m.bac_bact || "?";
      openByBac.set(k, (openByBac.get(k) || 0) + 1);
    }
  }
  entities.tooling = {
    catalog_raw: toolRaw.length,
    catalog_canonical: tools.length,
    catalog_missing: toolMissing,
    movements: moves.length,
    movements_no_tool: moves.filter((m) => !m.tool_id).length,
    open_bac_dups: [...openByBac.entries()].filter(([, n]) => n > 1),
  };

  // --- NITRO ---
  const nitroRaw = await allPages(
    `broki_legacy_rows?select=external_id,row_data&source_table=eq.nitro_stock&last_migration_id=eq.${encodeURIComponent(MID)}`,
  );
  const nitro = await allPages(`broki_nitro_stock?select=*`);
  entities.nitro = { raw: nitroRaw.length, canonical: nitro.length };

  // --- COMMS / CHAT / UNKNOWN ---
  for (const [st, table] of [
    ["registro_comunicaciones", "broki_communications"],
    ["n8n_chat_histories", "broki_chat_histories"],
    ["no_existe_telefono", "broki_unknown_contacts"],
  ]) {
    const raw = await allPages(
      `broki_legacy_rows?select=external_id&source_table=eq.${st}&source_system=eq.n8n_postgres_pro&last_migration_id=eq.${encodeURIComponent(MID)}`,
    );
    const can = await allPages(`${table}?select=id,external_id`);
    const set = new Set(can.map((c) => c.external_id));
    let miss = 0;
    for (const r of raw) {
      if (!set.has(r.external_id)) {
        miss++;
        diffs.push(diff(`pro.${st}`, r.external_id, null, "*", null, null, "MISSING", "P0"));
      }
    }
    entities[st] = { raw: raw.length, canonical: can.length, missing: miss };
  }

  // scoped entity count mismatches
  if (Array.isArray(entityCounts)) {
    for (const row of entityCounts) {
      if (row.status && row.status !== "OK" && row.status !== "RAW_ONLY") {
        diffs.push({
          source: row.source_table || row.entity,
          legacy_key: null,
          canonical_id: null,
          field: "entity_count",
          legacy_value_hash: h(row.raw_count),
          canonical_value_hash: h(row.canonical_count),
          classification: row.status,
          severity: "P0",
          detail: row,
        });
      }
    }
  }

  const p0 = diffs.filter((d) => d.severity === "P0").length;
  const report = {
    migration_id: MID,
    generated_at: new Date().toISOString(),
    entity_counts_scoped: entityCounts,
    entity_counts_global: entityGlobal,
    payload_parity_drifts: Array.isArray(payloadParity) ? payloadParity.length : payloadParity,
    obsolete_rows: Array.isArray(obsolete) ? obsolete.length : obsolete,
    tareas_dedup_collisions: Array.isArray(dedupCollisions) ? dedupCollisions.length : dedupCollisions,
    entities,
    diffs_total: diffs.length,
    diffs_p0: p0,
    diffs_sample: diffs.slice(0, 200),
    warnings,
    verdict: p0 === 0 && diffs.length === 0 ? "PASS" : "FAIL",
  };

  writeFileSync(join(OUT, "06-entity-reconciliation.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Fase 5 — Reconciliación entidad",
    "",
    `- migration_id: \`${MID}\``,
    `- veredicto: **${report.verdict}**`,
    `- diffs: ${diffs.length} (P0: ${p0})`,
    `- obsolete rows: ${report.obsolete_rows}`,
    `- payload drifts: ${report.payload_parity_drifts}`,
    `- tareas dedup collisions: ${report.tareas_dedup_collisions}`,
    "",
    "## Por entidad",
    "",
    "```json",
    JSON.stringify(entities, null, 2),
    "```",
    "",
    "## Warnings",
    "",
    ...warnings.map((w) => `- ${w}`),
    "",
  ].join("\n");
  writeFileSync(join(OUT, "06-entity-reconciliation.md"), md);

  console.log(JSON.stringify({
    verdict: report.verdict,
    diffs: diffs.length,
    p0,
    entities: Object.fromEntries(Object.entries(entities).map(([k, v]) => [k, v])),
  }, null, 2));

  process.exit(report.verdict === "PASS" ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
