import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";

function applyEquipmentUpdates(
  updates: Record<string, unknown>,
  type: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const isFurgo = type === "furgo" || type === "vehicle";

  if ("location" in updates) {
    if (isFurgo) {
      patch.parking = updates.location;
    } else {
      patch.ubicacion_habitual = updates.location;
      patch.parking = updates.location;
    }
  }
  if ("plane" in updates) patch.avion_text = updates.plane ?? null;
  if ("worker" in updates) patch.current_worker_text = updates.worker ?? null;
  if ("fuel" in updates) {
    const v = updates.fuel;
    patch.combustible = v === null || v === "" ? null : Number(v);
  }
  if ("status" in updates) patch.estado = updates.status ?? null;
  if ("notes" in updates) patch.notas = updates.notes ?? null;
  for (const n of ["nitrogeno_1", "nitrogeno_2", "nitrogeno_3", "nitrogeno_4"] as const) {
    if (n in updates) {
      const v = updates[n];
      patch[n] = v === null || v === "" ? null : Number(v);
    }
  }
  return patch;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "invalid_json" }, 400);
  }

  if (!body?.item_id) {
    return jsonResponse(req, { error: "missing item_id" }, 400);
  }

  const itemId = String(body.item_id);
  const type = String(body.type ?? "");
  const updates = (body.updates ?? {}) as Record<string, unknown>;

  if (typeof updates !== "object" || Array.isArray(updates)) {
    return jsonResponse(req, { error: "updates must be an object" }, 400);
  }

  try {
    const supabase = createServiceClient();

    const { data: existing, error: findErr } = await supabase
      .from("broki_assets")
      .select("id, identifier, asset_kind")
      .eq("identifier", itemId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findErr) {
      console.error("[equipment-update] find error", findErr);
      return jsonResponse(req, { error: "db_error" }, 500);
    }
    if (!existing) {
      return jsonResponse(req, { error: "asset_not_found", item_id: itemId }, 404);
    }

    const assetKind = existing.asset_kind as string;
    const effectiveType = type || (assetKind === "van" ? "furgo" : "gse");
    const patch = applyEquipmentUpdates(updates, effectiveType);

    if (Object.keys(patch).length === 0) {
      return jsonResponse(req, { error: "no valid update fields" }, 400);
    }

    const { data: updated, error: updateErr } = await supabase
      .from("broki_assets")
      .update(patch)
      .eq("id", existing.id)
      .select()
      .single();

    if (updateErr) {
      console.error("[equipment-update] update error", updateErr);
      return jsonResponse(req, { error: "db_error" }, 500);
    }

    await writeAudit("asset.update", "broki_assets", existing.id, {
      item_id: itemId,
      type: effectiveType,
      updates,
    });

    return jsonResponse(req, updated);
  } catch (err) {
    console.error("[equipment-update] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
