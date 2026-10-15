// Validation and column mapping for the public registration form.
// This is a trust boundary: the payload arrives from an unauthenticated page, so
// nothing here trusts the client. The browser-side checks in
// web/src/app/(public)/registrobroki/page.tsx exist for UX only.

/** Column suffix used by the a_/b1_/b2_ groups in broki_personnel. */
export const AIRCRAFT_MODELS: { label: string; suffix: string }[] = [
  { label: "Airbus A320 Family", suffix: "a320_family" },
  { label: "Airbus A330", suffix: "airbus_a330" },
  { label: "Airbus A350", suffix: "airbus_a350" },
  { label: "Boeing 737", suffix: "boeing_737" },
  { label: "Boeing 787", suffix: "boeing_787" },
  { label: "Boeing 777", suffix: "boeing_777" },
  { label: "ATR 42/72", suffix: "atr_42_72" },
  { label: "Embraer E-Jet", suffix: "embraer_e_jet" },
  { label: "Bombardier CRJ", suffix: "bombardier_crj" },
  { label: "Otros", suffix: "otros" },
];

export const DEPARTMENTS = ["Mantenimiento", "Logística", "Administración"];

/** Certifications that require a BAC number, mirroring the legacy form. */
const BAC_REQUIRED = ["cat_a", "b1", "b2", "certificador"] as const;

export interface RegisterInput {
  nombre?: unknown;
  telefono?: unknown;
  email?: unknown;
  codigo_empleado?: unknown;
  departamento?: unknown;
  numero_bac?: unknown;
  certificaciones?: unknown;
  aeronaves?: unknown;
  privacidad?: unknown;
  /** Honeypot: a real user never sees this field, so a value means a bot. */
  website?: unknown;
}

export interface AircraftCerts {
  cat_a?: boolean;
  b1?: boolean;
  b2?: boolean;
}

export interface RegisterPayload {
  nombre: string;
  telefono: string;
  email: string | null;
  codigoEmpleado: string | null;
  departamento: string;
  numeroBac: string | null;
  certifications: { helper: boolean; cat_a: boolean; b1: boolean; b2: boolean; certificador: boolean };
  aircraft: Record<string, AircraftCerts>;
}

export class ValidationError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function bool(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

/**
 * Normalizes a Spanish phone number to +34XXXXXXXXX. Numbers already carrying a
 * different country code are kept verbatim so foreign staff are not mangled.
 */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s()./-]/g, "");
  if (!cleaned) return null;

  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 9 && /^[6789]/.test(digits)) return `+34${digits}`;
  // 0034... / 34...
  if (digits.length === 11 && digits.startsWith("34")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("0034")) return `+${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith("0034")) return `+${digits.slice(2)}`;
  return null;
}

export function isValidEmail(value: string): boolean {
  // Deliberately loose: the point is to reject obvious junk, not to re-implement
  // RFC 5322. Delivery is the real validator.
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value);
}

export function validateRegistration(input: RegisterInput): RegisterPayload {
  if (text(input.website)) throw new ValidationError("spam detected", "website");
  if (!bool(input.privacidad)) {
    throw new ValidationError("Debes aceptar la politica de privacidad.", "privacidad");
  }

  const nombre = text(input.nombre, 120);
  if (nombre.length < 3) throw new ValidationError("Nombre demasiado corto.", "nombre");
  if (!/[\p{L}]{2,}/u.test(nombre)) throw new ValidationError("Nombre no valido.", "nombre");

  const telefono = normalizePhone(text(input.telefono, 40));
  if (!telefono) throw new ValidationError("Telefono no valido.", "telefono");

  const rawEmail = text(input.email, 160);
  if (rawEmail && !isValidEmail(rawEmail)) {
    throw new ValidationError("Correo no valido.", "email");
  }

  const departamento = text(input.departamento, 40);
  if (!DEPARTMENTS.includes(departamento)) {
    throw new ValidationError("Departamento no valido.", "departamento");
  }

  const certsInput = (input.certificaciones ?? {}) as Record<string, unknown>;
  const certifications = {
    helper: bool(certsInput.helper),
    cat_a: bool(certsInput.cat_a),
    b1: bool(certsInput.b1),
    b2: bool(certsInput.b2),
    certificador: bool(certsInput.certificador),
  };

  if (!Object.values(certifications).some(Boolean)) {
    throw new ValidationError("Selecciona al menos una certificacion.", "certificaciones");
  }

  const numeroBac = text(input.numero_bac, 40) || null;
  if (BAC_REQUIRED.some((key) => certifications[key]) && !numeroBac) {
    throw new ValidationError(
      "El numero BAC es obligatorio para Certificador, CAT A, B1 o B2.",
      "numero_bac",
    );
  }

  const aircraftInput = (input.aeronaves ?? {}) as Record<string, unknown>;
  const aircraft: Record<string, AircraftCerts> = {};

  for (const model of AIRCRAFT_MODELS) {
    const entry = aircraftInput[model.suffix];
    if (!entry || typeof entry !== "object") continue;

    const certs = entry as Record<string, unknown>;
    const selected = {
      cat_a: bool(certs.cat_a),
      b1: bool(certs.b1),
      b2: bool(certs.b2),
    };

    // Legacy rule: ticking an aircraft without a qualifying certification is a
    // validation error, not a silently empty row.
    if (!Object.values(selected).some(Boolean)) {
      if (bool(certs.selected)) {
        throw new ValidationError(
          `Si marcas ${model.label}, indica al menos CAT A, B1 o B2.`,
          `aeronaves.${model.suffix}`,
        );
      }
      continue;
    }

    aircraft[model.suffix] = selected;
  }

  return {
    nombre,
    telefono,
    email: rawEmail ? rawEmail.toLowerCase() : null,
    codigoEmpleado: text(input.codigo_empleado, 40) || null,
    departamento,
    numeroBac,
    certifications,
    aircraft,
  };
}

/** Maps the validated payload onto broki_personnel columns. */
export function toPersonnelRow(payload: RegisterPayload): Record<string, unknown> {
  const row: Record<string, unknown> = {
    source_system: "public_registration",
    source_table: "registrobroki",
    external_id: `reg-${payload.telefono}`,
    nombre: payload.nombre,
    telefono: payload.telefono,
    correo: payload.email,
    cod_empleado_aena: payload.codigoEmpleado,
    departamento: payload.departamento,
    n_bac: payload.numeroBac,
    helper: payload.certifications.helper,
    cat_a: payload.certifications.cat_a,
    b1: payload.certifications.b1,
    b2: payload.certifications.b2,
    certificador: payload.certifications.certificador,
    // A public form cannot create an active operator. Approval is a separate step.
    estado: 0,
    review_status: "pending",
    fecha_alta: new Date().toISOString().slice(0, 10),
    raw_payload: { aircraft: payload.aircraft, submitted_at: new Date().toISOString() },
  };

  for (const model of AIRCRAFT_MODELS) {
    const certs = payload.aircraft[model.suffix];
    row[`a_${model.suffix}`] = certs?.cat_a ? 1 : 0;
    row[`b1_${model.suffix}`] = certs?.b1 ? 1 : 0;
    row[`b2_${model.suffix}`] = certs?.b2 ? 1 : 0;
  }

  return row;
}

// ---------------------------------------------------------------------------
// Self-check: `deno run supabase/functions/_shared/register-validate.ts`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const assert = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`FAIL: ${msg}`);
  };
  const rejects = (input: RegisterInput, field: string) => {
    try {
      validateRegistration(input);
    } catch (err) {
      if (err instanceof ValidationError && err.field === field) return;
      throw new Error(`FAIL: expected ${field} error, got ${err}`);
    }
    throw new Error(`FAIL: expected ${field} to be rejected`);
  };

  assert(normalizePhone("600123456") === "+34600123456", "bare mobile gets +34");
  assert(normalizePhone("600 12 34 56") === "+34600123456", "separators inside a valid number");
  assert(normalizePhone("600 12 34") === null, "too few digits rejected");
  assert(normalizePhone("6001234567") === null, "too many digits rejected");
  assert(normalizePhone("+34 600 123 456") === "+34600123456", "spaces stripped");
  assert(normalizePhone("0034600123456") === "+34600123456", "0034 prefix");
  assert(normalizePhone("34600123456") === "+34600123456", "34 prefix");
  assert(normalizePhone("+33 6 12 34 56 78") === "+33612345678", "foreign code preserved");
  assert(normalizePhone("123456789") === null, "spanish landline prefix 1 rejected");
  assert(normalizePhone("") === null, "empty phone");
  assert(normalizePhone("abc") === null, "non numeric phone");

  assert(isValidEmail("a@b.co"), "simple email valid");
  assert(!isValidEmail("a@b"), "missing TLD invalid");
  assert(!isValidEmail("a b@c.com"), "space invalid");

  const valid: RegisterInput = {
    nombre: "Mario Lorenzo",
    telefono: "600123456",
    email: "Mario@Example.TEST",
    codigo_empleado: "241",
    departamento: "Mantenimiento",
    numero_bac: "BAC-241",
    privacidad: true,
    certificaciones: { b1: true, b2: true },
    aeronaves: {
      airbus_a330: { selected: true, b1: true },
      boeing_737: { selected: false },
    },
  };

  const payload = validateRegistration(valid);
  assert(payload.telefono === "+34600123456", "phone normalized in payload");
  assert(payload.email === "mario@example.test", "email lowercased");
  assert(payload.certifications.b1 && payload.certifications.b2, "certs kept");
  assert(payload.aircraft.airbus_a330?.b1 === true, "aircraft cert kept");
  assert(payload.aircraft.boeing_737 === undefined, "unselected aircraft dropped");

  const row = toPersonnelRow(payload);
  assert(row.review_status === "pending", "public registration is pending review");
  assert(row.estado === 0, "public registration is not active");
  assert(row.b1_airbus_a330 === 1, "a330 b1 column set");
  assert(row.a_airbus_a330 === 0, "a330 cat_a column zeroed");
  assert(row.b1_boeing_737 === 0, "unselected aircraft columns zeroed");
  assert(row.external_id === "reg-+34600123456", "external id derived from phone");

  rejects({ ...valid, website: "http://spam" }, "website");
  rejects({ ...valid, privacidad: false }, "privacidad");
  rejects({ ...valid, nombre: "Al" }, "nombre");
  rejects({ ...valid, telefono: "nope" }, "telefono");
  rejects({ ...valid, email: "bad@" }, "email");
  rejects({ ...valid, departamento: "Marketing" }, "departamento");
  rejects({ ...valid, certificaciones: {} }, "certificaciones");
  rejects({ ...valid, numero_bac: "" }, "numero_bac");
  rejects(
    { ...valid, aeronaves: { airbus_a350: { selected: true } } },
    "aeronaves.airbus_a350",
  );

  // A helper needs no BAC number.
  const helper = validateRegistration({
    ...valid,
    numero_bac: "",
    certificaciones: { helper: true },
    aeronaves: {},
  });
  assert(helper.numeroBac === null, "helper needs no BAC");
  assert(Object.keys(helper.aircraft).length === 0, "helper has no aircraft");

  // Email is optional.
  const noEmail = validateRegistration({ ...valid, email: "" });
  assert(noEmail.email === null, "email optional");

  console.log("register-validate self-check OK");
}
