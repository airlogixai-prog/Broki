import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { ContactForm } from "@/components/public/ContactForm";

export default function SolicitaDemoPage() {
  return (
    <PublicPageShell>
      <section className="container mx-auto px-4 py-16 sm:px-6">
        <p className="text-center text-[#a8b2d1] mb-8 max-w-xl mx-auto">
          Cuéntanos tu caso de uso y te mostramos cómo AIRLOGIX AI puede automatizar tus procesos.
        </p>
        <ContactForm title="Solicita una Demo" submitLabel="Solicitar Demo" />
        <p className="text-center mt-6 text-sm text-[#a8b2d1]">
          ¿Ya tienes acceso? <Link href="/broki" className="text-[#41ead4] hover:underline">Entrar a BROKI</Link>
        </p>
      </section>
    </PublicPageShell>
  );
}
