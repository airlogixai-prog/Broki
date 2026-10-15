/**
 * user-auth.ts
 * Validates Supabase Auth JWT via auth.getUser(), then BROKI authorization
 * via broki_user_access (deny-by-default).
 *
 * auth.users alone is NEVER enough for dashboard access.
 */
import { createServiceClient } from "./supabase-admin.ts";

export type BrokiPermission =
  | "dashboard:read"
  | "dashboard:write"
  | "admin:read"
  | "admin:write";

export type BrokiRole = "admin" | "operator" | "viewer";

export type UserAuthResult =
  | {
      ok: true;
      userId: string;
      email: string | undefined;
      role: BrokiRole;
      permissions: BrokiPermission[];
      personnelId: string | null;
    }
  | {
      ok: false;
      status: 401 | 403;
      error: string;
    };

const ROLE_PERMS: Record<BrokiRole, BrokiPermission[]> = {
  viewer: ["dashboard:read"],
  operator: ["dashboard:read", "dashboard:write"],
  admin: ["dashboard:read", "dashboard:write", "admin:read", "admin:write"],
};

export function permissionsForRole(role: BrokiRole): BrokiPermission[] {
  return ROLE_PERMS[role];
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export async function authenticateBrokiUser(req: Request): Promise<UserAuthResult> {
  const token = bearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: "missing_token" };
  }

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    return { ok: false, status: 401, error: "auth_unavailable" };
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { ok: false, status: 401, error: "invalid_token" };
  }

  if (!user.id) {
    return { ok: false, status: 401, error: "invalid_token" };
  }

  try {
    const [, payloadB64] = token.split(".");
    if (payloadB64) {
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
      if (payload?.role === "anon") {
        return { ok: false, status: 401, error: "anon_not_allowed" };
      }
    }
  } catch {
    /* getUser already validated signature */
  }

  if (user.banned_until && new Date(user.banned_until) > new Date()) {
    return { ok: false, status: 403, error: "user_banned" };
  }
  if (user.app_metadata?.disabled === true) {
    return { ok: false, status: 403, error: "user_disabled" };
  }

  const { data: access, error: accessErr } = await supabase
    .from("broki_user_access")
    .select("role, is_active, personnel_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (accessErr) {
    console.error("[user-auth] broki_user_access lookup failed", accessErr.message);
    return { ok: false, status: 403, error: "access_lookup_failed" };
  }

  if (!access || access.is_active !== true) {
    return { ok: false, status: 403, error: "forbidden_no_broki_access" };
  }

  const role = access.role as BrokiRole;
  if (!ROLE_PERMS[role]) {
    return { ok: false, status: 403, error: "forbidden_invalid_role" };
  }

  let permissions = permissionsForRole(role);

  // Pending personnel cannot mutate (ops review incomplete).
  if (access.personnel_id && permissions.includes("dashboard:write")) {
    const { data: person } = await supabase
      .from("broki_personnel")
      .select("review_status, estado")
      .eq("id", access.personnel_id)
      .maybeSingle();
    if (person?.review_status === "pending" || person?.estado === 0 || person?.estado === "0") {
      permissions = permissions.filter((p) => p !== "dashboard:write" && p !== "admin:write");
    }
  }

  return {
    ok: true,
    userId: user.id,
    email: user.email,
    role,
    permissions,
    personnelId: access.personnel_id ?? null,
  };
}

export function hasPermission(
  permissions: readonly BrokiPermission[],
  required: BrokiPermission,
): boolean {
  return permissions.includes(required);
}

if (import.meta.main) {
  const withToken = new Request("https://x", {
    headers: { authorization: "Bearer eyJ.test" },
  });
  const noToken = new Request("https://x");
  console.assert(bearerToken(withToken) === "eyJ.test", "extract bearer");
  console.assert(bearerToken(noToken) === null, "missing bearer");
  console.assert(hasPermission(["dashboard:read", "dashboard:write"], "dashboard:write"));
  console.assert(!hasPermission(["dashboard:read"], "dashboard:write"));
  console.assert(permissionsForRole("viewer").includes("dashboard:read"));
  console.assert(!permissionsForRole("viewer").includes("dashboard:write"));
  console.assert(permissionsForRole("operator").includes("dashboard:write"));
  console.log("user-auth self-check OK");
}
