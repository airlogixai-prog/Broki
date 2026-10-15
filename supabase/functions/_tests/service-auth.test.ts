/**
 * Exhaustive tests for service-auth.ts
 * Run with: deno test -A supabase/functions/_tests/service-auth.test.ts
 */
import {
  authenticateServiceRequest,
  type BrokiServiceId,
} from "../_shared/service-auth.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUUID(): string {
  return "550e8400-e29b-41d4-a716-446655440000";
}

function nowS(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function makeRequest(headers: Record<string, string>): Request {
  return new Request("https://example.com/functions/v1/test", { headers });
}

function goodHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "x-broki-service-id": "next-server",
    "x-broki-service-secret": Deno.env.get("BROKI_NEXT_SERVER_SECRET") ?? "test-secret",
    "x-broki-request-id": makeUUID(),
    "x-broki-timestamp": nowS(),
    ...overrides,
  };
}

const ALLOWED: readonly BrokiServiceId[] = ["next-server", "remote-smoke"];

// Set a known secret for "next-server" during tests
const TEST_SECRET = "test-secret-abc123-for-unit-tests-only";
const TEST_PREV = "test-previous-abc123-for-unit-tests-only";

function withSecret(cb: () => void) {
  const origCurrent = Deno.env.get("BROKI_NEXT_SERVER_SECRET");
  const origPrev = Deno.env.get("BROKI_NEXT_SERVER_SECRET_PREVIOUS");
  Deno.env.set("BROKI_NEXT_SERVER_SECRET", TEST_SECRET);
  Deno.env.delete("BROKI_NEXT_SERVER_SECRET_PREVIOUS");
  try {
    cb();
  } finally {
    if (origCurrent !== undefined) {
      Deno.env.set("BROKI_NEXT_SERVER_SECRET", origCurrent);
    } else {
      Deno.env.delete("BROKI_NEXT_SERVER_SECRET");
    }
    if (origPrev !== undefined) {
      Deno.env.set("BROKI_NEXT_SERVER_SECRET_PREVIOUS", origPrev);
    }
  }
}

function withPrevSecret(cb: () => void) {
  const origCurrent = Deno.env.get("BROKI_NEXT_SERVER_SECRET");
  const origPrev = Deno.env.get("BROKI_NEXT_SERVER_SECRET_PREVIOUS");
  Deno.env.set("BROKI_NEXT_SERVER_SECRET", TEST_SECRET);
  Deno.env.set("BROKI_NEXT_SERVER_SECRET_PREVIOUS", TEST_PREV);
  try {
    cb();
  } finally {
    if (origCurrent !== undefined) {
      Deno.env.set("BROKI_NEXT_SERVER_SECRET", origCurrent);
    } else {
      Deno.env.delete("BROKI_NEXT_SERVER_SECRET");
    }
    if (origPrev !== undefined) {
      Deno.env.set("BROKI_NEXT_SERVER_SECRET_PREVIOUS", origPrev);
    } else {
      Deno.env.delete("BROKI_NEXT_SERVER_SECRET_PREVIOUS");
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("correct secret → ok", () => {
  withSecret(() => {
    const r = authenticateServiceRequest(
      makeRequest({ ...goodHeaders(), "x-broki-service-secret": TEST_SECRET }),
      ALLOWED,
    );
    if (!r.ok) throw new Error(`Expected ok, got ${JSON.stringify(r)}`);
    if (r.serviceId !== "next-server") throw new Error("wrong serviceId");
    if (!r.requestId) throw new Error("missing requestId");
  });
});

Deno.test("wrong secret → 401", () => {
  withSecret(() => {
    const r = authenticateServiceRequest(
      makeRequest({ ...goodHeaders(), "x-broki-service-secret": "wrong-secret" }),
      ALLOWED,
    );
    if (r.ok) throw new Error("Expected failure");
    if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
    if (r.error !== "unauthorized_service_request") throw new Error("wrong error key");
  });
});

Deno.test("empty secret → 401", () => {
  withSecret(() => {
    const r = authenticateServiceRequest(
      makeRequest({ ...goodHeaders(), "x-broki-service-secret": "" }),
      ALLOWED,
    );
    // Empty string causes all-headers check to fail → 401
    if (r.ok) throw new Error("Expected failure");
  });
});

Deno.test("missing secret header → 401", () => {
  withSecret(() => {
    const h = goodHeaders();
    delete h["x-broki-service-secret"];
    const r = authenticateServiceRequest(makeRequest(h), ALLOWED);
    if (r.ok) throw new Error("Expected failure");
    if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
  });
});

Deno.test("unknown service id → 403", () => {
  withSecret(() => {
    const r = authenticateServiceRequest(
      makeRequest({ ...goodHeaders(), "x-broki-service-id": "unknown-service" }),
      ALLOWED,
    );
    if (r.ok) throw new Error("Expected failure");
    if (r.status !== 403) throw new Error(`Expected 403, got ${r.status}`);
  });
});

Deno.test("service not in allowed list → 403", () => {
  withSecret(() => {
    // n8n is valid but not in ALLOWED for this function
    const origN8n = Deno.env.get("BROKI_N8N_SECRET");
    Deno.env.set("BROKI_N8N_SECRET", TEST_SECRET);
    try {
      const r = authenticateServiceRequest(
        makeRequest({
          ...goodHeaders(),
          "x-broki-service-id": "n8n",
          "x-broki-service-secret": TEST_SECRET,
        }),
        ALLOWED,
      );
      if (r.ok) throw new Error("Expected failure");
      if (r.status !== 403) throw new Error(`Expected 403, got ${r.status}`);
    } finally {
      if (origN8n !== undefined) Deno.env.set("BROKI_N8N_SECRET", origN8n);
      else Deno.env.delete("BROKI_N8N_SECRET");
    }
  });
});

Deno.test("stale timestamp (old) → 401", () => {
  withSecret(() => {
    const stale = (Math.floor(Date.now() / 1000) - 400).toString();
    const r = authenticateServiceRequest(
      makeRequest({
        ...goodHeaders({ "x-broki-service-secret": TEST_SECRET }),
        "x-broki-timestamp": stale,
      }),
      ALLOWED,
    );
    if (r.ok) throw new Error("Expected failure");
    if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
  });
});

Deno.test("stale timestamp (future) → 401", () => {
  withSecret(() => {
    const future = (Math.floor(Date.now() / 1000) + 400).toString();
    const r = authenticateServiceRequest(
      makeRequest({
        ...goodHeaders({ "x-broki-service-secret": TEST_SECRET }),
        "x-broki-timestamp": future,
      }),
      ALLOWED,
    );
    if (r.ok) throw new Error("Expected failure");
    if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
  });
});

Deno.test("invalid UUID → 400", () => {
  withSecret(() => {
    const r = authenticateServiceRequest(
      makeRequest({
        ...goodHeaders({ "x-broki-service-secret": TEST_SECRET }),
        "x-broki-request-id": "not-a-uuid",
      }),
      ALLOWED,
    );
    if (r.ok) throw new Error("Expected failure");
    if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
  });
});

Deno.test("env secret not configured → 401", () => {
  const orig = Deno.env.get("BROKI_NEXT_SERVER_SECRET");
  Deno.env.delete("BROKI_NEXT_SERVER_SECRET");
  try {
    const r = authenticateServiceRequest(
      makeRequest({ ...goodHeaders({ "x-broki-service-secret": TEST_SECRET }) }),
      ALLOWED,
    );
    if (r.ok) throw new Error("Expected failure");
    if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
  } finally {
    if (orig !== undefined) Deno.env.set("BROKI_NEXT_SERVER_SECRET", orig);
  }
});

Deno.test("current secret matches", () => {
  withSecret(() => {
    const r = authenticateServiceRequest(
      makeRequest({ ...goodHeaders({ "x-broki-service-secret": TEST_SECRET }) }),
      ALLOWED,
    );
    if (!r.ok) throw new Error(`Expected ok, got ${JSON.stringify(r)}`);
  });
});

Deno.test("previous secret matches during rotation", () => {
  withPrevSecret(() => {
    const r = authenticateServiceRequest(
      makeRequest({ ...goodHeaders({ "x-broki-service-secret": TEST_PREV }) }),
      ALLOWED,
    );
    if (!r.ok) throw new Error(`Expected ok with previous secret, got ${JSON.stringify(r)}`);
  });
});

Deno.test("error response does not contain received secret", () => {
  withSecret(() => {
    const evilSecret = "my-evil-secret-do-not-leak";
    const r = authenticateServiceRequest(
      makeRequest({ ...goodHeaders({ "x-broki-service-secret": evilSecret }) }),
      ALLOWED,
    );
    if (r.ok) throw new Error("Expected failure");
    const serialized = JSON.stringify(r);
    if (serialized.includes(evilSecret)) {
      throw new Error("Received secret leaked into error response!");
    }
  });
});

Deno.test("partial headers (only service-id) → 401", () => {
  const r = authenticateServiceRequest(
    makeRequest({ "x-broki-service-id": "next-server" }),
    ALLOWED,
  );
  if (r.ok) throw new Error("Expected failure");
  if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
});

Deno.test("no headers at all → 401", () => {
  const r = authenticateServiceRequest(makeRequest({}), ALLOWED);
  if (r.ok) throw new Error("Expected failure");
  if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
});

Deno.test("timestamp as float → 401", () => {
  withSecret(() => {
    const r = authenticateServiceRequest(
      makeRequest({
        ...goodHeaders({ "x-broki-service-secret": TEST_SECRET }),
        "x-broki-timestamp": (Date.now() / 1000).toFixed(3),
      }),
      ALLOWED,
    );
    if (r.ok) throw new Error("Expected failure for float timestamp");
  });
});

Deno.test("remote-smoke service id accepted", () => {
  const origSecret = Deno.env.get("BROKI_REMOTE_TEST_SECRET");
  const smokeSecret = "smoke-secret-for-test";
  Deno.env.set("BROKI_REMOTE_TEST_SECRET", smokeSecret);
  try {
    const r = authenticateServiceRequest(
      makeRequest({
        "x-broki-service-id": "remote-smoke",
        "x-broki-service-secret": smokeSecret,
        "x-broki-request-id": makeUUID(),
        "x-broki-timestamp": nowS(),
      }),
      ["remote-smoke"],
    );
    if (!r.ok) throw new Error(`Expected ok, got ${JSON.stringify(r)}`);
    if (r.serviceId !== "remote-smoke") throw new Error("wrong serviceId");
  } finally {
    if (origSecret !== undefined) Deno.env.set("BROKI_REMOTE_TEST_SECRET", origSecret);
    else Deno.env.delete("BROKI_REMOTE_TEST_SECRET");
  }
});
