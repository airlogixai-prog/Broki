#!/usr/bin/env node
/**
 * Production hardening — delete ONLY high-confidence test residues.
 * Patterns: Smoke Test Persona, smoke*@example.com, QA Persona Playwright,
 * qa*@example.com (playwright), BAC-SMK / remarks smoke UUID, aerolinea=SMOKE.
 *
 *   node scripts/cleanup-broki-test-residues.mjs           # apply
 *   node scripts/cleanup-broki-test-residues.mjs --dry-run
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");

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

const h = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function rest(method, path, body) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${String(text).slice(0, 300)}`);
  return data;
}

async function all(path) {
  const page = 1000;
  let offset = 0;
  const rows = [];
  for (;;) {
    const sep = path.includes("?") ? "&" : "?";
    const chunk = await rest("GET", `${path}${sep}limit=${page}&offset=${offset}`);
    rows.push(...(chunk || []));
    if (!chunk || chunk.length < page) break;
    offset += page;
  }
  return rows;
}

function isSmokePersonnel(p) {
  const name = String(p.nombre || "");
  const mail = String(p.correo || "").toLowerCase();
  if (/^Smoke Test Persona$/i.test(name)) return true;
  if (/^QA Persona Playwright$/i.test(name)) return true;
  if (/^smoke\d+@example\.com$/i.test(mail)) return true;
  if (/^qa\d+@example\.com$/i.test(mail)) return true;
  if (/^smoke-lead-.+@example\.com$/i.test(mail)) return true;
  return false;
}

async function main() {
  const report = { dry_run: DRY, deleted: {}, skipped: [] };

  const personnel = await all(
    "broki_personnel?select=id,nombre,correo,external_id,source_system",
  );
  const smokePeople = personnel.filter(isSmokePersonnel);
  report.deleted.personnel = smokePeople.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    correo: p.correo,
  }));
  if (!DRY && smokePeople.length) {
    for (const p of smokePeople) {
      await rest("DELETE", `broki_personnel?id=eq.${p.id}`);
    }
  }

  const moves = await all(
    "broki_tooling_movements?select=id,bac_bact,external_id,remarks,avion",
  );
  const smokeMoves = moves.filter((m) =>
    /BAC-SMK|\bsmoke\b|remote-test|\bE2E\b/i.test(
      `${m.bac_bact}|${m.external_id}|${m.remarks}|${m.avion}`,
    ),
  );
  report.deleted.tooling_movements = smokeMoves.map((m) => m.id);
  if (!DRY && smokeMoves.length) {
    for (const m of smokeMoves) {
      await rest("DELETE", `broki_tooling_movements?id=eq.${m.id}`);
    }
  }

  const aircraft = await all("broki_aircraft?select=id,matricula,aerolinea,msn");
  const smokeAc = aircraft.filter(
    (a) =>
      String(a.aerolinea || "").toUpperCase() === "SMOKE" ||
      /^MSN-SMK$/i.test(String(a.msn || "")) ||
      /^EC[0-9a-f]{4}$/i.test(String(a.matricula || "")), // smoke create pattern EC + 4 hex
  );
  // Ambiguous EC#### — only delete if aerolinea SMOKE or msn MSN-SMK
  const acSafe = smokeAc.filter(
    (a) =>
      String(a.aerolinea || "").toUpperCase() === "SMOKE" ||
      /^MSN-SMK$/i.test(String(a.msn || "")),
  );
  report.deleted.aircraft = acSafe.map((a) => ({
    id: a.id,
    matricula: a.matricula,
  }));
  if (!DRY && acSafe.length) {
    for (const a of acSafe) {
      await rest("DELETE", `broki_aircraft?id=eq.${a.id}`);
    }
  }

  let leads = [];
  try {
    leads = await all("broki_marketing_leads?select=id,email,name");
  } catch {
    report.skipped.push("broki_marketing_leads unavailable");
  }
  const smokeLeads = leads.filter((l) =>
    /smoke|remote-test/i.test(`${l.email}|${l.name}`),
  );
  report.deleted.marketing_leads = smokeLeads.map((l) => l.id);
  if (!DRY && smokeLeads.length) {
    for (const l of smokeLeads) {
      await rest("DELETE", `broki_marketing_leads?id=eq.${l.id}`);
    }
  }

  // Verify
  const leftPeople = (await all("broki_personnel?select=id,nombre,correo")).filter(
    isSmokePersonnel,
  );
  const leftMoves = (
    await all("broki_tooling_movements?select=id,bac_bact,remarks,external_id")
  ).filter((m) =>
    /BAC-SMK|\bsmoke\b|remote-test/i.test(`${m.bac_bact}|${m.remarks}|${m.external_id}`),
  );

  report.verify = {
    smoke_personnel_left: leftPeople.length,
    smoke_movements_left: leftMoves.length,
    ok: leftPeople.length === 0 && leftMoves.length === 0,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.verify.ok && !DRY) process.exit(3);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
