#!/usr/bin/env node
/**
 * Read-only legacy field inventory for one migration_id.
 * Usage: node scripts/audit-broki-legacy-fields.mjs --migration-id=<uuid>
 * Exit: 0 ok, 1 inconsistent, 2 config
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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
const MID = process.argv.find((a) => a.startsWith("--migration-id="))?.split("=")[1];
if (!BASE || !KEY) {
  console.error("config error: missing SUPABASE URL/KEY");
  process.exit(2);
}
if (!MID) {
  console.error("usage: --migration-id=<uuid>");
  process.exit(2);
}

const SENSITIVE = /mail|correo|phone|telefono|tel|nombre|name|mensaje|message|dni|nif/i;

function redact(key, val) {
  if (val == null) return null;
  const s = typeof val === "string" ? val : JSON.stringify(val);
  if (SENSITIVE.test(key)) {
    return `redacted:${createHash("sha256").update(s).digest("hex").slice(0, 12)}`;
  }
  if (s.length > 80) return `${s.slice(0, 40)}…`;
  return val;
}

function jsonType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function normalizeKey(k) {
  return String(k).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[\s_-]+/g, "");
}

async function rest(path) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : [];
}

async function fetchAll(filter) {
  const page = 1000;
  let offset = 0;
  const all = [];
  for (;;) {
    const chunk = await rest(
      `broki_legacy_rows?select=source_system,source_schema,source_table,row_data&last_migration_id=eq.${encodeURIComponent(MID)}&${filter}&order=id.asc&limit=${page}&offset=${offset}`,
    );
    all.push(...chunk);
    if (chunk.length < page) break;
    offset += page;
  }
  return all;
}

async function main() {
  const snaps = await rest(
    `broki_legacy_table_snapshots?select=source_system,source_schema,source_table,imported_rows,metadata&metadata->>migration_id=eq.${encodeURIComponent(MID)}&limit=200`,
  );
  if (!snaps.length) {
    console.error("no snapshots for migration");
    process.exit(1);
  }

  const bySource = {};
  const watch = [
    "trabajador", "trabajadores", "vehiculo", "descripcion", "nombre_equipo",
    "matricula", "msn", "modelo", "motor", "aerolinea",
    "hora_salida", "hora_llegada", "fecha", "id_grupo_trabajo",
    "cantida_de_botellas_llenas", "cantidad_de_botellas_llenas", "cantidad_de_botellas_vacias",
    "correo", "email", "cod_empleado", "cod_empleado_aena", "registrado", "estado", "certificacion",
  ];
  const watchHits = {};

  for (const s of snaps) {
    const parts = [
      `source_system=eq.${encodeURIComponent(s.source_system)}`,
      `source_table=eq.${encodeURIComponent(s.source_table)}`,
    ];
    if (s.source_schema == null) parts.push("source_schema=is.null");
    else parts.push(`source_schema=eq.${encodeURIComponent(s.source_schema)}`);
    const rows = await fetchAll(parts.join("&"));
    const key = `${s.source_system}|${s.source_schema ?? ""}|${s.source_table}`;
    const fields = {};
    for (const row of rows) {
      const data = row.row_data;
      if (!data || typeof data !== "object" || Array.isArray(data)) continue;
      for (const [k, v] of Object.entries(data)) {
        if (!fields[k]) {
          fields[k] = {
            present: 0,
            with_value: 0,
            nullish: 0,
            types: {},
            distinct: new Set(),
            examples: [],
            min_len: null,
            max_len: null,
          };
        }
        const f = fields[k];
        f.present++;
        const empty = v === null || v === undefined || v === "" || v === "null" || v === "undefined" || v === "N/A" || v === "-";
        if (empty) f.nullish++;
        else f.with_value++;
        const t = jsonType(v);
        f.types[t] = (f.types[t] || 0) + 1;
        if (f.distinct.size < 50 && !empty) {
          const h = createHash("sha256").update(String(v)).digest("hex").slice(0, 16);
          f.distinct.add(h);
        }
        if (f.examples.length < 3 && !empty) f.examples.push(redact(k, v));
        if (typeof v === "string") {
          f.min_len = f.min_len == null ? v.length : Math.min(f.min_len, v.length);
          f.max_len = f.max_len == null ? v.length : Math.max(f.max_len, v.length);
        }
        const nk = normalizeKey(k);
        for (const w of watch) {
          if (nk === normalizeKey(w) || nk.includes(normalizeKey(w))) {
            watchHits[w] = watchHits[w] || new Set();
            watchHits[w].add(`${key}::${k}`);
          }
        }
      }
    }

    // variant clusters within source
    const normMap = {};
    for (const k of Object.keys(fields)) {
      const n = normalizeKey(k);
      (normMap[n] ||= []).push(k);
    }
    const variants = Object.entries(normMap).filter(([, arr]) => arr.length > 1);

    bySource[key] = {
      row_count: rows.length,
      expected: s.imported_rows,
      field_count: Object.keys(fields).length,
      fields: Object.fromEntries(
        Object.entries(fields).map(([k, f]) => [
          k,
          {
            present: f.present,
            with_value: f.with_value,
            nullish: f.nullish,
            types: f.types,
            distinct_approx: f.distinct.size,
            examples_redacted: f.examples,
            min_len: f.min_len,
            max_len: f.max_len,
          },
        ]),
      ),
      variant_clusters: variants.map(([n, arr]) => ({ normalized: n, keys: arr })),
    };
  }

  const allKeys = new Set();
  for (const src of Object.values(bySource)) {
    for (const k of Object.keys(src.fields)) allKeys.add(k);
  }

  const inventory = {
    migration_id: MID,
    generated_at: new Date().toISOString(),
    unique_attributes: allKeys.size,
    sources: Object.keys(bySource).length,
    by_source: bySource,
    watchlist_hits: Object.fromEntries(
      Object.entries(watchHits).map(([k, set]) => [k, [...set]]),
    ),
  };

  mkdirSync(join(ROOT, "config/broki"), { recursive: true });
  mkdirSync(join(ROOT, "docs/broki/data-audit"), { recursive: true });
  writeFileSync(join(ROOT, "config/broki/generated-legacy-field-inventory.json"), JSON.stringify(inventory, null, 2));

  const md = [
    "# Fase 3 — Inventario de atributos legacy",
    "",
    `- migration_id: \`${MID}\``,
    `- atributos únicos (unión keys): **${allKeys.size}**`,
    `- fuentes: ${Object.keys(bySource).length}`,
    "",
    "## Por fuente",
    "",
    "| Fuente | Filas | Atributos |",
    "|---|---:|---:|",
    ...Object.entries(bySource).map(([k, v]) => `| ${k} | ${v.row_count} | ${v.field_count} |`),
    "",
    "## Watchlist (variantes)",
    "",
    ...Object.entries(inventory.watchlist_hits).map(([k, hits]) =>
      hits.length ? `- **${k}**: ${hits.join(", ")}` : `- **${k}**: (no encontrado)`
    ),
    "",
    "Artefacto: `config/broki/generated-legacy-field-inventory.json`",
    "",
  ].join("\n");
  writeFileSync(join(ROOT, "docs/broki/data-audit/04-legacy-field-inventory.md"), md);

  console.log(JSON.stringify({
    unique_attributes: allKeys.size,
    sources: Object.keys(bySource).length,
    watchlist_keys_hit: Object.values(watchHits).filter((s) => s.size).length,
  }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
