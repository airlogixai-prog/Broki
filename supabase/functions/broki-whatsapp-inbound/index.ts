// broki-whatsapp-inbound — PR8
//
// Receives ManyChat webhooks (broki_produccion_in flow), handles phone cleanup,
// registers communications, and routes to asset-update agents.
//
// DEPLOYMENT GATE: this function is registered but NOT wired as the live
// webhook target until WHATSAPP_INBOUND_ENABLED=true is set.
// Until then, n8n flow broki_produccion_in remains the active handler.
//
// Secrets required (set via `supabase secrets set`):
//   MANYCHAT_API_TOKEN
//   OPENAI_API_KEY
//   WHATSAPP_INBOUND_ENABLED  (set to "true" to activate)

import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";

const ENABLED = Deno.env.get("WHATSAPP_INBOUND_ENABLED") === "true";

serve(async (req) => {
  if (!ENABLED) {
    // Soft reject — keeps n8n as the sole active handler during transition
    return jsonResponse(req, { error: "whatsapp_inbound_not_enabled" }, 503);
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, { error: "invalid_json" }, 400);
  }

  // ---- 1. Extract and normalize phone ----
  const rawPhone = String(
    payload.phone ??
    payload.telefono ??
    (payload.full_data as Record<string, unknown> | undefined)?.phone ??
    "",
  ).trim();

  if (!rawPhone) {
    return jsonResponse(req, { error: "missing phone" }, 400);
  }

  // Remove +34 prefix (Spain) — mirroring FLUJO_PRINCIPAL behavior
  const phone = rawPhone.replace(/^\+34/, "").replace(/\s+/g, "");

  const supabase = createServiceClient();

  // ---- 2. Lookup registered user ----
  const { data: person } = await supabase
    .from("broki_personnel")
    .select("id, nombre, id_chat")
    .eq("telefono", phone)
    .maybeSingle();

  const idChat = String(payload.id ?? payload.id_chat ?? rawPhone);

  if (!person) {
    // Register unknown contact
    await supabase
      .from("broki_unknown_contacts")
      .upsert(
        {
          source_system: "whatsapp_inbound",
          source_table: "pro.no_existe_telefono",
          external_id: phone,
          id_chat: idChat,
          telefono: phone,
          mensaje: String(payload.text ?? payload.message ?? ""),
          fecha_modificacion: new Date().toISOString(),
        },
        { onConflict: "source_system,external_id" },
      );

    await writeAudit("whatsapp.unknown_contact", "broki_unknown_contacts", null, { phone });

    // ponytail: send rejection/help message via ManyChat here once wired
    return jsonResponse(req, { ok: true, status: "unregistered" });
  }

  // ---- 3. Register communication ----
  const messageText = String(payload.text ?? payload.message ?? "");
  const now = new Date().toISOString();

  await supabase.from("broki_communications").insert({
    source_system: "whatsapp_inbound",
    source_table: "pro.registro_comunicaciones",
    external_id: `wa-${phone}-${Date.now()}`,
    id_chat: idChat,
    telefono: phone,
    person_id: person.id,
    mensaje_in: messageText,
    respondido: false,
    fecha_mensaje_in: now,
  });

  // ---- 4. TODO: orchestrator (FURGONETA / GSE / ATENCION_CLIENTE) ----
  // ponytail: OpenAI agent classification + asset update lives here in PR8 full.
  // For now, log and acknowledge so ManyChat does not retry.
  await writeAudit("whatsapp.inbound", "broki_communications", null, {
    phone,
    person_id: person.id,
    message_preview: messageText.substring(0, 100),
  });

  return jsonResponse(req, { ok: true, status: "received", person: person.nombre });
});
