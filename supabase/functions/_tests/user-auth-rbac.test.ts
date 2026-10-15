/**
 * AuthZ regression: permissionsForRole + assertUserCanWrite semantics.
 * Live getUser/access table covered by remote smoke (service path) + manual checklist.
 */
import {
  hasPermission,
  permissionsForRole,
  type BrokiPermission,
} from "../_shared/user-auth.ts";

Deno.test("viewer cannot write", () => {
  const p = permissionsForRole("viewer");
  if (hasPermission(p, "dashboard:write")) throw new Error("viewer write");
  if (!hasPermission(p, "dashboard:read")) throw new Error("viewer read");
});

Deno.test("operator can write", () => {
  const p = permissionsForRole("operator");
  if (!hasPermission(p, "dashboard:write")) throw new Error("operator write");
});

Deno.test("admin has admin:write", () => {
  const p = permissionsForRole("admin");
  if (!hasPermission(p, "admin:write" as BrokiPermission)) throw new Error("admin write");
});

Deno.test("roster write permission required in matrix", () => {
  const raw = Deno.readTextFileSync(
    new URL("../../../config/broki/function-permissions.json", import.meta.url),
  );
  const cfg = JSON.parse(raw);
  if (cfg.functions["roster-upload"].post !== "dashboard:write") {
    throw new Error("roster-upload post must be dashboard:write");
  }
});
