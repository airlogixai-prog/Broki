/**
 * user-auth.ts
 * Validates a real Supabase Auth user from the Bearer token.
 * Uses supabase.auth.getUser() — not just JWT decode — so the token
 * is verified against the auth server and revocation is respected.
 *
 * Rejects:
 *  - missing token
 *  - invalid / expired token
 *  - role === anon (publishable key requests without real session)
 *  - no sub (user id)
 *  - banned / disabled users
 */
import { createServiceClient } from "./supabase-admin.ts";

export type UserAuthResult =
  | {
      ok: true;
      userId: string;
      email: string | undefined;
      role: "operator";
      // ponytail: v1 = all authenticated users get dashboard perms.
      // Upgrade path: table broki_user_permissions keyed on userId.
      permissions: ["dashboard:read", "dashboard:write"];
    }
  | {
      ok: false;
      status: 401 | 403;
      error: string;
    };

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

  // Decode role from JWT payload to catch anon requests early
  // (getUser already validated the signature; this is a defense-in-depth read)
  try {
    const [, payloadB64] = token.split(".");
    if (payloadB64) {
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
      if (payload?.role === "anon") {
        return { ok: false, status: 401, error: "anon_not_allowed" };
      }
    }
  } catch {
    // If decode fails let getUser result stand
  }

  // Reject banned / disabled users
  if (
    user.banned_until && new Date(user.banned_until) > new Date()
  ) {
    return { ok: false, status: 403, error: "user_banned" };
  }
  if (user.app_metadata?.disabled === true) {
    return { ok: false, status: 403, error: "user_disabled" };
  }

  return {
    ok: true,
    userId: user.id,
    email: user.email,
    role: "operator",
    permissions: ["dashboard:read", "dashboard:write"],
  };
}
