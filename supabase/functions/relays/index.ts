import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import { authorizeOrRespond } from "../_shared/request-auth.ts";

// Shift relay notes. Replaces the `relays_db` localStorage key the legacy
// dashboard used as its only store, so a relay survives a browser wipe and is
// visible to the next shift on a different device.

const MAX_POINTS = 50;
const MAX_POINT_LEN = 500;

interface RelayRow {
  id: string;
  plane_text: string;
  worker_text: string | null;
  relay_at: string;
  broki_relay_points?: { position: number; point_text: string }[] | null;
}

function toClientRelay(row: RelayRow) {
  const points = [...(row.broki_relay_points ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((p) => p.point_text);

  return {
    id: row.id,
    timestamp: row.relay_at,
    plane: row.plane_text,
    worker: row.worker_text ?? "Sin Firma",
    points,
  };
}

serve(async (req) => {
  const auth = await authorizeOrRespond(req, "relays", { mutation: req.method === "POST" });
  if (auth instanceof Response) return auth;

  const supabase = createServiceClient();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("broki_relays")
      .select("id, plane_text, worker_text, relay_at, broki_relay_points(position, point_text)")
      .order("relay_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[relays] GET error", error);
      return jsonResponse(req, { error: "db_error" }, 500);
    }
    return jsonResponse(req, (data ?? []).map((r) => toClientRelay(r as RelayRow)));
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "invalid_json" }, 400);
  }

  const action = String(body.action ?? "create");

  if (action === "delete") {
    const id = String(body.id ?? "");
    if (!id) return jsonResponse(req, { error: "missing id" }, 400);

    // Points cascade with the parent row.
    const { error } = await supabase.from("broki_relays").delete().eq("id", id);
    if (error) {
      console.error("[relays] delete error", error);
      return jsonResponse(req, { error: "db_error" }, 500);
    }

    await writeAudit("relay.delete", "broki_relays", id, {}, auth);
    return jsonResponse(req, { ok: true });
  }

  if (action !== "create") {
    return jsonResponse(req, { error: `unknown action: ${action}` }, 400);
  }

  const plane = String(body.plane ?? "").trim().toUpperCase();
  if (!plane) return jsonResponse(req, { error: "missing plane" }, 400);

  const rawPoints = Array.isArray(body.points) ? body.points : [];
  const points = rawPoints
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .slice(0, MAX_POINTS)
    .map((p) => p.slice(0, MAX_POINT_LEN));

  if (points.length === 0) {
    return jsonResponse(req, { error: "at least one point is required" }, 400);
  }

  const worker = String(body.worker ?? "").trim() || null;

  // Resolve the optional aircraft/personnel FKs so the row joins with the rest of
  // the schema, but never fail the write when the free text has no match.
  const { data: aircraft } = await supabase
    .from("broki_aircraft")
    .select("id")
    .eq("matricula", plane)
    .maybeSingle();

  let workerId: string | null = null;
  if (worker) {
    const { data: person } = await supabase
      .from("broki_personnel")
      .select("id")
      .ilike("nombre", worker)
      .limit(1)
      .maybeSingle();
    workerId = person?.id ?? null;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("broki_relays")
    .insert({
      plane_text: plane,
      aircraft_id: aircraft?.id ?? null,
      worker_text: worker,
      worker_id: workerId,
      relay_at: new Date().toISOString(),
    })
    .select("id, plane_text, worker_text, relay_at")
    .single();

  if (insertErr || !inserted) {
    console.error("[relays] insert error", insertErr);
    return jsonResponse(req, { error: "db_error" }, 500);
  }

  const { error: pointsErr } = await supabase.from("broki_relay_points").insert(
    points.map((point_text, i) => ({
      relay_id: inserted.id,
      position: i + 1,
      point_text,
    })),
  );

  if (pointsErr) {
    // Without its points the relay carries no information, so roll it back
    // instead of leaving an empty note behind.
    console.error("[relays] points insert error", pointsErr);
    await supabase.from("broki_relays").delete().eq("id", inserted.id);
    return jsonResponse(req, { error: "db_error" }, 500);
  }

  await writeAudit("relay.create", "broki_relays", inserted.id, {
    plane,
    point_count: points.length,
  }, auth);

  return jsonResponse(
    req,
    toClientRelay({
      ...(inserted as RelayRow),
      broki_relay_points: points.map((point_text, i) => ({ position: i + 1, point_text })),
    }),
    201,
  );
});
