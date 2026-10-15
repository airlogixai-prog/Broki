#!/usr/bin/env node
/**
 * Fail if supabase/functions/* dirs are missing from function-manifest.json groups.
 *   node scripts/verify-function-manifest.mjs
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FN_DIR = join(ROOT, "supabase/functions");
const MANIFEST = join(ROOT, "config/broki/function-manifest.json");

const dirs = readdirSync(FN_DIR).filter((n) => {
  if (n.startsWith("_")) return false;
  return statSync(join(FN_DIR, n)).isDirectory() && existsSync(join(FN_DIR, n, "index.ts"));
});

const man = JSON.parse(readFileSync(MANIFEST, "utf8"));
const classified = new Set();
for (const list of Object.values(man.groups || {})) {
  for (const name of list) classified.add(name);
}

const missing = dirs.filter((d) => !classified.has(d));
const phantom = [...classified].filter((n) => !dirs.includes(n));

const report = {
  functions_on_disk: dirs.sort(),
  missing_from_manifest: missing,
  phantom_in_manifest: phantom,
  ok: missing.length === 0 && phantom.length === 0,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
