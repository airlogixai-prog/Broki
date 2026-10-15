import { PublicPageShell } from "@/components/public/PublicPageShell";
import { ContactForm } from "@/components/public/ContactForm";
import { pageMetadata } from "@/lib/public/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Solicita una Demo",
  description:
    "Solicita una demostración personalizada de AIRLOGIX AI y descubre BROKI.",
  path: "/solicita-demo",
});

export default function SolicitaDemoPage() {
  return (
    <PublicPageShell>
      <section className="bg-[#172a45] py-16 text-center">
        <h1 className="text-4xl font-bold text-white md:text-5xl">
          Solicita una <span className="text-[#41ead4]">Demo Personalizada</span>
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-[#a8b2d1]">
          Un especialista te contactará para agendar una sesión y mostrarte el potencial de AIRLOGIX AI.
        </p>
      </section>
      <section className="container mx-auto px-4 py-16 sm:px-6 max-w-2xl">
        <div className="rounded-lg bg-[#172a45] p-8 shadow-2xl">
          <ContactForm variant="demo" />
        </div>
      </section>
    </PublicPageShell>
  );
}
