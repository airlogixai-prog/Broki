"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { brokiApi } from "@/lib/api/broki";

export type ContactFormVariant = "contact" | "demo";

interface Props {
  variant?: ContactFormVariant;
  title?: string;
  submitLabel?: string;
}

const DEMO_INTERESTS = [
  { value: "broki", label: "BROKI — Operaciones GSE" },
  { value: "automation", label: "Automatización con IA" },
  { value: "integrations", label: "Integraciones" },
  { value: "other", label: "Otro" },
];

const fieldCls =
  "w-full rounded-lg bg-[#172a45] border border-[#2a3f5f] px-4 py-3 text-[#ccd6f6] placeholder:text-[#a8b2d1] focus:outline-none focus:border-[#41ead4] focus:ring-2 focus:ring-[#41ead4]/20";

export function ContactForm({
  variant = "contact",
  title,
  submitLabel,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const defaultTitle = variant === "demo" ? "Cuéntanos sobre tu negocio" : "Envíanos un mensaje";
  const defaultSubmit = variant === "demo" ? "Solicitar demo" : "Enviar mensaje";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldError(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      type: variant,
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      message: String(fd.get("message") ?? ""),
      company: String(fd.get("company") ?? ""),
      interest: String(fd.get("interest") ?? ""),
      privacidad: fd.get("privacidad") === "on",
      website: String(fd.get("website") ?? ""),
    };

    try {
      const result = await brokiApi.submitMarketingLead(body);
      if (!result.ok) {
        setError("No se pudo enviar el formulario. Inténtalo de nuevo.");
        setSaving(false);
        return;
      }
      router.push(`/gracias?from=${variant}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      if (msg.includes("field:")) {
        setFieldError(msg);
      } else {
        setError(msg);
      }
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2">{title ?? defaultTitle}</h2>

      {/* Honeypot — oculto para humanos */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        aria-hidden
      />

      <div>
        <label htmlFor="lead-name" className="block text-sm font-medium text-[#ccd6f6] mb-1">
          Nombre completo
        </label>
        <input
          required
          id="lead-name"
          name="name"
          autoComplete="name"
          className={fieldCls}
        />
      </div>

      <div>
        <label htmlFor="lead-email" className="block text-sm font-medium text-[#ccd6f6] mb-1">
          Correo electrónico
        </label>
        <input
          required
          id="lead-email"
          type="email"
          name="email"
          autoComplete="email"
          className={fieldCls}
        />
      </div>

      {variant === "demo" && (
        <>
          <div>
            <label htmlFor="lead-company" className="block text-sm font-medium text-[#ccd6f6] mb-1">
              Empresa
            </label>
            <input required id="lead-company" name="company" className={fieldCls} />
          </div>
          <div>
            <label htmlFor="lead-interest" className="block text-sm font-medium text-[#ccd6f6] mb-1">
              Área de interés
            </label>
            <select
              required
              id="lead-interest"
              name="interest"
              defaultValue=""
              className={fieldCls}
            >
              <option value="" disabled>
                Seleccionar…
              </option>
              {DEMO_INTERESTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div>
        <label htmlFor="lead-message" className="block text-sm font-medium text-[#ccd6f6] mb-1">
          {variant === "demo" ? "Comentarios (opcional)" : "Mensaje"}
        </label>
        <textarea
          id="lead-message"
          name="message"
          rows={5}
          required={variant === "contact"}
          className={fieldCls}
        />
      </div>

      <label className="flex items-start gap-3 text-sm text-[#a8b2d1] cursor-pointer">
        <input
          type="checkbox"
          name="privacidad"
          required
          className="mt-1 rounded border-[#2a3f5f]"
        />
        <span>
          He leído y acepto la{" "}
          <Link href="/politica-privacidad" className="text-[#41ead4] underline">
            política de privacidad
          </Link>
          .
        </span>
      </label>

      {(error || fieldError) && (
        <p role="alert" className="text-sm text-red-400 font-medium">
          {error ?? fieldError}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-full bg-[#41ead4] py-3 font-bold text-[#0d1b2a] hover:bg-[#31b59d] transition disabled:opacity-60"
      >
        {saving ? "Enviando…" : (submitLabel ?? defaultSubmit)}
      </button>
    </form>
  );
}
