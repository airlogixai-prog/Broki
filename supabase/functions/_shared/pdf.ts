// PDF intake helpers shared by the roster and planner import functions.
// Replaces the n8n "horario" / "planner" webhooks that used to do this upstream.

import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

export const MAX_PDF_BYTES = 15 * 1024 * 1024;

export class PdfError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "PdfError";
  }
}

/**
 * Validates an uploaded file at the trust boundary: an Edge Function accepts
 * bytes from a browser, so size and the %PDF- magic number are checked before
 * anything tries to parse them. A wrong Content-Type header is not enough.
 */
export function assertPdf(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) throw new PdfError("empty file");
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new PdfError(`file too large (max ${MAX_PDF_BYTES} bytes)`, 413);
  }

  const magic = new TextDecoder().decode(bytes.subarray(0, 5));
  if (magic !== "%PDF-") throw new PdfError("not a PDF file");
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface PdfText {
  pages: string[];
  text: string;
  pageCount: number;
}

/** Extracts the embedded text layer. Scanned PDFs come back effectively empty. */
export async function extractPdfText(bytes: Uint8Array): Promise<PdfText> {
  // pdf.js takes ownership of the buffer it is handed and detaches it, leaving
  // the caller's array at length 0. Hashing those bytes afterwards would return
  // the digest of the empty string for every document, so every import after the
  // first would look like a duplicate. Parse a copy and leave the input intact.
  const doc = await getDocumentProxy(bytes.slice());
  const { text } = await extractText(doc, { mergePages: false });
  const pages = Array.isArray(text) ? text : [String(text ?? "")];
  return {
    pages,
    text: pages.join("\n"),
    pageCount: doc.numPages,
  };
}

/** True when the text layer is too thin to parse, i.e. the PDF is a scan. */
export function looksScanned(pdf: PdfText): boolean {
  return pdf.text.replace(/\s+/g, "").length < 200;
}

export interface OpenAiJsonRequest {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
}

/**
 * Structured-output call used as the fallback when the heuristic parser cannot
 * make sense of a document. Returns null when no key is configured so callers
 * can degrade to "nothing imported" instead of failing the whole request.
 */
export async function openAiJson<T>(req: OpenAiJsonRequest): Promise<T | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.warn("[pdf] OPENAI_API_KEY not set; skipping AI fallback");
    return null;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: req.schemaName,
          strict: true,
          schema: req.schema,
        },
      },
    }),
  });

  if (!res.ok) {
    console.error("[pdf] OpenAI error", res.status, await res.text());
    return null;
  }

  const payload = await res.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;

  try {
    return JSON.parse(content) as T;
  } catch (err) {
    console.error("[pdf] OpenAI returned invalid JSON", err);
    return null;
  }
}

/** Pulls the single uploaded PDF out of a multipart request. */
export async function readPdfUpload(
  req: Request,
): Promise<{ bytes: Uint8Array; fileName: string; form: FormData }> {
  const form = await req.formData();
  const file = form.get("file") ?? form.get("data") ?? form.get("pdf");
  if (!(file instanceof File)) throw new PdfError("missing file field");

  const bytes = new Uint8Array(await file.arrayBuffer());
  assertPdf(bytes);
  return { bytes, fileName: file.name || "upload.pdf", form };
}
