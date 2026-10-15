import {
  ambiguousKeys,
  foldCode,
  foldText,
  resolveExact,
  uniqueIndex,
} from "../_shared/relation-match.ts";

Deno.test("accent-fold exact unique links", () => {
  const idx = uniqueIndex([
    { id: "p1", key: "Carlos Brazuelo Núñez" },
    { id: "p2", key: "Ana" },
  ]);
  const r = resolveExact("Carlos Brazuelo Nunez", idx);
  if (r.classification !== "LINKED" || r.id !== "p1") {
    throw new Error(`expected LINKED p1 got ${JSON.stringify(r)}`);
  }
});

Deno.test("ambiguous name is MANUAL_REVIEW not auto-link", () => {
  const people = [
    { id: "a", key: "Smoke Test Persona" },
    { id: "b", key: "Smoke Test Persona" },
  ];
  const idx = uniqueIndex(people);
  const amb = ambiguousKeys(people);
  const r = resolveExact("Smoke Test Persona", idx, foldText, amb);
  if (r.classification !== "MANUAL_REVIEW" || r.id !== null) {
    throw new Error(`expected MANUAL_REVIEW got ${JSON.stringify(r)}`);
  }
});

Deno.test("no fuzzy nickname invent", () => {
  const idx = uniqueIndex([{ id: "p1", key: "Jesús García Sánchez bayton" }]);
  const r = resolveExact("BAYTON", idx);
  if (r.classification !== "HISTORICAL_UNRESOLVABLE") {
    throw new Error(`expected HISTORICAL_UNRESOLVABLE got ${JSON.stringify(r)}`);
  }
});

Deno.test("aircraft code exact only — no prefix invent", () => {
  const idx = uniqueIndex(
    [
      { id: "ac1", key: "EC-LZD" },
      { id: "ac2", key: "EC-NBO" },
    ],
    foldCode,
  );
  const short = resolveExact("LZD", idx, foldCode);
  const typo = resolveExact("EC-CNBO", idx, foldCode);
  const ok = resolveExact("EC-LZD", idx, foldCode);
  if (short.classification !== "HISTORICAL_UNRESOLVABLE") {
    throw new Error("must not invent EC- prefix");
  }
  if (typo.classification !== "HISTORICAL_UNRESOLVABLE") {
    throw new Error("must not fix typo EC-CNBO");
  }
  if (ok.classification !== "LINKED" || ok.id !== "ac1") {
    throw new Error("exact matricula must link");
  }
});

Deno.test("asset identifier exact unique", () => {
  const idx = uniqueIndex(
    [
      { id: "v1", key: "G5-6" },
      { id: "v2", key: "L2-3" },
    ],
    foldCode,
  );
  const r = resolveExact("g5-6", idx, foldCode);
  if (r.classification !== "LINKED" || r.id !== "v1") {
    throw new Error(`expected G5-6 link got ${JSON.stringify(r)}`);
  }
});
