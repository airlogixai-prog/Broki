/**
 * Offline mirror of SQL alias rules (Fase 10 normalizers).
 * Source of truth for Deno tests; SQL migrations must stay in sync.
 */

export type JsonRow = Record<string, unknown>;

function firstText(row: JsonRow, keys: readonly string[]): string | null {
  for (const key of keys) {
    if (!(key in row)) continue;
    const v = row[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return null;
}

/** Assets identifier: identificador → brk → id → external_id */
export function mapAssetIdentifier(row: JsonRow, externalId: string): string {
  return firstText(row, [
    "identificador",
    "IDENTIFICADOR",
    "brk",
    "BRK",
    "id",
    "ID",
  ]) ?? externalId;
}

/** trabajador | trabajadores */
export function mapAssetWorker(row: JsonRow): string | null {
  return firstText(row, [
    "trabajador",
    "TRABAJADOR",
    "trabajadores",
    "TRABAJADORES",
  ]);
}

/** descripcion, else vehiculo (furgonetas) */
export function mapAssetDescripcion(row: JsonRow): string | null {
  return firstText(row, ["descripcion", "DESCRIPCION"]) ??
    firstText(row, ["vehiculo", "VEHICULO"]);
}

export function mapAircraft(row: JsonRow) {
  return {
    matricula: firstText(row, ["matricula", "MATRICULA"]),
    modelo: firstText(row, ["modelo", "MODELO"]),
    msn: firstText(row, ["msn", "MSN"]),
    motor: firstText(row, ["motor", "MOTOR"]),
    aerolinea: firstText(row, [
      "aerolinea",
      "AEROLINEA",
      "compania",
      "COMPANIA",
    ]),
  };
}

export function mapTooling(row: JsonRow) {
  return {
    bac_bact: firstText(row, [
      "bac_bact",
      "BAC_BACT",
      "bac",
      "BAC",
      "identificador",
      "IDENTIFICADOR",
    ]),
    tipo: firstText(row, ["tipo", "TIPO", "tipo_tool", "TIPO_TOOL"]),
    supplier: firstText(row, ["supplier", "SUPPLIER"]),
    manufacturer: firstText(row, ["manufacturer", "MANUFACTURER"]),
  };
}

/** Nitro typo histórico */
export function mapNitroBottles(row: JsonRow) {
  const llenas = firstText(row, [
    "cantida_de_botellas_llenas",
    "cantidad_de_botellas_llenas",
    "botellas_llenas",
  ]);
  const vacias = firstText(row, [
    "cantidad_de_botellas_vacias",
    "cantida_de_botellas_vacias",
    "botellas_vacias",
  ]);
  return {
    botellas_llenas: llenas == null ? null : Number(llenas),
    botellas_vacias: vacias == null ? null : Number(vacias),
  };
}

/** Assert msn is never taken from matricula keys alone when both present */
export function assertNoConceptMix(row: JsonRow): boolean {
  const mapped = mapAircraft(row);
  const mat = firstText(row, ["matricula", "MATRICULA"]);
  const msn = firstText(row, ["msn", "MSN"]);
  const mod = firstText(row, ["modelo", "MODELO"]);
  const motor = firstText(row, ["motor", "MOTOR"]);
  if (mat && msn && mat !== msn && mapped.matricula === msn) return false;
  if (mod && motor && mod !== motor && mapped.modelo === motor) return false;
  return true;
}

if (import.meta.main) {
  console.assert(
    mapAssetWorker({ trabajadores: "Ana" }) === "Ana",
    "trabajadores",
  );
  console.assert(mapAssetIdentifier({ brk: "BRK-1" }, "9") === "BRK-1", "brk");
  console.assert(
    mapAircraft({ compania: "Iberia" }).aerolinea === "Iberia",
    "compania",
  );
  console.assert(
    mapAssetDescripcion({ vehiculo: "Transit" }) === "Transit",
    "vehiculo",
  );
  console.assert(mapTooling({ tipo: "Torque" }).tipo === "Torque", "tipo");
  console.assert(
    mapNitroBottles({ cantida_de_botellas_llenas: 3 }).botellas_llenas === 3,
    "nitro typo",
  );
  console.assert(
    assertNoConceptMix({
      matricula: "EC-AAA",
      msn: "12345",
      modelo: "A320",
      motor: "CFM",
    }),
    "no mix",
  );
  console.log("legacy-field-normalize self-check OK");
}
