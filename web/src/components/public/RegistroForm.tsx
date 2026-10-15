"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { brokiApi } from "@/lib/api/broki";

// Ported from public_html/registrobroki.html. The legacy page posted straight to
// an n8n webhook; this submits to the personnel-register Edge Function, which
// revalidates everything server-side.

const DEPARTMENTS = ["Mantenimiento", "Logística", "Administración"] as const;

const CERTIFICATIONS = [
  { key: "helper", label: "Helper", hint: "Personal de apoyo sin firma" },
  { key: "cat_a", label: "Categoría A", hint: "Tareas menores programadas" },
  { key: "b1", label: "B1", hint: "Mecánica y estructuras" },
  { key: "b2", label: "B2", hint: "Aviónica y sistemas eléctricos" },
  { key: "certificador", label: "Certificador", hint: "Autorizado a certificar" },
] as const;

/** Suffixes match the a_/b1_/b2_ columns in broki_personnel. */
const AIRCRAFT = [
  { suffix: "a320_family", label: "Airbus A320 Family" },
  { suffix: "airbus_a330", label: "Airbus A330" },
  { suffix: "airbus_a350", label: "Airbus A350" },
  { suffix: "boeing_737", label: "Boeing 737" },
  { suffix: "boeing_787", label: "Boeing 787" },
  { suffix: "boeing_777", label: "Boeing 777" },
  { suffix: "atr_42_72", label: "ATR 42/72" },
  { suffix: "embraer_e_jet", label: "Embraer E-Jet" },
  { suffix: "bombardier_crj", label: "Bombardier CRJ" },
  { suffix: "otros", label: "Otros" },
] as const;

const AIRCRAFT_CERTS = [
  { key: "cat_a", label: "CAT A" },
  { key: "b1", label: "B1" },
  { key: "b2", label: "B2" },
] as const;

type CertKey = (typeof CERTIFICATIONS)[number]["key"];
type AircraftCertKey = (typeof AIRCRAFT_CERTS)[number]["key"];
type AircraftState = Record<string, { selected: boolean } & Partial<Record<AircraftCertKey, boolean>>>;

/** Certifications that make the BAC number mandatory, same as the legacy form. */
const BAC_REQUIRED: CertKey[] = ["cat_a", "b1", "b2", "certificador"];

const inputCls =
  "w-full rounded-lg border border-[#2a3f5f] bg-[#0d1b2a] px-3 py-2.5 text-sm text-[#ccd6f6] outline-none placeholder:text-[#5a6a8a] focus:border-[#41ead4] focus:ring-2 focus:ring-[#41ead4]/40 aria-[invalid=true]:border-red-500";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#8892b0]";
const cardCls = "rounded-xl border border-[#2a3f5f] bg-[#172a45] p-5 sm:p-6";
const legendCls = "text-lg font-bold text-white";

export function RegistroForm() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [codigoEmpleado, setCodigoEmpleado] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [certs, setCerts] = useState<Partial<Record<CertKey, boolean>>>({});
  const [numeroBac, setNumeroBac] = useState("");
  const [aircraft, setAircraft] = useState<AircraftState>({});
  const [privacidad, setPrivacidad] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const bacRequired = useMemo(
    () => BAC_REQUIRED.some((key) => certs[key]),
    [certs],
  );

  const toggleCert = (key: CertKey) =>
    setCerts((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleAircraft = (suffix: string) =>
    setAircraft((prev) => {
      const wasSelected = prev[suffix]?.selected ?? false;
      // Unticking an aircraft clears its certifications, mirroring the legacy form.
      return { ...prev, [suffix]: wasSelected ? { selected: false } : { selected: true } };
    });

  const toggleAircraftCert = (suffix: string, key: AircraftCertKey) =>
    setAircraft((prev) => ({
      ...prev,
      [suffix]: { ...prev[suffix], selected: true, [key]: !prev[suffix]?.[key] },
    }));

  const invalid = (field: string) => (errorField === field ? true : undefined);

  const validateLocally = (): { message: string; field: string } | null => {
    if (nombre.trim().length < 3) return { message: "Introduce tu nombre completo.", field: "nombre" };
    if (telefono.replace(/\D/g, "").length < 9) return { message: "Introduce un teléfono válido.", field: "telefono" };
    if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email))
      return { message: "El correo no tiene un formato válido.", field: "email" };
    if (!departamento) return { message: "Selecciona un departamento.", field: "departamento" };
    if (!CERTIFICATIONS.some((c) => certs[c.key]))
      return { message: "Selecciona al menos una certificación.", field: "certificaciones" };
    if (bacRequired && !numeroBac.trim())
      return {
        message: "El número BAC es obligatorio para Certificador, Categoría A, B1 o B2.",
        field: "numero_bac",
      };

    for (const model of AIRCRAFT) {
      const entry = aircraft[model.suffix];
      if (entry?.selected && !AIRCRAFT_CERTS.some((c) => entry[c.key]))
        return {
          message: `Si marcas ${model.label}, indica al menos CAT A, B1 o B2.`,
          field: `aeronaves.${model.suffix}`,
        };
    }

    if (!privacidad)
      return { message: "Debes aceptar la política de privacidad.", field: "privacidad" };
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setErrorField(null);

    const localError = validateLocally();
    if (localError) {
      setError(localError.message);
      setErrorField(localError.field);
      return;
    }

    setSubmitting(true);
    try {
      const result = await brokiApi.registerPersonnel({
        nombre,
        telefono,
        email,
        codigo_empleado: codigoEmpleado,
        departamento,
        numero_bac: numeroBac,
        certificaciones: certs,
        aeronaves: aircraft,
        privacidad,
        website,
      });

      if (result.error) {
        setError(result.error);
        setErrorField(result.field ?? null);
        return;
      }

      setSuccess(
        result.message ??
          "Registro recibido. Queda pendiente de revisión por el equipo de operaciones.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `No se pudo enviar el registro: ${err.message}`
          : "No se pudo enviar el registro. Inténtalo de nuevo.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className={cardCls} role="status">
        <h2 className="text-xl font-bold text-white">Registro enviado</h2>
        <p className="mt-3 text-sm text-[#a8b2d1]">{success}</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-[#41ead4] px-8 py-3 font-bold text-[#0d1b2a] hover:bg-[#31b59d]"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <fieldset className={cardCls}>
        <legend className={legendCls}>Datos personales</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="reg-nombre">
              Nombre completo *
            </label>
            <input
              id="reg-nombre"
              className={inputCls}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              aria-invalid={invalid("nombre")}
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="reg-telefono">
              Teléfono *
            </label>
            <input
              id="reg-telefono"
              className={inputCls}
              type="tel"
              inputMode="tel"
              placeholder="600 123 456"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              aria-invalid={invalid("telefono")}
              autoComplete="tel"
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="reg-email">
              Correo electrónico
            </label>
            <input
              id="reg-email"
              className={inputCls}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={invalid("email")}
              autoComplete="email"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="reg-codigo">
              Código de empleado AENA
            </label>
            <input
              id="reg-codigo"
              className={inputCls}
              value={codigoEmpleado}
              onChange={(e) => setCodigoEmpleado(e.target.value)}
              aria-invalid={invalid("codigo_empleado")}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={cardCls} aria-invalid={invalid("departamento")}>
        <legend className={legendCls}>Departamento *</legend>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {DEPARTMENTS.map((dept) => (
            <label
              key={dept}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                departamento === dept
                  ? "border-[#41ead4] bg-[#41ead4]/10 text-white"
                  : "border-[#2a3f5f] text-[#a8b2d1] hover:border-[#41ead4]/50"
              }`}
            >
              <input
                type="radio"
                name="departamento"
                value={dept}
                checked={departamento === dept}
                onChange={() => setDepartamento(dept)}
                className="accent-[#41ead4]"
              />
              {dept}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={cardCls} aria-invalid={invalid("certificaciones")}>
        <legend className={legendCls}>Certificaciones *</legend>
        <p className="mt-1 text-sm text-[#8892b0]">
          Selecciona todas las certificaciones vigentes.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {CERTIFICATIONS.map((cert) => (
            <label
              key={cert.key}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                certs[cert.key]
                  ? "border-[#41ead4] bg-[#41ead4]/10"
                  : "border-[#2a3f5f] hover:border-[#41ead4]/50"
              }`}
            >
              <input
                type="checkbox"
                checked={certs[cert.key] ?? false}
                onChange={() => toggleCert(cert.key)}
                className="mt-0.5 accent-[#41ead4]"
              />
              <span>
                <span className="block text-sm font-bold text-white">{cert.label}</span>
                <span className="block text-xs text-[#8892b0]">{cert.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {bacRequired && (
          <div className="mt-4">
            <label className={labelCls} htmlFor="reg-bac">
              Número BAC *
            </label>
            <input
              id="reg-bac"
              className={inputCls}
              value={numeroBac}
              onChange={(e) => setNumeroBac(e.target.value)}
              aria-invalid={invalid("numero_bac")}
              aria-describedby="reg-bac-hint"
              required
            />
            <p id="reg-bac-hint" className="mt-1 text-xs text-[#8892b0]">
              Obligatorio para Certificador, Categoría A, B1 y B2.
            </p>
          </div>
        )}
      </fieldset>

      <fieldset className={cardCls}>
        <legend className={legendCls}>Aeronaves autorizadas</legend>
        <p className="mt-1 text-sm text-[#8892b0]">
          Opcional. Si marcas una aeronave, indica con qué certificaciones estás
          habilitado en ella.
        </p>
        <div className="mt-4 space-y-2">
          {AIRCRAFT.map((model) => {
            const entry = aircraft[model.suffix];
            const selected = entry?.selected ?? false;
            return (
              <div
                key={model.suffix}
                className={`rounded-lg border transition-colors ${
                  errorField === `aeronaves.${model.suffix}`
                    ? "border-red-500"
                    : selected
                    ? "border-[#41ead4]"
                    : "border-[#2a3f5f]"
                }`}
              >
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleAircraft(model.suffix)}
                    className="accent-[#41ead4]"
                  />
                  <span className="text-sm font-bold text-white">{model.label}</span>
                </label>

                {selected && (
                  <div className="flex flex-wrap gap-2 border-t border-[#2a3f5f] px-3 py-2.5">
                    {AIRCRAFT_CERTS.map((cert) => (
                      <label
                        key={cert.key}
                        className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                          entry?.[cert.key]
                            ? "border-[#41ead4] bg-[#41ead4]/15 text-[#41ead4]"
                            : "border-[#2a3f5f] text-[#8892b0] hover:border-[#41ead4]/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={entry?.[cert.key] ?? false}
                          onChange={() => toggleAircraftCert(model.suffix, cert.key)}
                          className="accent-[#41ead4]"
                        />
                        {cert.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className={cardCls}>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={privacidad}
            onChange={(e) => setPrivacidad(e.target.checked)}
            aria-invalid={invalid("privacidad")}
            className="mt-1 accent-[#41ead4]"
            required
          />
          <span className="text-sm text-[#a8b2d1]">
            He leído y acepto la{" "}
            <Link href="/politica-privacidad" className="text-[#41ead4] underline">
              política de privacidad
            </Link>{" "}
            y el tratamiento de mis datos profesionales conforme al RGPD. *
          </span>
        </label>
      </div>

      {/* Honeypot: hidden from users, filled in by bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="reg-website">Sitio web</label>
        <input
          id="reg-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-[#41ead4] px-8 py-3.5 font-bold text-[#0d1b2a] transition-colors hover:bg-[#31b59d] disabled:opacity-60"
      >
        {submitting ? "Enviando..." : "Enviar registro"}
      </button>
    </form>
  );
}
