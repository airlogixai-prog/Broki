import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { RegistroForm } from "@/components/public/RegistroForm";

export default function RegistroBrokiPage() {
  return (
    <PublicPageShell>
      <section className="container mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="mb-4 text-3xl font-bold text-white">Registro BROKI</h1>
        <p className="mb-8 text-[#a8b2d1]">
          Completa tus datos profesionales y certificaciones aeronáuticas para tu
          integración en el sistema BROKI de gestión de recursos de Brok-Air Aviation
          Group. Toda la información es confidencial y se trata conforme al RGPD.
        </p>

        <RegistroForm />

        <p className="mt-8 text-sm text-[#8892b0]">
          ¿Ya tienes cuenta de operaciones?{" "}
          <Link href="/login" className="font-bold text-[#41ead4] underline">
            Inicia sesión
          </Link>
          .
        </p>
      </section>
    </PublicPageShell>
  );
}
