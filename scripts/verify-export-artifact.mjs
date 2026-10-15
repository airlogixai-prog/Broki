#!/usr/bin/env node
/**
 * Verify a Broki export ZIP contains no secrets / forbidden paths.
 * Never prints secret values — only path names and pattern class names.
 *
 *   node scripts/verify-export-artifact.mjs [path.zip]
 *   node scripts/verify-export-artifact.mjs --latest
 * Exit: 0 pass, 1 fail, 2 usage
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, createReadStream } from "node:fs";
import { join, dirname, basename } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN_PATH = [
  /^\.secrets\//i,
  /broki-service-secrets\.env$/i,
  /(^|\/)supabase\/\.temp\//i,
  /(^|\/)web\/test-results\//i,
  /(^|\/)web\/playwright-report\//i,
  /(^|\/)coverage\//i,
  /\.zip$/i,
];

function isForbiddenEnvPath(name) {
  if (/(^|\/)\.env\.example$/i.test(name)) return false;
  return /(^|\/)\.env(\.|$)/i.test(name) || /(^|\/)web\/\.env/i.test(name) || /(^|\/)supabase\/\.env/i.test(name);
}

// Only flag opaque assigned values — not env *names* in docs/scripts.
const SECRET_PATTERNS = [
  { name: "jwt_header", re: /eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./ },
  {
    name: "supabase_service_env_assign",
    re: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?(eyJ|sb_secret_)[A-Za-z0-9._\-]{20,}/,
  },
  {
    name: "broki_secret_assign",
    re: /BROKI_(N8N|INTERNAL_FUNCTION|NEXT_SERVER|REMOTE_TEST)_SECRET\s*=\s*["']?[A-Fa-f0-9]{32,}/,
  },
  { name: "openai_key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
];

const SKIP_SCAN_PATH = [
  /\/_tests\//,
  /\/scripts\/(check|generate|rotate|push)-broki/,
  /docs\//,
  /\.md$/i,
];

function latestZip() {
  const zips = readdirSync(ROOT)
    .filter((f) => /^Broki-export-.*\.zip$/i.test(f))
    .map((f) => ({ f, m: existsSync(join(ROOT, f)) ? join(ROOT, f) : f }))
    .sort((a, b) => b.f.localeCompare(a.f));
  return zips[0] ? join(ROOT, zips[0].f) : null;
}

function listZip(zipPath) {
  const out = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8", maxBuffer: 50_000_000 });
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

async function scanZipEntries(zipPath, names) {
  const hits = [];
  // Sample text-ish members only (cap) via unzip -p; skip binaries by extension
  const textish = names.filter((n) =>
    /\.(env|json|ts|tsx|js|mjs|sh|toml|yml|yaml|txt|sql|html)$/i.test(n) ||
    /(^|\/)\.env/i.test(n) ||
    /secret/i.test(n)
  ).slice(0, 400);

  for (const name of textish) {
    if (FORBIDDEN_PATH.some((re) => re.test(name)) || isForbiddenEnvPath(name)) {
      hits.push({ type: "forbidden_path", path: name, pattern: "path" });
      continue;
    }
    if (SKIP_SCAN_PATH.some((re) => re.test(name))) continue;
    let body;
    try {
      body = execFileSync("unzip", ["-p", zipPath, name], {
        encoding: "utf8",
        maxBuffer: 2_000_000,
      });
    } catch {
      continue;
    }
    // Never log body
    for (const { name: pname, re } of SECRET_PATTERNS) {
      if (re.test(body)) {
        hits.push({ type: "secret_pattern", path: name, pattern: pname });
        break;
      }
    }
  }
  return hits;
}

async function main() {
  let zipPath = process.argv[2];
  if (!zipPath || zipPath === "--latest") {
    zipPath = latestZip();
  } else if (!zipPath.startsWith("/")) {
    zipPath = join(ROOT, zipPath);
  }
  if (!zipPath || !existsSync(zipPath)) {
    console.error("usage: node scripts/verify-export-artifact.mjs <zip|--latest>");
    process.exit(2);
  }

  const names = listZip(zipPath);
  const pathHits = names.filter(
    (n) => FORBIDDEN_PATH.some((re) => re.test(n)) || isForbiddenEnvPath(n),
  );
  const patternHits = await scanZipEntries(zipPath, names);

  const report = {
    zip: basename(zipPath),
    entries: names.length,
    forbidden_paths: pathHits,
    secret_pattern_hits: patternHits.map((h) => ({
      path: h.path,
      pattern: h.pattern,
      // no values
    })),
    ok: pathHits.length === 0 && patternHits.filter((h) => h.type === "secret_pattern").length === 0,
  };

  // path hits already fail ok
  if (pathHits.length) report.ok = false;

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
