import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import { authorizeOrRespond, assertUserCanWrite, readMutationBody, respondMutation } from "../_shared/request-auth.ts";
import { assertUuid } from "../_shared/uuid.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  const auth = await authorizeOrRespond(req, "tooling-action", { mutation: true });
  if (auth instanceof Response) return auth;
  const denied = assertUserCanWrite(req, auth);
  if (denied) return denied;

  const parsed = await readMutationBody(req, auth, "tooling-action");
  if (!parsed.ok) return parsed.response;
  const { body, bodyText } = parsed;

  if (!body?.action) {
    return jsonResponse(req, { error: "missing action" }, 400);
  }

  const action = String(body.action);
  const supabase = createServiceClient();
  const CONDITIONS = ["Completo", "Defectuoso"];
  const condition = (v: unknown): string | null => {
    if (v == null || v === "") return null;
    const s = String(v);
    return CONDITIONS.includes(s) ? s : "__invalid__";
  };
  const text = (v: unknown, max: number) => (v == null ? null : String(v).slice(0, max));

  try {
    if (action === "checkout") {
      if (!body.bac_bact || !body.tma_out) {
        return jsonResponse(req, { error: "missing bac_bact or tma_out" }, 400);
      }

      const completeOut = condition(body.complete_out);
      if (completeOut === "__invalid__") {
        return jsonResponse(req, { error: "invalid complete_out" }, 400);
      }

      const { data, error } = await supabase.rpc("broki_tooling_checkout", {
        p_payload: {
          bac_bact: String(body.bac_bact).toUpperCase().slice(0, 64),
          tma_out: text(body.tma_out, 120),
          complete_out: completeOut,
          avion: text(body.avion, 32),
          aircraft_id: body.aircraft_id ?? null,
          descripcion: text(body.descripcion, 500),
          remarks: text(body.remarks, 2000),
          // Server time; the browser clock is not trusted.
          date_out: new Date().toISOString(),
          external_id: body.external_id ?? `checkout-${crypto.randomUUID()}`,
        },
      });

      if (error) {
        // Lost a race with another checkout of the same tool (partial unique index).
        if (error.message?.includes("open_checkout_exists") || error.code === "23505") {
          return jsonResponse(req, { error: "open_checkout_exists" }, 409);
        }
        console.error("[tooling-action] checkout error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }

      const inserted = data as Record<string, unknown>;
      await writeAudit("tooling.checkout", "broki_tooling_movements", String(inserted.id), {
        bac_bact: body.bac_bact,
        tma_out: body.tma_out,
      }, auth);

      return respondMutation(req, auth, "tooling-action", bodyText, 200, inserted);
    }

    if (action === "checkin") {
      if (!body.tma_in) {
        return jsonResponse(req, { error: "missing tma_in" }, 400);
      }

      if (body.id) {
        try {
          assertUuid(body.id, "id");
        } catch {
          return jsonResponse(req, { error: "invalid id" }, 400);
        }
      } else if (!body.bac_bact) {
        return jsonResponse(req, { error: "missing id or bac_bact for checkin" }, 400);
      }

      const completeIn = condition(body.complete_in);
      if (completeIn === "__invalid__") {
        return jsonResponse(req, { error: "invalid complete_in" }, 400);
      }

      const { data, error } = await supabase.rpc("broki_tooling_checkin", {
        p_payload: {
          id: body.id ?? null,
          bac_bact: body.bac_bact ? String(body.bac_bact).toUpperCase().slice(0, 64) : null,
          tma_in: text(body.tma_in, 120),
          complete_in: completeIn,
          remarks: text(body.remarks, 2000),
          date_in: new Date().toISOString(),
        },
      });

      if (error) {
        if (error.message?.includes("open_movement_not_found")) {
          return jsonResponse(req, { error: "open_movement_not_found" }, 404);
        }
        console.error("[tooling-action] checkin error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }

      const updated = data as Record<string, unknown>;
      await writeAudit("tooling.checkin", "broki_tooling_movements", String(updated.id), {
        bac_bact: updated.bac_bact,
        tma_in: body.tma_in,
      }, auth);

      return respondMutation(req, auth, "tooling-action", bodyText, 200, updated);
    }

    return jsonResponse(req, { error: `unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("[tooling-action] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
