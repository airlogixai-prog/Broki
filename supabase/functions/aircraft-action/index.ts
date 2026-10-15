import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import { authorizeOrRespond, assertUserCanWrite, readMutationBody, respondMutation } from "../_shared/request-auth.ts";
import { assertUuid } from "../_shared/uuid.ts";

function normalizeReg(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  const auth = await authorizeOrRespond(req, "aircraft-action", { mutation: true });
  if (auth instanceof Response) return auth;
  const denied = assertUserCanWrite(req, auth);
  if (denied) return denied;

  const parsed = await readMutationBody(req, auth, "aircraft-action");
  if (!parsed.ok) return parsed.response;
  const { body, bodyText } = parsed;

  const action = String(body.action ?? "");
  const supabase = createServiceClient();

  try {
    if (action === "create") {
      const matricula = normalizeReg(body.matricula ?? body.reg);
      if (!matricula) {
        return jsonResponse(req, { error: "missing matricula" }, 400);
      }

      const { data: inserted, error } = await supabase
        .from("broki_aircraft")
        .insert({
          source_system: "edge_function",
          source_table: "pro.aviones",
          external_id: `aircraft-${crypto.randomUUID()}`,
          matricula,
          modelo: body.modelo ?? body.model ?? null,
          aerolinea: body.aerolinea ?? body.airline ?? null,
          msn: body.msn ?? null,
          motor: body.motor ?? null,
          estado: body.estado ?? "active",
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return jsonResponse(req, { error: "matricula_already_exists" }, 409);
        }
        console.error("[aircraft-action] create error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }

      await writeAudit("aircraft.create", "broki_aircraft", inserted.id, { matricula }, auth);
      return respondMutation(req, auth, "aircraft-action", bodyText, 201, inserted);
    }

    if (action === "update") {
      let id: string;
      try {
        id = assertUuid(body.id, "id");
      } catch {
        return jsonResponse(req, { error: "invalid id" }, 400);
      }

      const patch: Record<string, unknown> = {};
      if (body.matricula != null || body.reg != null) {
        patch.matricula = normalizeReg(body.matricula ?? body.reg);
      }
      if (body.modelo != null || body.model != null) {
        patch.modelo = body.modelo ?? body.model;
      }
      if (body.aerolinea != null || body.airline != null) {
        patch.aerolinea = body.aerolinea ?? body.airline;
      }
      if (body.msn != null) patch.msn = body.msn;
      if (body.motor != null) patch.motor = body.motor;
      if (body.estado != null) patch.estado = body.estado;

      const { data: updated, error } = await supabase
        .from("broki_aircraft")
        .update(patch)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) {
        console.error("[aircraft-action] update error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }
      if (!updated) {
        return jsonResponse(req, { error: "aircraft_not_found" }, 404);
      }

      await writeAudit("aircraft.update", "broki_aircraft", id, patch, auth);
      return respondMutation(req, auth, "aircraft-action", bodyText, 200, updated);
    }

    if (action === "delete") {
      let id: string;
      try {
        id = assertUuid(body.id, "id");
      } catch {
        return jsonResponse(req, { error: "invalid id" }, 400);
      }

      const { data: deleted, error } = await supabase
        .from("broki_aircraft")
        .delete()
        .eq("id", id)
        .select("id, matricula")
        .maybeSingle();

      if (error) {
        console.error("[aircraft-action] delete error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }
      if (!deleted) {
        return jsonResponse(req, { error: "aircraft_not_found" }, 404);
      }

      await writeAudit("aircraft.delete", "broki_aircraft", id, { matricula: deleted.matricula }, auth);
      return respondMutation(req, auth, "aircraft-action", bodyText, 200, deleted);
    }

    return jsonResponse(req, { error: `unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("[aircraft-action] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
