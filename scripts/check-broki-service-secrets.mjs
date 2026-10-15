#!/usr/bin/env node
/**
 * Validate .secrets/broki-service-secrets.env without printing values.
 */
import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SECRETS_DIR = join(ROOT, ".secrets");
const SECRETS_FILE = join(SECRETS_DIR, "broki-service-secrets.env");

const REQUIRED = [
  "BROKI_N8N_SECRET",
  "BROKI_INTERNAL_FUNCTION_SECRET",
  "BROKI_NEXT_SERVER_SECRET",
  "BROKI_REMOTE_TEST_SECRET",
];

const MIN_LEN = 32;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

let failures = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failures++;
}
function pass(msg) {
  console.log(`ok  : ${msg}`);
}

function fileExists(p) {
  try {
    accessSync(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// --- File existence ---
if (!fileExists(SECRETS_FILE)) {
  console.error("FAIL: secrets file not found. Run: npm run secrets:generate");
  process.exit(1);
}

// --- Directory permissions ---
try {
  const dStat = statSync(SECRETS_DIR);
  if ((dStat.mode & 0o777) !== 0o700) {
    fail(`directory permissions not 0700 (got ${(dStat.mode & 0o777).toString(8)})`);
  } else {
    pass("directory permissions 0700");
  }
} catch {
  fail("cannot stat secrets directory");
}

// --- File permissions ---
{
  const fStat = statSync(SECRETS_FILE);
  if ((fStat.mode & 0o777) !== 0o600) {
    fail(`file permissions not 0600 (got ${(fStat.mode & 0o777).toString(8)})`);
  } else {
    pass("file permissions 0600");
  }
}

// --- Parse and validate values ---
const raw = readFileSync(SECRETS_FILE, "utf8");
const parsed = {};
for (const line of raw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq < 1) continue;
  parsed[t.slice(0, eq)] = t.slice(eq + 1);
}

const values = [];
for (const name of REQUIRED) {
  const val = parsed[name];
  if (!val) {
    fail(`missing ${name}`);
    continue;
  }
  if (val.length < MIN_LEN) {
    fail(`${name} too short (${val.length} chars, min ${MIN_LEN})`);
  } else {
    pass(`${name} length ok`);
  }
  if (!BASE64URL_RE.test(val)) {
    fail(`${name} not valid base64url`);
  } else {
    pass(`${name} base64url format ok`);
  }
  values.push(val);
}

// --- All distinct ---
const uniqueVals = new Set(values);
if (uniqueVals.size !== values.length) {
  fail("duplicate secret values detected — regenerate");
} else if (values.length === REQUIRED.length) {
  pass("all 4 secrets are distinct");
}

// --- Git ignore ---
try {
  const result = execSync(`git check-ignore -v "${SECRETS_FILE}"`, {
    cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  }).trim();
  if (result) {
    pass("secrets file is gitignored");
  } else {
    fail("secrets file is NOT gitignored");
  }
} catch {
  fail("secrets file is NOT gitignored (not in .gitignore or not a git repo)");
}

// --- Nothing staged ---
try {
  const staged = execSync("git diff --cached --name-only", { cwd: ROOT, encoding: "utf8" });
  if (/\.secrets|broki-service-secrets/.test(staged)) {
    fail("secrets path is staged");
  } else {
    pass("no secrets path staged");
  }
  const stagedDiff = execSync("git diff --cached", { cwd: ROOT, encoding: "utf8" });
  const hasBrokiAssignment = REQUIRED.some(n => stagedDiff.includes(`${n}=`));
  if (hasBrokiAssignment) {
    fail("secret value assignment found in staged diff");
  } else {
    pass("no secret assignments in staged diff");
  }
} catch {
  pass("git staged check skipped (not a repo)");
}

// --- Not tracked ---
try {
  const tracked = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" });
  if (/\.secrets\/|broki-service-secrets\.env/.test(tracked)) {
    fail("secrets file or .secrets/ is tracked by git");
  } else {
    pass("secrets file not tracked");
  }
  // Check no NAME=value in tracked source files
  const grepCmd =
    `git grep -ln "BROKI_N8N_SECRET=\\|BROKI_INTERNAL_FUNCTION_SECRET=\\|BROKI_NEXT_SERVER_SECRET=\\|BROKI_REMOTE_TEST_SECRET=" -- . ":(exclude).secrets" 2>/dev/null || true`;
  const hits = execSync(grepCmd, { cwd: ROOT, encoding: "utf8", shell: true }).trim();
  if (hits) {
    fail(`secret assignments found in tracked files:\n  ${hits.split("\n").join("\n  ")}`);
  } else {
    pass("no secret assignments in tracked files");
  }
} catch {
  pass("tracked files check skipped");
}

// --- Result ---
if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll secrets checks PASSED.");
