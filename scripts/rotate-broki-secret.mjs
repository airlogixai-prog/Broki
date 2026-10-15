#!/usr/bin/env node
/**
 * Generate a new secret for rotation of a specific BROKI service identity.
 * Does NOT push or overwrite — outputs instructions only.
 * Usage: npm run secrets:rotate -- --scope <scope>
 * Scopes: n8n | internal-function | next-server | remote-smoke
 */
import { randomBytes } from "node:crypto";

const SCOPES = {
  "n8n": "BROKI_N8N_SECRET",
  "internal-function": "BROKI_INTERNAL_FUNCTION_SECRET",
  "next-server": "BROKI_NEXT_SERVER_SECRET",
  "remote-smoke": "BROKI_REMOTE_TEST_SECRET",
};

const scopeArg = process.argv[process.argv.indexOf("--scope") + 1];
if (!scopeArg || !SCOPES[scopeArg]) {
  console.error(`Usage: node rotate-broki-secret.mjs --scope <scope>`);
  console.error(`Valid scopes: ${Object.keys(SCOPES).join(", ")}`);
  process.exit(1);
}

const envName = SCOPES[scopeArg];
const newValue = randomBytes(48).toString("base64url");

console.log(`\nRotation runbook for: ${envName} (${scopeArg})`);
console.log("=".repeat(60));
console.log(`New secret generated. Value not shown here.`);
console.log(`\nSTEPS (do not skip any):`);
console.log(`1. Copy the NEW secret from this process output`);
console.log(`   (run again with 2>/dev/null | grep NEW if needed — but note the value`);
console.log(`    is only displayed once)`);
console.log(`NEW_SECRET_BASE64URL=${newValue}`);
console.log(`\n2. In Supabase CLI, run dual-push BEFORE switching callers:`);
console.log(`   supabase secrets set --project-ref mjtuxabpjsgggezrsdrw \\`);
console.log(`     ${envName}_PREVIOUS=<current_value> \\`);
console.log(`     ${envName}=<new_value>`);
console.log(`\n3. Deploy Edge Functions to pick up the new env:`);
console.log(`   npm run functions:deploy:dashboard`);
console.log(`\n4. Update ALL callers (e.g. Vercel env, n8n vault) to use the NEW secret.`);
console.log(`\n5. Once all callers are migrated and smoke passes:`);
console.log(`   supabase secrets set --project-ref mjtuxabpjsgggezrsdrw \\`);
console.log(`     ${envName}_PREVIOUS=`);
console.log(`   (unsets PREVIOUS; deploy functions again)`);
console.log(`\n6. Update .secrets/broki-service-secrets.env locally:`);
console.log(`   npm run secrets:generate -- --rotate`);
console.log(`\n⚠️  Do NOT remove PREVIOUS before step 5.`);
console.log(`⚠️  Do NOT commit secret values.`);
