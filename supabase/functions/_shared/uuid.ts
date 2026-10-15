const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Trust-boundary check: destructive ops must target a row UUID, not a matrícula. */
export function assertUuid(value: unknown, field = "id"): string {
  const s = String(value ?? "").trim();
  if (!UUID_RE.test(s)) {
    throw new Error(`invalid_uuid:${field}`);
  }
  return s;
}

export function isUuid(value: unknown): boolean {
  return UUID_RE.test(String(value ?? "").trim());
}

if (import.meta.main) {
  assertUuid("550e8400-e29b-41d4-a716-446655440000") ===
    "550e8400-e29b-41d4-a716-446655440000";
  let rejected = false;
  try {
    assertUuid("EC-NFP", "group_id");
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("matricula must not pass as uuid");
  console.log("uuid self-check OK");
}
