/** Shared validation for public contact/demo forms. */

export type LeadType = "contact" | "demo";

export interface LeadInput {
  type?: string;
  name?: string;
  email?: string;
  message?: string;
  company?: string;
  interest?: string;
  privacidad?: boolean;
  privacy?: boolean;
  /** Honeypot — must stay empty. */
  website?: string;
}

export class LeadValidationError extends Error {
  constructor(
    message: string,
    readonly field: string,
  ) {
    super(message);
    this.name = "LeadValidationError";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLead(input: LeadInput): {
  leadType: LeadType;
  name: string;
  email: string;
  message: string | null;
  company: string | null;
  interest: string | null;
  privacyAccepted: boolean;
} {
  if (input.website?.trim()) {
    throw new LeadValidationError("spam", "website");
  }

  const leadType = String(input.type ?? "contact") as LeadType;
  if (leadType !== "contact" && leadType !== "demo") {
    throw new LeadValidationError("Tipo de solicitud no válido", "type");
  }

  const name = String(input.name ?? "").trim();
  if (name.length < 2) {
    throw new LeadValidationError("Nombre demasiado corto", "name");
  }

  const email = String(input.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new LeadValidationError("Correo electrónico no válido", "email");
  }

  const message = String(input.message ?? "").trim() || null;
  if (leadType === "contact" && (!message || message.length < 10)) {
    throw new LeadValidationError("El mensaje debe tener al menos 10 caracteres", "message");
  }

  const company = String(input.company ?? "").trim() || null;
  if (leadType === "demo" && (!company || company.length < 2)) {
    throw new LeadValidationError("Indica el nombre de la empresa", "company");
  }

  const interest = String(input.interest ?? "").trim() || null;
  if (leadType === "demo" && !interest) {
    throw new LeadValidationError("Selecciona un área de interés", "interest");
  }

  const privacyAccepted = Boolean(input.privacidad ?? input.privacy);
  if (!privacyAccepted) {
    throw new LeadValidationError("Debes aceptar la política de privacidad", "privacidad");
  }

  return { leadType, name, email, message, company, interest, privacyAccepted };
}

if (import.meta.main) {
  const ok = validateLead({
    type: "demo",
    name: "Ana Test",
    email: "ana@example.com",
    company: "AirLogix",
    interest: "broki",
    message: "Quiero ver BROKI",
    privacidad: true,
  });
  if (ok.leadType !== "demo") throw new Error("demo type");
  let honeypot = false;
  try {
    validateLead({ website: "http://spam.test", name: "x", email: "a@b.c", privacidad: true });
  } catch (e) {
    honeypot = e instanceof LeadValidationError && e.field === "website";
  }
  if (!honeypot) throw new Error("honeypot expected");
  console.log("lead-validate self-check OK");
}
