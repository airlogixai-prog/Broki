#!/usr/bin/env node
/**
 * Generate BROKI service secrets — 48 random bytes per secret, base64url encoded.
 * Never prints secret values. Output only to .secrets/broki-service-secrets.env.
 */
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SECRETS_DIR = join(ROOT, ".secrets");
const DEFAULT_FILE = join(SECRETS_DIR, "broki-service-secrets.env");

const SECRET_NAMES = [
  "BROKI_N8N_SECRET",
  "BROKI_INTERNAL_FUNCTION_SECRET",
  "BROKI_NEXT_SERVER_SECRET",
  "BROKI_REMOTE_TEST_SECRET",
];

const rotate = process.argv.includes("--rotate");

function generateSecret() {
  return randomBytes(48).toString("base64url");
}

function buildEnvContent() {
  const values = SECRET_NAMES.map(() => generateSecret());
  // Verify all distinct (collision probability negligible but check anyway)
  const unique = new Set(values);
  if (unique.size !== values.length) throw new Error("collision in generated secrets — retry");
  return SECRET_NAMES.map((name, i) => `${name}=${values[i]}`).join("\n") + "\n";
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  chmodSync(dir, 0o700);
}

function writeSecret(path, content) {
  writeFileSync(path, content, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
}

let outputPath = DEFAULT_FILE;

if (rotate) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  outputPath = join(SECRETS_DIR, `broki-service-secrets.env.${stamp}`);
  console.log("ROTATION: new secrets file created with timestamp.");
  console.log("NEXT STEPS:");
  console.log("  1. Set BROKI_*_PREVIOUS = current value in Supabase before switching.");
  console.log("  2. Set BROKI_* = new value from this file.");
  console.log("  3. Deploy Edge Functions (they accept current + previous).");
  console.log("  4. Update callers to use new secret.");
  console.log("  5. Remove *_PREVIOUS after verifying traffic.");
  console.log("Do NOT destroy the previous file until step 5 is complete.");
} else if (existsSync(DEFAULT_FILE)) {
  console.error(
    "Refusing to overwrite existing secrets file.\n" +
    "Use: npm run secrets:generate -- --rotate"
  );
  process.exit(1);
}

ensureDir(SECRETS_DIR);
writeSecret(outputPath, buildEnvContent());

const relPath = outputPath.startsWith(ROOT) ? outputPath.slice(ROOT.length + 1) : outputPath;
console.log("Created 4 BROKI service secrets.");
console.log(`Output: ${relPath}`);
console.log("Values were not printed.");
