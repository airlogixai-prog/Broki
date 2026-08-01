/**
 * function-access.ts
 * Minimum-privilege matrix: which service IDs are allowed per Edge Function.
 * Browser-authenticated users (JWT) are always allowed through user-auth.ts.
 */
import type { BrokiServiceId } from "./service-auth.ts";

export const FUNCTION_SERVICE_ACCESS: Record<string, readonly BrokiServiceId[]> = {
  // Read-heavy, low-risk: next-server, internal-function, remote-smoke
  "inventory-list":  ["next-server", "internal-function", "remote-smoke"],
  "personnel-list":  ["next-server", "internal-function", "remote-smoke"],
  "aircraft-list":   ["next-server", "internal-function", "remote-smoke"],
  "tooling-list":    ["next-server", "internal-function", "remote-smoke"],
  "planner-groups":  ["next-server", "internal-function", "remote-smoke"],
  "planner-tasks":   ["next-server", "internal-function", "remote-smoke"],

  // Mixed read/write: next-server, remote-smoke (n8n not connected yet)
  "incidents":      ["next-server", "remote-smoke"],
  "nitro-stock":    ["next-server", "remote-smoke"],
  "relays":         ["next-server", "remote-smoke"],
  "roster-upload":  ["next-server", "remote-smoke"],
  "equipment-update": ["next-server", "remote-smoke"],

  // Planner write: also internal-function (future PDF pipeline)
  "planner-action": ["internal-function", "next-server", "remote-smoke"],

  // Tooling write: next-server, remote-smoke
  "tooling-action": ["next-server", "remote-smoke"],

  // Import batch: n8n (migration path) + remote-smoke
  "broki-import-batch": ["n8n", "remote-smoke"],

  // Public: no service auth (honeypot + rate limit instead)
  "personnel-register": [],
};
