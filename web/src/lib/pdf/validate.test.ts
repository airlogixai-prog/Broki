import { describe, it } from "node:test";
import assert from "node:assert/strict";

const MAX_BYTES = 15 * 1024 * 1024;

function validatePdfFile(file: { type: string; size: number }): string | null {
  if (file.type && file.type !== "application/pdf") {
    return "Solo se admiten archivos PDF.";
  }
  if (file.size > MAX_BYTES) return "too_large";
  if (file.size === 0) return "empty";
  return null;
}

describe("pdf client validation", () => {
  it("rejects non-pdf mime", () => {
    assert.equal(validatePdfFile({ type: "text/plain", size: 100 }), "Solo se admiten archivos PDF.");
  });
  it("accepts pdf under limit", () => {
    assert.equal(validatePdfFile({ type: "application/pdf", size: 1024 }), null);
  });
  it("rejects oversize pdf", () => {
    assert.equal(validatePdfFile({ type: "application/pdf", size: MAX_BYTES + 1 }), "too_large");
  });
});
