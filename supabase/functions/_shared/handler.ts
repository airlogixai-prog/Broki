import { handleCors } from "./cors.ts";
import { jsonResponse } from "./response.ts";

type Handler = (req: Request) => Promise<Response>;

export function serve(handler: Handler): void {
  Deno.serve(async (req) => {
    const cors = handleCors(req);
    if (cors) return cors;

    try {
      return await handler(req);
    } catch (err) {
      console.error("[edge-function]", err);
      return jsonResponse(req, { error: "internal_error" }, 500);
    }
  });
}
